import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PVGISRequest {
  latitude: number;
  longitude: number;
  startyear?: number;
  endyear?: number;
}

interface PVGISTMYHour {
  "time(UTC)": string;
  "T2m": number;        // Temperature at 2m height (°C)
  "G(h)": number;       // Global horizontal irradiance (W/m²)
  "Gb(n)": number;      // Direct normal irradiance (W/m²)
  "Gd(h)": number;      // Diffuse horizontal irradiance (W/m²)
  "IR(h)": number;      // Infrared radiation (W/m²)
  "WS10m": number;      // Wind speed at 10m (m/s)
  "WD10m": number;      // Wind direction at 10m (°)
  "SP": number;         // Surface pressure (Pa)
  "RH": number;         // Relative humidity (%)
}

interface PVGISResponse {
  inputs: {
    location: {
      latitude: number;
      longitude: number;
      elevation: number;
    };
    meteo_data: {
      radiation_db: string;
      year_min: number;
      year_max: number;
    };
  };
  outputs: {
    tmy_hourly: PVGISTMYHour[];
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { latitude, longitude, startyear = 2005, endyear = 2023 }: PVGISRequest = await req.json();

    console.log(`Fetching PVGIS TMY for lat=${latitude}, lon=${longitude}, years=${startyear}-${endyear}`);

    if (!latitude || !longitude) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing latitude or longitude" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Construct PVGIS TMY API URL with year range
    const pvgisUrl = new URL("https://re.jrc.ec.europa.eu/api/v5_3/tmy");
    pvgisUrl.searchParams.set("lat", latitude.toString());
    pvgisUrl.searchParams.set("lon", longitude.toString());
    pvgisUrl.searchParams.set("startyear", startyear.toString());
    pvgisUrl.searchParams.set("endyear", endyear.toString());
    pvgisUrl.searchParams.set("outputformat", "json");

    console.log(`PVGIS TMY URL: ${pvgisUrl.toString()}`);

    const response = await fetch(pvgisUrl.toString());
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`PVGIS API error: ${response.status} - ${errorText}`);
      
      // Check if it's an "out of bounds" error
      if (response.status === 400 && errorText.includes("location")) {
        return new Response(
          JSON.stringify({ success: false, error: "Location not covered by PVGIS database" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
      
      throw new Error(`PVGIS API error: ${response.status}`);
    }

    const data: PVGISResponse = await response.json();
    const hourlyData = data.outputs.tmy_hourly;

    console.log(`Received ${hourlyData.length} hourly records`);

    // Process hourly data into typical day profile (24-hour averages)
    const typicalDayProfile = Array(24).fill(null).map(() => ({
      ghi: 0,
      dni: 0,
      dhi: 0,
      temp: 0,
      count: 0,
    }));

    let totalGhi = 0;
    let peakGhi = 0;
    let totalTemp = 0;

    for (const hour of hourlyData) {
      const hourOfDay = parseInt(hour["time(UTC)"].substring(9, 11));
      
      typicalDayProfile[hourOfDay].ghi += hour["G(h)"];
      typicalDayProfile[hourOfDay].dni += hour["Gb(n)"];
      typicalDayProfile[hourOfDay].dhi += hour["Gd(h)"];
      typicalDayProfile[hourOfDay].temp += hour.T2m;
      typicalDayProfile[hourOfDay].count++;

      totalGhi += hour["G(h)"];
      peakGhi = Math.max(peakGhi, hour["G(h)"]);
      totalTemp += hour.T2m;
    }

    // Calculate averages
    const hourlyGhi = typicalDayProfile.map(h => h.count > 0 ? h.ghi / h.count : 0);
    const hourlyDni = typicalDayProfile.map(h => h.count > 0 ? h.dni / h.count : 0);
    const hourlyDhi = typicalDayProfile.map(h => h.count > 0 ? h.dhi / h.count : 0);
    const hourlyTemp = typicalDayProfile.map(h => h.count > 0 ? h.temp / h.count : 0);

    // Calculate summary metrics
    const dailyGhiWh = hourlyGhi.reduce((sum, v) => sum + v, 0);
    const dailyGhiKwh = dailyGhiWh / 1000;
    const peakSunHours = dailyGhiKwh; // Peak sun hours = kWh/m²/day at 1 kW/m² reference
    const avgTemp = totalTemp / hourlyData.length;
    const annualGhiKwh = (totalGhi / hourlyData.length) * 8760 / 1000;

    // Normalize GHI profile to 0-1 scale for solar generation modeling
    const maxGhi = Math.max(...hourlyGhi);
    const normalizedProfile = hourlyGhi.map(v => maxGhi > 0 ? v / maxGhi : 0);

    // Calculate monthly breakdown
    const monthlyBreakdown: { month: number; avgDailyGhi: number; avgDailyDni: number; avgTemp: number }[] = [];
    
    for (let month = 1; month <= 12; month++) {
      const monthStr = month.toString().padStart(2, "0");
      const monthHours = hourlyData.filter(h => h["time(UTC)"].substring(4, 6) === monthStr);
      
      if (monthHours.length > 0) {
        const daysInMonth = monthHours.length / 24;
        const monthGhi = monthHours.reduce((sum, h) => sum + h["G(h)"], 0);
        const monthDni = monthHours.reduce((sum, h) => sum + h["Gb(n)"], 0);
        const monthTemp = monthHours.reduce((sum, h) => sum + h.T2m, 0);
        
        monthlyBreakdown.push({
          month,
          avgDailyGhi: (monthGhi / daysInMonth) / 1000, // Convert Wh to kWh
          avgDailyDni: (monthDni / daysInMonth) / 1000,
          avgTemp: monthTemp / monthHours.length,
        });
      }
    }

    const result = {
      success: true,
      source: "pvgis",
      dataType: "tmy",
      yearRange: {
        start: startyear,
        end: endyear,
      },
      location: {
        latitude: data.inputs.location.latitude,
        longitude: data.inputs.location.longitude,
        elevation: data.inputs.location.elevation,
      },
      radiationDatabase: data.inputs.meteo_data.radiation_db,
      summary: {
        peakGhi,
        dailyGhiKwh,
        peakSunHours,
        avgTemp,
        annualGhiKwh,
      },
      typicalDay: {
        normalizedProfile,
        hourlyGhi,
        hourlyDni,
        hourlyDhi,
        hourlyTemp,
      },
      monthly: monthlyBreakdown,
    };

    console.log(`Processed TMY: Peak Sun Hours: ${peakSunHours.toFixed(2)}, Annual GHI: ${annualGhiKwh.toFixed(0)} kWh/m²`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch PVGIS data";
    console.error("Error processing PVGIS TMY:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
