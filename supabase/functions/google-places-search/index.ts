import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AutocompleteSuggestion {
  placePrediction: {
    placeId: string;
    text: { text: string };
    structuredFormat: {
      mainText: { text: string };
      secondaryText: { text: string };
    };
  };
}

interface AutocompleteResponse {
  suggestions?: AutocompleteSuggestion[];
  error?: { message: string; status: string };
}

interface PlaceDetailsResponse {
  location?: { latitude: number; longitude: number };
  formattedAddress?: string;
  displayName?: { text: string };
  error?: { message: string; status: string };
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
      
      // Use Places API (New) - Place Details
      const detailsUrl = `https://places.googleapis.com/v1/places/${place_id}`;
      
      const response = await fetch(detailsUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "location,formattedAddress,displayName"
        }
      });
      
      const data = await response.json() as PlaceDetailsResponse;
      
      if (data.error) {
        console.error(`Place Details API error: ${data.error.status} - ${data.error.message}`);
        return new Response(
          JSON.stringify({ error: `Place details failed: ${data.error.message}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (!data.location) {
        console.error("No location data in response");
        return new Response(
          JSON.stringify({ error: "No location data found" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const result = {
        success: true,
        latitude: data.location.latitude,
        longitude: data.location.longitude,
        place_name: data.formattedAddress || "",
        name: data.displayName?.text || ""
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

    // Use Places API (New) - Autocomplete
    const autocompleteUrl = "https://places.googleapis.com/v1/places:autocomplete";
    
    const response = await fetch(autocompleteUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey
      },
      body: JSON.stringify({
        input: query,
        includedRegionCodes: ["ZA"],
        languageCode: "en"
      })
    });
    
    const data = await response.json() as AutocompleteResponse;
    
    console.log(`Places API response: ${JSON.stringify(data).substring(0, 200)}`);
    
    if (data.error) {
      console.error(`Places API error: ${data.error.status} - ${data.error.message}`);
      return new Response(
        JSON.stringify({ error: `Places search failed: ${data.error.message}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const suggestions = (data.suggestions || []).map((s) => ({
      place_id: s.placePrediction.placeId,
      place_name: s.placePrediction.text.text,
      main_text: s.placePrediction.structuredFormat?.mainText?.text || s.placePrediction.text.text,
      secondary_text: s.placePrediction.structuredFormat?.secondaryText?.text || ""
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
