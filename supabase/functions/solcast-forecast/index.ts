import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SolcastRequest {
  latitude: number;
  longitude: number;
  hours?: number; // forecast hours (default 168 = 7 days)
  period?: string; // PT5M, PT10M, PT15M, PT30M, PT60M
  output_parameters?: string[]; // ghi, dni, dhi, air_temp, cloud_opacity, etc.
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('SOLCAST_API_KEY');
    if (!apiKey) {
      throw new Error('SOLCAST_API_KEY not configured');
    }

    const { 
      latitude, 
      longitude, 
      hours = 168, 
      period = 'PT60M',
      output_parameters = ['ghi', 'dni', 'dhi', 'air_temp', 'cloud_opacity', 'azimuth', 'zenith']
    } = await req.json() as SolcastRequest;

    if (latitude === undefined || longitude === undefined) {
      throw new Error('latitude and longitude are required');
    }

    console.log(`Fetching Solcast forecast for lat=${latitude}, lon=${longitude}, hours=${hours}`);

    // Build the Solcast API URL
    const params = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      hours: hours.toString(),
      period: period,
      output_parameters: output_parameters.join(','),
      format: 'json',
    });

    const solcastUrl = `https://api.solcast.com.au/data/forecast/radiation_and_weather?${params.toString()}`;

    const response = await fetch(solcastUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Solcast API error:', response.status, errorText);
      
      // For quota exceeded (402) errors, return a 200 with success: false so the client can handle gracefully
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Solcast API quota exceeded. Please wait for your quota to reset or upgrade your plan.',
            errorCode: 'QUOTA_EXCEEDED'
          }),
          { 
            status: 200,  // Return 200 so client can handle gracefully
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      throw new Error(`Solcast API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    console.log(`Received ${data.forecasts?.length || 0} forecast periods`);

    // Process the forecast data to extract useful summaries
    const forecasts = data.forecasts || [];
    
    // Calculate daily summaries
    const dailySummaries: Record<string, any> = {};
    
    for (const forecast of forecasts) {
      const date = forecast.period_end?.split('T')[0];
      if (!date) continue;
      
      if (!dailySummaries[date]) {
        dailySummaries[date] = {
          date,
          ghi_total: 0,
          dni_total: 0,
          dhi_total: 0,
          air_temp_avg: 0,
          air_temp_max: -Infinity,
          air_temp_min: Infinity,
          cloud_opacity_avg: 0,
          count: 0,
          peak_sun_hours: 0,
        };
      }
      
      const s = dailySummaries[date];
      
      // Accumulate values (GHI in Wh/m² per period)
      s.ghi_total += forecast.ghi || 0;
      s.dni_total += forecast.dni || 0;
      s.dhi_total += forecast.dhi || 0;
      s.air_temp_avg += forecast.air_temp || 0;
      s.air_temp_max = Math.max(s.air_temp_max, forecast.air_temp || -Infinity);
      s.air_temp_min = Math.min(s.air_temp_min, forecast.air_temp || Infinity);
      s.cloud_opacity_avg += forecast.cloud_opacity || 0;
      s.count++;
      
      // Peak sun hours (1 PSH = 1000 Wh/m²)
      if ((forecast.ghi || 0) > 0) {
        s.peak_sun_hours += (forecast.ghi || 0) / 1000;
      }
    }
    
    // Finalize averages
    const dailyData = Object.values(dailySummaries).map((s: any) => ({
      date: s.date,
      ghi_kwh_m2: s.ghi_total / 1000, // Convert to kWh/m²
      dni_kwh_m2: s.dni_total / 1000,
      dhi_kwh_m2: s.dhi_total / 1000,
      air_temp_avg: s.count > 0 ? s.air_temp_avg / s.count : null,
      air_temp_max: s.air_temp_max === -Infinity ? null : s.air_temp_max,
      air_temp_min: s.air_temp_min === Infinity ? null : s.air_temp_min,
      cloud_opacity_avg: s.count > 0 ? s.cloud_opacity_avg / s.count : null,
      peak_sun_hours: s.peak_sun_hours,
    }));

    // Sort by date
    dailyData.sort((a: any, b: any) => a.date.localeCompare(b.date));

    // Calculate overall summary
    const summary = {
      location: { latitude, longitude },
      forecast_period: {
        start: forecasts[0]?.period_end || null,
        end: forecasts[forecasts.length - 1]?.period_end || null,
        total_periods: forecasts.length,
      },
      average_daily_ghi_kwh_m2: dailyData.length > 0 
        ? dailyData.reduce((sum: number, d: any) => sum + d.ghi_kwh_m2, 0) / dailyData.length 
        : 0,
      average_peak_sun_hours: dailyData.length > 0
        ? dailyData.reduce((sum: number, d: any) => sum + d.peak_sun_hours, 0) / dailyData.length
        : 0,
      total_forecast_days: dailyData.length,
    };

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        daily: dailyData,
        hourly: forecasts, // Include raw hourly data for detailed analysis
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in solcast-forecast function:', errorMessage);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 400, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
