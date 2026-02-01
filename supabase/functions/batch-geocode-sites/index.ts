import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MapboxFeature {
  center: [number, number];
  place_name: string;
  relevance: number;
}

interface MapboxResponse {
  features: MapboxFeature[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const mapboxToken = Deno.env.get("MAPBOX_PUBLIC_TOKEN");

    if (!mapboxToken) {
      return new Response(
        JSON.stringify({ error: "MAPBOX_PUBLIC_TOKEN not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all sites with a name but no coordinates
    const { data: sites, error: fetchError } = await supabase
      .from("sites")
      .select("id, name, location")
      .or("latitude.is.null,longitude.is.null");

    if (fetchError) {
      console.error("Error fetching sites:", fetchError);
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${sites?.length || 0} sites needing geocoding`);

    const results = {
      total: sites?.length || 0,
      success: 0,
      failed: 0,
      skipped: 0,
      details: [] as Array<{ id: string; name: string; status: string; coordinates?: { lat: number; lng: number } }>,
    };

    for (const site of sites || []) {
      if (!site.name || site.name.trim() === "") {
        results.skipped++;
        results.details.push({ id: site.id, name: site.name || "(empty)", status: "skipped - empty name" });
        continue;
      }

      try {
        // Use site name and location for better geocoding results
        // Add South Africa context for better accuracy
        let searchText = site.name;
        if (site.location) {
          searchText = `${site.name}, ${site.location}`;
        }
        if (!searchText.toLowerCase().includes("south africa")) {
          searchText = `${searchText}, South Africa`;
        }
        
        const encodedLocation = encodeURIComponent(searchText);

        const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedLocation}.json?access_token=${mapboxToken}&country=ZA&limit=1&types=place,locality,neighborhood,address,poi`;

        console.log(`Geocoding site "${site.name}": ${searchText}`);

        const response = await fetch(mapboxUrl);

        if (!response.ok) {
          console.error(`Mapbox API error for ${site.name}: ${response.status}`);
          results.failed++;
          results.details.push({ id: site.id, name: site.name, status: `failed - API error ${response.status}` });
          continue;
        }

        const data = await response.json() as MapboxResponse;

        if (!data.features || data.features.length === 0) {
          console.log(`No results for ${site.name}: ${searchText}`);
          results.failed++;
          results.details.push({ id: site.id, name: site.name, status: "failed - location not found" });
          continue;
        }

        const [longitude, latitude] = data.features[0].center;

        // Update the site
        const { error: updateError } = await supabase
          .from("sites")
          .update({ 
            latitude, 
            longitude,
            updated_at: new Date().toISOString() 
          })
          .eq("id", site.id);

        if (updateError) {
          console.error(`Failed to update ${site.name}:`, updateError);
          results.failed++;
          results.details.push({ id: site.id, name: site.name, status: `failed - ${updateError.message}` });
        } else {
          console.log(`✓ Updated ${site.name}: ${latitude}, ${longitude} (from: ${data.features[0].place_name})`);
          results.success++;
          results.details.push({ 
            id: site.id, 
            name: site.name, 
            status: "success", 
            coordinates: { lat: latitude, lng: longitude } 
          });
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (err) {
        console.error(`Error processing ${site.name}:`, err);
        results.failed++;
        results.details.push({ id: site.id, name: site.name, status: `failed - ${err}` });
      }
    }

    console.log(`Batch geocoding complete: ${results.success} success, ${results.failed} failed, ${results.skipped} skipped`);

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Batch geocoding error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
