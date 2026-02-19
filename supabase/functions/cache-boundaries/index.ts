import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ARCGIS_BOUNDARY_URL =
  "https://services7.arcgis.com/vhM1EF9boZaqDxYt/arcgis/rest/services/SA_Local_Municipal_Boundary/FeatureServer/0/query";

const BUCKET = "tariff-uploads";
const FILE_PATH = "boundary-cache/municipality-boundaries.geojson";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const refresh = url.searchParams.get("refresh") === "true";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check storage first (unless refresh forced)
    if (!refresh) {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .download(FILE_PATH);

      if (!error && data) {
        const text = await data.text();
        console.log("Serving boundaries from storage cache");
        return new Response(text, {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.log("Cache miss, fetching from ArcGIS...");
    } else {
      console.log("Refresh requested, fetching from ArcGIS...");
    }

    // Fetch from ArcGIS with geometry simplification to reduce size
    // maxAllowableOffset=0.005 (~500m tolerance) reduces geometry complexity significantly
    const params = new URLSearchParams({
      where: "1=1",
      outFields: "MUNICNAME,PROVINCE,CAT_B,DISTRICT",
      f: "geojson",
      outSR: "4326",
      maxAllowableOffset: "0.005",
      geometryPrecision: "4",
    });

    const response = await fetch(`${ARCGIS_BOUNDARY_URL}?${params}`);
    if (!response.ok) {
      throw new Error(`ArcGIS returned ${response.status}`);
    }

    // Stream directly to text to minimise memory
    const jsonStr = await response.text();
    console.log(`GeoJSON size: ${(jsonStr.length / 1024 / 1024).toFixed(2)} MB`);

    // Quick validation
    const peek = jsonStr.substring(0, 200);
    if (!peek.includes('"features"')) {
      throw new Error("ArcGIS response does not look like valid GeoJSON");
    }

    // Upload to storage
    const encoder = new TextEncoder();
    const encoded = encoder.encode(jsonStr);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(FILE_PATH, encoded, {
        contentType: "application/json",
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload failed:", uploadError.message);
    } else {
      console.log("Boundaries cached to storage successfully");
    }

    return new Response(jsonStr, {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("cache-boundaries error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
