import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GeocodeRequest {
  project_id?: string;
  location?: string;
  save_to_project?: boolean;
  // Reverse geocoding params
  latitude?: number;
  longitude?: number;
  reverse?: boolean;
  // Search suggestions
  limit?: number;
}

interface MapboxFeature {
  center: [number, number]; // [longitude, latitude]
  place_name: string;
  relevance: number;
  context?: Array<{
    id: string;
    text: string;
    short_code?: string;
  }>;
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
    const { project_id, location, save_to_project = false, latitude, longitude, reverse = false, limit = 1 } = await req.json() as GeocodeRequest;

    // Get Mapbox token
    const mapboxToken = Deno.env.get("MAPBOX_PUBLIC_TOKEN");
    if (!mapboxToken) {
      console.error("MAPBOX_PUBLIC_TOKEN not configured");
      return new Response(
        JSON.stringify({ error: "Mapbox token not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // REVERSE GEOCODING: coordinates -> province/municipality
    if (reverse && latitude !== undefined && longitude !== undefined) {
      console.log(`Reverse geocoding: ${latitude}, ${longitude}`);

      // Call Mapbox reverse geocoding API
      const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${mapboxToken}&types=region,place,locality&country=ZA`;
      
      const response = await fetch(mapboxUrl);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Mapbox API error: ${response.status} - ${errorText}`);
        return new Response(
          JSON.stringify({ error: `Reverse geocoding failed: ${response.statusText}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json() as MapboxResponse;
      
      if (!data.features || data.features.length === 0) {
        console.log(`No results found for coordinates: ${latitude}, ${longitude}`);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Location not found for coordinates",
            latitude,
            longitude
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Extract province and municipality from the response
      let province: string | null = null;
      let municipality: string | null = null;
      let place_name: string | null = null;

      // The first feature is usually the most specific location
      const feature = data.features[0];
      place_name = feature.place_name;

      // Parse context to find province (region) and municipality (place)
      if (feature.context) {
        for (const ctx of feature.context) {
          // Region ID starts with "region" - this is the province
          if (ctx.id.startsWith("region")) {
            province = ctx.text;
          }
          // Place ID starts with "place" - this is usually the municipality/city
          if (ctx.id.startsWith("place")) {
            municipality = ctx.text;
          }
        }
      }

      // If the main feature is a region, use it as province
      if (feature.place_name && !province) {
        for (const f of data.features) {
          if (f.context) {
            for (const ctx of f.context) {
              if (ctx.id.startsWith("region")) {
                province = ctx.text;
              }
              if (ctx.id.startsWith("place") && !municipality) {
                municipality = ctx.text;
              }
            }
          }
        }
      }

      // Also check if any feature IS a place (locality can be used as municipality fallback)
      for (const f of data.features) {
        if (!municipality) {
          // Check if this feature is a place type
          const placeFeature = data.features.find(feat => {
            // Mapbox doesn't include type in response, but we can infer from context
            return feat.context?.some(c => c.id.startsWith("region"));
          });
          if (placeFeature && !placeFeature.context?.some(c => c.id.startsWith("place"))) {
            // This feature itself might be the place
            const placeName = placeFeature.place_name?.split(",")[0];
            if (placeName && placeName !== province) {
              municipality = placeName;
            }
          }
        }
      }

      console.log(`Reverse geocoded: province="${province}", municipality="${municipality}", place_name="${place_name}"`);

      return new Response(
        JSON.stringify({
          success: true,
          province,
          municipality,
          place_name,
          latitude,
          longitude
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // FORWARD GEOCODING: location text -> coordinates
    if (!location) {
      return new Response(
        JSON.stringify({ error: "Location text is required for forward geocoding" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Geocoding location: "${location}"`);

    // Preprocess query for better results:
    // - Replace "&" and "and" with space (intersection syntax not supported by Mapbox)
    // - This helps combine multiple street names into a single search
    let processedLocation = location
      .replace(/\s*&\s*/g, ' ')
      .replace(/\s+and\s+/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    const encodedLocation = encodeURIComponent(processedLocation);
    
    // Call Mapbox Geocoding API
    // Use country=ZA to bias to South Africa, include all types for better POI matching
    // proximity parameter centers results around South Africa (lon,lat format)
    const searchLimit = Math.min(Math.max(limit, 1), 10); // Clamp between 1-10
    const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedLocation}.json?access_token=${mapboxToken}&country=ZA&limit=${searchLimit}&proximity=25,-29&fuzzyMatch=true`;
    
    console.log(`Calling Mapbox API for: ${processedLocation}`);
    
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
      console.log(`No results found for: ${location}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Location not found",
          location,
          suggestions: []
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return multiple suggestions if limit > 1
    if (searchLimit > 1) {
      console.log(`Returning ${data.features.length} suggestions for: ${location}`);
      
      // Check if this looks like an intersection search (had & or and)
      const isIntersectionSearch = /\s*(&|and)\s*/i.test(location);
      
      // If intersection search and we have 2+ results in the same area, 
      // add a combined intersection result at the top
      let suggestions = data.features.map((f: MapboxFeature) => ({
        place_name: f.place_name,
        latitude: f.center[1],
        longitude: f.center[0],
        relevance: f.relevance
      }));
      
      if (isIntersectionSearch && data.features.length >= 2) {
        // Check if first two results are nearby (within ~500m = ~0.005 degrees)
        const [f1, f2] = data.features;
        const latDiff = Math.abs(f1.center[1] - f2.center[1]);
        const lngDiff = Math.abs(f1.center[0] - f2.center[0]);
        
        if (latDiff < 0.01 && lngDiff < 0.01) {
          // Calculate midpoint as intersection approximation
          const midLat = (f1.center[1] + f2.center[1]) / 2;
          const midLng = (f1.center[0] + f2.center[0]) / 2;
          
          // Extract street names from place_name (first part before comma)
          const street1 = f1.place_name.split(',')[0].trim();
          const street2 = f2.place_name.split(',')[0].trim();
          
          // Get area context from the first result
          const areaContext = f1.place_name.split(',').slice(1).join(',').trim();
          
          // Add intersection result at the top
          const intersectionResult = {
            place_name: `${street1} & ${street2}, ${areaContext}`,
            latitude: midLat,
            longitude: midLng,
            relevance: 1.0 // Highest relevance for the intersection
          };
          
          console.log(`Created intersection result: ${intersectionResult.place_name}`);
          suggestions = [intersectionResult, ...suggestions];
        }
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          suggestions,
          original_location: location 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const feature = data.features[0];
    const [lng, lat] = feature.center;
    
    console.log(`Geocoded "${location}" to: ${lat}, ${lng} (${feature.place_name})`);

    const result = {
      success: true,
      latitude: lat,
      longitude: lng,
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
          latitude: lat, 
          longitude: lng,
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
