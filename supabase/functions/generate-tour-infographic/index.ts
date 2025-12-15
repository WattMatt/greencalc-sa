import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TourStepContext {
  tourId: string;
  stepIndex: number;
  title: string;
  content: string;
  featureArea: string;
  infographicType?: "process-flow" | "feature-overview" | "data-flow" | "comparison";
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const body = await req.json();

    // Initialize Supabase client for storage
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Support simple path + prompt for TourInfographic component
    if (body.path && body.prompt) {
      const result = await generateSimpleInfographic(body.path, body.prompt, LOVABLE_API_KEY, supabase);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tourStep, generateAll } = body;

    if (generateAll) {
      // Generate infographics for multiple tour steps
      const results = [];
      for (const step of tourStep as TourStepContext[]) {
        const result = await generateInfographic(step, LOVABLE_API_KEY, supabase, SUPABASE_URL);
        results.push(result);
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate single infographic
    const result = await generateInfographic(tourStep as TourStepContext, LOVABLE_API_KEY, supabase, SUPABASE_URL);
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("Error in generate-tour-infographic:", error);
    
    // Handle rate limiting
    if (error.message?.includes("429") || error.message?.includes("rate limit")) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Handle payment required
    if (error.message?.includes("402")) {
      return new Response(
        JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: error.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function generateInfographic(
  step: TourStepContext,
  apiKey: string,
  supabase: any,
  _supabaseUrl: string
): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  console.log(`Generating infographic for: ${step.tourId} - Step ${step.stepIndex}`);

  // Build a detailed prompt for the infographic
  const infographicPrompt = buildPrompt(step);

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          {
            role: "user",
            content: infographicPrompt,
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log("AI response received");

    // Extract the base64 image from the response
    const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageData) {
      console.error("No image in response:", JSON.stringify(data));
      return { success: false, error: "No image generated" };
    }

    // Upload to Supabase storage
    const fileName = `${step.tourId}/step-${step.stepIndex}.png`;
    
    // Convert base64 to binary
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
    const binaryData = Uint8Array.from(atob(base64Data), (c: string) => c.charCodeAt(0));

    const { error: uploadError } = await supabase.storage
      .from("tour-assets")
      .upload(fileName, binaryData, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return { success: false, error: `Upload failed: ${uploadError.message}` };
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from("tour-assets")
      .getPublicUrl(fileName);

    const imageUrl = publicUrlData.publicUrl;
    console.log(`Infographic uploaded: ${imageUrl}`);

    return { success: true, imageUrl };
  } catch (err: unknown) {
    const error = err as Error;
    console.error("Error generating infographic:", error);
    return { success: false, error: error.message };
  }
}

// Simple infographic generation for TourInfographic component
async function generateSimpleInfographic(
  path: string,
  prompt: string,
  apiKey: string,
  supabase: any
): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  console.log(`Generating simple infographic for path: ${path}`);

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          {
            role: "user",
            content: `Generate a professional 512x256 icon-style infographic illustration: ${prompt}`,
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log("AI response received for simple infographic");

    // Extract the base64 image from the response
    const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageData) {
      console.error("No image in response:", JSON.stringify(data));
      return { success: false, error: "No image generated" };
    }

    // Upload to Supabase storage
    const fileName = `infographics/${path}.png`;
    
    // Convert base64 to binary
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
    const binaryData = Uint8Array.from(atob(base64Data), (c: string) => c.charCodeAt(0));

    const { error: uploadError } = await supabase.storage
      .from("tour-assets")
      .upload(fileName, binaryData, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return { success: false, error: `Upload failed: ${uploadError.message}` };
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from("tour-assets")
      .getPublicUrl(fileName);

    const imageUrl = publicUrlData.publicUrl;
    console.log(`Simple infographic uploaded: ${imageUrl}`);

    return { success: true, imageUrl };
  } catch (err: unknown) {
    const error = err as Error;
    console.error("Error generating simple infographic:", error);
    return { success: false, error: error.message };
  }
}

function buildPrompt(step: TourStepContext): string {
  const baseStyle = `
Create a clean, professional infographic illustration for a software onboarding tutorial.

Style requirements:
- Modern, flat design aesthetic with a dark theme
- Use a color palette of teal/cyan (#06b6d4), purple (#8b5cf6), and dark backgrounds (#1e293b, #0f172a)
- Clean lines, rounded corners, subtle gradients
- Include relevant icons and visual elements
- Aspect ratio: 16:9 landscape orientation
- Resolution: 1024x576 pixels
- No text/labels in the image (those will be added separately)
- Professional, tech-focused aesthetic suitable for enterprise software
`;

  const typePrompts: Record<string, string> = {
    "process-flow": `
Show a horizontal process flow diagram with 3-4 connected steps.
Each step should be represented by a distinct icon or visual element.
Use arrows or connecting lines between steps.
Emphasize the current/active step with a highlight or glow effect.
`,
    "feature-overview": `
Create a feature card or panel visualization showing a software interface element.
Include abstract representations of UI components like buttons, sliders, or input fields.
Show visual hierarchy with primary and secondary elements.
Add subtle visual cues like hover states or selection indicators.
`,
    "data-flow": `
Illustrate data flowing between components or systems.
Use animated-style arrow lines showing direction of data.
Include abstract representations of data sources, processing, and outputs.
Show connections between database, API, and UI layers.
`,
    "comparison": `
Create a side-by-side comparison visualization.
Show two or three options/scenarios with visual differentiation.
Use contrasting elements to highlight differences.
Include visual metrics or indicators showing relative values.
`,
  };

  const infographicType = step.infographicType || "feature-overview";
  const typeSpecificPrompt = typePrompts[infographicType] || typePrompts["feature-overview"];

  return `${baseStyle}

Topic: "${step.title}"
Context: ${step.content}
Feature Area: ${step.featureArea}

${typeSpecificPrompt}

Generate a single, cohesive infographic illustration that visually represents this onboarding step.
The image should help users understand the concept at a glance without needing to read text.
`;
}
