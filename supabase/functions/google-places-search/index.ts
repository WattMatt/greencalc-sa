import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface AutocompleteResponse {
  predictions: PlacePrediction[];
  status: string;
}

interface PlaceDetailsResponse {
  result: {
    geometry: {
      location: {
        lat: number;
        lng: number;
      };
    };
    formatted_address: string;
    name: string;
  };
  status: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, place_id } = await req.json();

    const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!apiKey) {
      console.error("GOOGLE_MAPS_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Google Maps API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If place_id is provided, get place details (coordinates)
    if (place_id) {
      console.log(`Fetching place details for: ${place_id}`);
      
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(place_id)}&fields=geometry,formatted_address,name&key=${apiKey}`;
      
      const response = await fetch(detailsUrl);
      const data = await response.json() as PlaceDetailsResponse;
      
      if (data.status !== "OK") {
        console.error(`Place Details API error: ${data.status}`);
        return new Response(
          JSON.stringify({ error: `Place details failed: ${data.status}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const result = {
        success: true,
        latitude: data.result.geometry.location.lat,
        longitude: data.result.geometry.location.lng,
        place_name: data.result.formatted_address,
        name: data.result.name
      };
      
      console.log(`Place details: ${result.place_name} (${result.latitude}, ${result.longitude})`);
      
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Otherwise, do autocomplete search
    if (!query || query.length < 3) {
      return new Response(
        JSON.stringify({ success: true, suggestions: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Searching for: ${query}`);

    // Use Places Autocomplete API
    // Bias to South Africa with components and location
    const autocompleteUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&components=country:za&key=${apiKey}`;
    
    const response = await fetch(autocompleteUrl);
    const data = await response.json() as AutocompleteResponse;
    
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error(`Places API error: ${data.status}`);
      return new Response(
        JSON.stringify({ error: `Places search failed: ${data.status}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const suggestions = data.predictions.map((p) => ({
      place_id: p.place_id,
      place_name: p.description,
      main_text: p.structured_formatting.main_text,
      secondary_text: p.structured_formatting.secondary_text
    }));

    console.log(`Found ${suggestions.length} suggestions for: ${query}`);

    return new Response(
      JSON.stringify({ success: true, suggestions }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Google Places error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
