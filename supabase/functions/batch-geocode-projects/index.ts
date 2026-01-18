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

    // Fetch all projects with location text but no coordinates
    const { data: projects, error: fetchError } = await supabase
      .from("projects")
      .select("id, name, location")
      .not("location", "is", null)
      .or("latitude.is.null,longitude.is.null");

    if (fetchError) {
      console.error("Error fetching projects:", fetchError);
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${projects?.length || 0} projects needing geocoding`);

    const results = {
      total: projects?.length || 0,
      success: 0,
      failed: 0,
      skipped: 0,
      details: [] as Array<{ id: string; name: string; status: string; coordinates?: { lat: number; lng: number } }>,
    };

    for (const project of projects || []) {
      if (!project.location || project.location.trim() === "") {
        results.skipped++;
        results.details.push({ id: project.id, name: project.name, status: "skipped - empty location" });
        continue;
      }

      try {
        // Add South Africa context for better results
        const searchText = project.location.includes("South Africa") 
          ? project.location 
          : `${project.location}, South Africa`;
        const encodedLocation = encodeURIComponent(searchText);

        const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedLocation}.json?access_token=${mapboxToken}&country=ZA&limit=1&types=place,locality,neighborhood,address`;

        console.log(`Geocoding project "${project.name}": ${project.location}`);

        const response = await fetch(mapboxUrl);

        if (!response.ok) {
          console.error(`Mapbox API error for ${project.name}: ${response.status}`);
          results.failed++;
          results.details.push({ id: project.id, name: project.name, status: `failed - API error ${response.status}` });
          continue;
        }

        const data = await response.json() as MapboxResponse;

        if (!data.features || data.features.length === 0) {
          console.log(`No results for ${project.name}: ${project.location}`);
          results.failed++;
          results.details.push({ id: project.id, name: project.name, status: "failed - location not found" });
          continue;
        }

        const [longitude, latitude] = data.features[0].center;

        // Update the project
        const { error: updateError } = await supabase
          .from("projects")
          .update({ 
            latitude, 
            longitude,
            updated_at: new Date().toISOString() 
          })
          .eq("id", project.id);

        if (updateError) {
          console.error(`Failed to update ${project.name}:`, updateError);
          results.failed++;
          results.details.push({ id: project.id, name: project.name, status: `failed - ${updateError.message}` });
        } else {
          console.log(`✓ Updated ${project.name}: ${latitude}, ${longitude}`);
          results.success++;
          results.details.push({ 
            id: project.id, 
            name: project.name, 
            status: "success", 
            coordinates: { lat: latitude, lng: longitude } 
          });
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (err) {
        console.error(`Error processing ${project.name}:`, err);
        results.failed++;
        results.details.push({ id: project.id, name: project.name, status: `failed - ${err}` });
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
