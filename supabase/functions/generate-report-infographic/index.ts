import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InfographicRequest {
  type: "executive" | "system" | "savings" | "environmental" | "engineering";
  data: {
    projectName?: string;
    solarCapacityKwp?: number;
    batteryCapacityKwh?: number;
    annualSavings?: number;
    paybackYears?: number;
    roiPercent?: number;
    co2AvoidedTons?: number;
    selfConsumptionPercent?: number;
    dcAcRatio?: number;
  };
}

const prompts: Record<string, (data: InfographicRequest["data"]) => string> = {
  executive: (data) => `Create a professional executive summary infographic for a solar energy project called "${data.projectName || 'Solar Project'}". 
    Show key metrics: R${(data.annualSavings || 0).toLocaleString()} annual savings, ${data.paybackYears || 5} year payback, ${data.roiPercent || 18}% ROI.
    Use a clean corporate style with green and blue colors. Include icons for money savings, solar panels, and a graph trending upward.
    Modern flat design, professional business presentation style. 16:9 aspect ratio.`,
  
  system: (data) => `Create a technical system overview infographic showing a solar PV installation.
    System specs: ${data.solarCapacityKwp || 100} kWp solar array, ${data.batteryCapacityKwh || 0} kWh battery storage.
    Show a simplified diagram with solar panels on a commercial roof, inverter, battery (if applicable), and connection to building.
    Use technical blueprint style with clean lines. Include capacity labels. Professional engineering diagram aesthetic. 16:9 aspect ratio.`,
  
  savings: (data) => `Create a financial savings breakdown infographic for a solar energy system.
    Annual savings: R${(data.annualSavings || 0).toLocaleString()}, Self-consumption: ${data.selfConsumptionPercent || 70}%.
    Show a pie chart or bar visualization comparing grid costs vs solar savings.
    Use green for savings, use professional financial report style with clean typography. 16:9 aspect ratio.`,
  
  environmental: (data) => `Create an environmental impact infographic for a solar energy project.
    CO2 avoided: ${data.co2AvoidedTons || 100} tons per year. Equivalent to planting ${Math.round((data.co2AvoidedTons || 100) * 45)} trees.
    Show nature imagery, trees, clean air, and sustainability icons.
    Use earthy greens and blues, eco-friendly aesthetic, modern flat design. 16:9 aspect ratio.`,
  
  engineering: (data) => `Create a technical engineering specifications panel for a solar PV system.
    DC Capacity: ${((data.solarCapacityKwp || 100) * (data.dcAcRatio || 1.3)).toFixed(0)} kWp, AC Capacity: ${data.solarCapacityKwp || 100} kW, DC/AC Ratio: ${data.dcAcRatio || 1.3}:1.
    Show technical diagram style with specifications table, electrical symbols.
    Professional engineering drawing aesthetic, blueprint style with white/blue colors. 16:9 aspect ratio.`
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, data } = await req.json() as InfographicRequest;
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const promptFn = prompts[type];
    if (!promptFn) {
      throw new Error(`Invalid infographic type: ${type}`);
    }

    const prompt = promptFn(data);
    console.log(`Generating ${type} infographic with prompt:`, prompt.substring(0, 100) + "...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const result = await response.json();
    const imageUrl = result.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    const textResponse = result.choices?.[0]?.message?.content;

    if (!imageUrl) {
      console.error("No image in response:", JSON.stringify(result).substring(0, 500));
      throw new Error("No image generated");
    }

    console.log(`Successfully generated ${type} infographic`);

    return new Response(
      JSON.stringify({ 
        imageUrl,
        type,
        description: textResponse || `${type} infographic for ${data.projectName || 'Solar Project'}`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error generating infographic:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
