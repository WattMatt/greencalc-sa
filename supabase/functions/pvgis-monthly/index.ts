import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PVGISMonthlyRequest {
  latitude: number;
  longitude: number;
  startyear?: number;
  endyear?: number;
}

interface PVGISMonthlyOutput {
  month: number;
  year: number;
  H_sun: number; // Hours of sun
  "H(h)_m": number; // Global irradiance on horizontal plane (kWh/m2/month)
  "Hb(n)_m": number; // Direct normal irradiance (kWh/m2/month)
  "Hd(h)_m": number; // Diffuse irradiance (kWh/m2/month)
  T2m: number; // Average temperature (°C)
}

interface PVGISMonthlyResponse {
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
    monthly: PVGISMonthlyOutput[];
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { latitude, longitude, startyear = 2005, endyear = 2023 }: PVGISMonthlyRequest = await req.json();

    console.log(`Fetching PVGIS Monthly Radiation for lat=${latitude}, lon=${longitude}, years=${startyear}-${endyear}`);

    if (!latitude || !longitude) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing latitude or longitude" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // PVGIS Monthly Radiation endpoint
    const pvgisUrl = new URL("https://re.jrc.ec.europa.eu/api/v5_3/MRcalc");
    pvgisUrl.searchParams.set("lat", latitude.toString());
    pvgisUrl.searchParams.set("lon", longitude.toString());
    pvgisUrl.searchParams.set("startyear", startyear.toString());
    pvgisUrl.searchParams.set("endyear", endyear.toString());
    pvgisUrl.searchParams.set("horirrad", "1");     // Global horizontal irradiance
    pvgisUrl.searchParams.set("mr_dni", "1");       // Direct normal irradiance
    pvgisUrl.searchParams.set("d2glob", "1");       // Diffuse irradiance
    pvgisUrl.searchParams.set("avtemp", "1");       // Average temperature
    pvgisUrl.searchParams.set("outputformat", "json");

    console.log(`PVGIS URL: ${pvgisUrl.toString()}`);

    const response = await fetch(pvgisUrl.toString());

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`PVGIS API error: ${response.status} - ${errorText}`);
      
      if (response.status === 400 && errorText.includes("location")) {
        return new Response(
          JSON.stringify({ success: false, error: "Location not covered by PVGIS database" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
      
      throw new Error(`PVGIS API error: ${response.status}`);
    }

    const data: PVGISMonthlyResponse = await response.json();
    const monthlyData = data.outputs.monthly;

    console.log(`Received ${monthlyData.length} monthly records`);

    // Group by month and calculate averages across all years
    const monthlyAverages: {
      month: number;
      avgDailyGhi: number;
      avgDailyDni: number;
      avgDailyDhi: number;
      avgTemp: number;
      yearsAveraged: number;
    }[] = [];

    for (let month = 1; month <= 12; month++) {
      const monthRecords = monthlyData.filter(m => m.month === month);
      
      if (monthRecords.length === 0) continue;

      // Get days in month (use average)
      const daysInMonth = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];

      // Calculate averages - H(h)_m is monthly total, convert to daily average
      const avgMonthlyGhi = monthRecords.reduce((sum, r) => sum + r["H(h)_m"], 0) / monthRecords.length;
      const avgMonthlyDni = monthRecords.reduce((sum, r) => sum + r["Hb(n)_m"], 0) / monthRecords.length;
      const avgMonthlyDhi = monthRecords.reduce((sum, r) => sum + r["Hd(h)_m"], 0) / monthRecords.length;
      const avgTemp = monthRecords.reduce((sum, r) => sum + r.T2m, 0) / monthRecords.length;

      monthlyAverages.push({
        month,
        avgDailyGhi: avgMonthlyGhi / daysInMonth,  // Convert monthly total to daily average
        avgDailyDni: avgMonthlyDni / daysInMonth,
        avgDailyDhi: avgMonthlyDhi / daysInMonth,
        avgTemp,
        yearsAveraged: monthRecords.length,
      });
    }

    // Calculate annual summary
    const annualGhiKwh = monthlyAverages.reduce((sum, m) => {
      const daysInMonth = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m.month - 1];
      return sum + (m.avgDailyGhi * daysInMonth);
    }, 0);

    const avgDailyGhi = annualGhiKwh / 365;
    const peakSunHours = avgDailyGhi; // PSH = kWh/m²/day at 1kW/m² reference
    const avgTemp = monthlyAverages.reduce((sum, m) => sum + m.avgTemp, 0) / monthlyAverages.length;

    const result = {
      success: true,
      source: "pvgis",
      dataType: "monthly_radiation",
      yearRange: {
        start: startyear,
        end: endyear,
        yearsCount: endyear - startyear + 1,
      },
      location: {
        latitude: data.inputs.location.latitude,
        longitude: data.inputs.location.longitude,
        elevation: data.inputs.location.elevation,
      },
      radiationDatabase: data.inputs.meteo_data.radiation_db,
      summary: {
        peakSunHours,
        dailyGhiKwh: avgDailyGhi,
        annualGhiKwh,
        avgTemp,
      },
      monthly: monthlyAverages,
      rawMonthlyData: monthlyData, // Include raw data for detailed analysis
    };

    console.log(`Processed: ${monthlyAverages.length} months, Annual GHI: ${annualGhiKwh.toFixed(1)} kWh/m²`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch PVGIS data";
    console.error("Error processing PVGIS monthly data:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
