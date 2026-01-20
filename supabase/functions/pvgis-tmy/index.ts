import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PVGISRequest {
  latitude: number;
  longitude: number;
}

interface PVGISTMYHour {
  "time(UTC)": string;
  "T2m": number; // Temperature at 2m (°C)
  "RH": number; // Relative humidity (%)
  "G(h)": number; // Global horizontal irradiance (W/m²)
  "Gb(n)": number; // Direct normal irradiance (W/m²)
  "Gd(h)": number; // Diffuse horizontal irradiance (W/m²)
  "IR(h)": number; // Infrared radiation (W/m²)
  "WS10m": number; // Wind speed at 10m (m/s)
  "WD10m": number; // Wind direction at 10m (°)
  "SP": number; // Surface pressure (Pa)
}

interface PVGISResponse {
  inputs: {
    location: { latitude: number; longitude: number; elevation: number };
  };
  outputs: {
    tmy_hourly: PVGISTMYHour[];
  };
  meta: {
    inputs: { meteo_data: { radiation_db: string; meteo_db: string } };
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { latitude, longitude }: PVGISRequest = await req.json();

    if (!latitude || !longitude) {
      return new Response(
        JSON.stringify({ success: false, error: "Latitude and longitude are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Fetching PVGIS TMY data for: ${latitude}, ${longitude}`);

    // Fetch TMY data from PVGIS API
    const pvgisUrl = new URL("https://re.jrc.ec.europa.eu/api/v5_3/tmy");
    pvgisUrl.searchParams.set("lat", latitude.toString());
    pvgisUrl.searchParams.set("lon", longitude.toString());
    pvgisUrl.searchParams.set("outputformat", "json");
    pvgisUrl.searchParams.set("browser", "0"); // Get raw data, not browser-formatted

    const response = await fetch(pvgisUrl.toString());

    if (!response.ok) {
      const errorText = await response.text();
      console.error("PVGIS API error:", response.status, errorText);
      
      // Handle specific PVGIS errors
      if (response.status === 400 || errorText.includes("outside")) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Location outside PVGIS coverage area. PVGIS covers Europe, Africa, most of Asia, and the Americas between 60°N and 60°S.",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: `PVGIS API error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pvgisData: PVGISResponse = await response.json();
    const hourlyData = pvgisData.outputs.tmy_hourly;

    if (!hourlyData || hourlyData.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No TMY data available for this location" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Received ${hourlyData.length} hourly TMY records`);

    // Process TMY data into a typical daily profile
    // TMY has 8760 hours (365 days × 24 hours)
    // We'll calculate the average for each hour of the day across the entire year
    const hourlyAverages: {
      ghi: number[];
      dni: number[];
      dhi: number[];
      temp: number[];
      counts: number[];
    } = {
      ghi: Array(24).fill(0),
      dni: Array(24).fill(0),
      dhi: Array(24).fill(0),
      temp: Array(24).fill(0),
      counts: Array(24).fill(0),
    };

    // Also calculate monthly averages for seasonal analysis
    const monthlyData: {
      [month: number]: { ghi: number; dni: number; count: number };
    } = {};

    for (const hour of hourlyData) {
      // Parse time format: "YYYYMMDD:HHMM"
      const timeStr = hour["time(UTC)"];
      const hourOfDay = parseInt(timeStr.slice(9, 11), 10);
      const month = parseInt(timeStr.slice(4, 6), 10);

      hourlyAverages.ghi[hourOfDay] += hour["G(h)"] || 0;
      hourlyAverages.dni[hourOfDay] += hour["Gb(n)"] || 0;
      hourlyAverages.dhi[hourOfDay] += hour["Gd(h)"] || 0;
      hourlyAverages.temp[hourOfDay] += hour["T2m"] || 0;
      hourlyAverages.counts[hourOfDay]++;

      // Monthly aggregation
      if (!monthlyData[month]) {
        monthlyData[month] = { ghi: 0, dni: 0, count: 0 };
      }
      monthlyData[month].ghi += hour["G(h)"] || 0;
      monthlyData[month].dni += hour["Gb(n)"] || 0;
      monthlyData[month].count++;
    }

    // Calculate final hourly averages
    const typicalDayProfile = {
      hourlyGhi: hourlyAverages.ghi.map((sum, i) =>
        hourlyAverages.counts[i] > 0 ? sum / hourlyAverages.counts[i] : 0
      ),
      hourlyDni: hourlyAverages.dni.map((sum, i) =>
        hourlyAverages.counts[i] > 0 ? sum / hourlyAverages.counts[i] : 0
      ),
      hourlyDhi: hourlyAverages.dhi.map((sum, i) =>
        hourlyAverages.counts[i] > 0 ? sum / hourlyAverages.counts[i] : 0
      ),
      hourlyTemp: hourlyAverages.temp.map((sum, i) =>
        hourlyAverages.counts[i] > 0 ? sum / hourlyAverages.counts[i] : 0
      ),
    };

    // Calculate peak GHI
    const peakGhi = Math.max(...typicalDayProfile.hourlyGhi);

    // Calculate normalized profile (0-1)
    const normalizedProfile = typicalDayProfile.hourlyGhi.map((v) =>
      peakGhi > 0 ? v / peakGhi : 0
    );

    // Calculate daily totals (sum of hourly values = Wh/m²)
    const dailyGhiWh = typicalDayProfile.hourlyGhi.reduce((sum, v) => sum + v, 0);
    const dailyGhiKwh = dailyGhiWh / 1000;
    const peakSunHours = dailyGhiKwh; // PSH = kWh/m²/day

    // Average temperature
    const avgTemp =
      typicalDayProfile.hourlyTemp.reduce((sum, v) => sum + v, 0) / 24;

    // Monthly breakdown
    const monthlyBreakdown = Object.entries(monthlyData)
      .map(([month, data]) => ({
        month: parseInt(month, 10),
        avgDailyGhi: data.count > 0 ? (data.ghi / data.count) * 24 / 1000 : 0, // kWh/m²/day
        avgDailyDni: data.count > 0 ? (data.dni / data.count) * 24 / 1000 : 0,
      }))
      .sort((a, b) => a.month - b.month);

    // Annual total
    const annualGhiKwh = monthlyBreakdown.reduce(
      (sum, m) => sum + m.avgDailyGhi * 30.44, // Average days per month
      0
    );

    const result = {
      success: true,
      source: "pvgis",
      dataType: "tmy",
      location: {
        latitude,
        longitude,
        elevation: pvgisData.inputs?.location?.elevation || null,
      },
      radiationDatabase: pvgisData.meta?.inputs?.meteo_data?.radiation_db || "PVGIS-SARAH2",
      summary: {
        peakGhi,
        dailyGhiKwh,
        peakSunHours,
        avgTemp,
        annualGhiKwh,
      },
      typicalDay: {
        normalizedProfile,
        hourlyGhi: typicalDayProfile.hourlyGhi,
        hourlyDni: typicalDayProfile.hourlyDni,
        hourlyDhi: typicalDayProfile.hourlyDhi,
        hourlyTemp: typicalDayProfile.hourlyTemp,
      },
      monthly: monthlyBreakdown,
    };

    console.log("PVGIS TMY processed successfully:", {
      peakSunHours: result.summary.peakSunHours.toFixed(2),
      avgTemp: result.summary.avgTemp.toFixed(1),
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("PVGIS Edge Function error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
