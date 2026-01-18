import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GeocodeRequest {
  project_id?: string;
  location: string;
  save_to_project?: boolean;
}

interface MapboxFeature {
  center: [number, number]; // [longitude, latitude]
  place_name: string;
  relevance: number;
}

interface MapboxResponse {
  features: MapboxFeature[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { project_id, location, save_to_project = false } = await req.json() as GeocodeRequest;

    if (!location) {
      return new Response(
        JSON.stringify({ error: "Location text is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Geocoding location: "${location}"`);

    // Get Mapbox token
    const mapboxToken = Deno.env.get("MAPBOX_PUBLIC_TOKEN");
    if (!mapboxToken) {
      console.error("MAPBOX_PUBLIC_TOKEN not configured");
      return new Response(
        JSON.stringify({ error: "Mapbox token not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Add South Africa context for better results
    const searchText = location.includes("South Africa") ? location : `${location}, South Africa`;
    const encodedLocation = encodeURIComponent(searchText);
    
    // Call Mapbox Geocoding API
    // Bias results towards South Africa using bbox and country filter
    const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedLocation}.json?access_token=${mapboxToken}&country=ZA&limit=1&types=place,locality,neighborhood,address`;
    
    console.log(`Calling Mapbox API for: ${searchText}`);
    
    const response = await fetch(mapboxUrl);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Mapbox API error: ${response.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ error: `Geocoding failed: ${response.statusText}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json() as MapboxResponse;
    
    if (!data.features || data.features.length === 0) {
      console.log(`No results found for: ${searchText}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Location not found",
          location 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const feature = data.features[0];
    const [longitude, latitude] = feature.center;
    
    console.log(`Geocoded "${location}" to: ${latitude}, ${longitude} (${feature.place_name})`);

    const result = {
      success: true,
      latitude,
      longitude,
      place_name: feature.place_name,
      relevance: feature.relevance,
      original_location: location,
    };

    // Optionally save to project
    if (save_to_project && project_id) {
      console.log(`Saving coordinates to project ${project_id}`);
      
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { error: updateError } = await supabase
        .from("projects")
        .update({ 
          latitude, 
          longitude,
          updated_at: new Date().toISOString() 
        })
        .eq("id", project_id);

      if (updateError) {
        console.error(`Failed to update project: ${updateError.message}`);
        return new Response(
          JSON.stringify({ 
            ...result, 
            saved: false, 
            save_error: updateError.message 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Successfully saved coordinates to project ${project_id}`);
      return new Response(
        JSON.stringify({ ...result, saved: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Geocoding error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});