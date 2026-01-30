import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InfographicRequest {
  type: "executive" | "system" | "savings" | "environmental" | "engineering" | "tariff";
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
  tariffData?: {
    name?: string;
    tariffType?: string;
    tariffFamily?: string;
    transmissionZone?: string;
    voltageLevel?: string;
    touRates?: Array<{
      season: string;
      period: string;
      rate: number;
    }>;
  };
}

const prompts: Record<string, (data: InfographicRequest["data"], tariffData?: InfographicRequest["tariffData"]) => string> = {
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
    Professional engineering drawing aesthetic, blueprint style with white/blue colors. 16:9 aspect ratio.`,
    
  tariff: (data, tariffData) => `Create a professional electricity tariff infographic explaining Time-of-Use (TOU) pricing.
    Tariff: ${tariffData?.name || 'Electricity Tariff'} - ${tariffData?.tariffType || 'TOU'} type.
    ${tariffData?.transmissionZone ? `Zone: ${tariffData.transmissionZone}` : ''}
    ${tariffData?.voltageLevel ? `Voltage: ${tariffData.voltageLevel}` : ''}
    Show a 24-hour clock diagram with colored segments for Peak (red/orange), Standard (yellow), and Off-Peak (green) periods.
    Include a side panel showing seasonal variations (Winter high demand vs Summer low demand).
    Add a note: "Solar generates during Peak hours = Maximum savings".
    Professional utility company style, clean infographic design. 16:9 aspect ratio.`
};

async function generateImage(prompt: string, apiKey: string, retries = 2): Promise<string> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    console.log(`Image generation attempt ${attempt + 1}/${retries + 1}`);
    
    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-pro-image-preview",
          messages: [
            {
              role: "user",
              content: `Generate an image: ${prompt}. IMPORTANT: You MUST generate an actual image, not just describe it.`,
            },
          ],
          modalities: ["image", "text"],
        }),
      });

      // Always consume the response body to prevent resource leaks
      const responseText = await response.text();
      
      if (!response.ok) {
        console.error("AI gateway error:", response.status, responseText);
        
        if (response.status === 429) {
          throw { status: 429, message: "Rate limit exceeded. Please try again later." };
        }
        if (response.status === 402) {
          throw { status: 402, message: "AI credits exhausted. Please add funds to continue." };
        }
        
        throw new Error(`AI gateway error: ${response.status}`);
      }

      // Handle empty response
      if (!responseText || responseText.trim() === '') {
        console.warn(`Attempt ${attempt + 1}: Empty response from API`);
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        throw new Error("Empty response from AI gateway");
      }

      // Parse JSON safely
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.warn(`Attempt ${attempt + 1}: Invalid JSON response:`, responseText.substring(0, 200));
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        throw new Error("Invalid JSON response from AI gateway");
      }
      
      console.log("API Response structure:", JSON.stringify(Object.keys(result)));
      
      // Check multiple possible image locations in the response
      const imageUrl = 
        result.choices?.[0]?.message?.images?.[0]?.image_url?.url ||
        result.choices?.[0]?.message?.images?.[0]?.url ||
        result.choices?.[0]?.message?.image_url?.url ||
        result.data?.[0]?.url;
      
      if (imageUrl) {
        console.log("Successfully generated image");
        return imageUrl;
      }
      
      console.warn(`Attempt ${attempt + 1}: No image in response, content:`, 
        result.choices?.[0]?.message?.content?.substring(0, 200));
      
      if (attempt < retries) {
        console.log("Retrying image generation...");
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (fetchError) {
      console.error(`Attempt ${attempt + 1} failed:`, fetchError);
      
      // Re-throw status errors immediately
      if (typeof fetchError === 'object' && fetchError !== null && 'status' in fetchError) {
        throw fetchError;
      }
      
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      throw fetchError;
    }
  }
  
  throw new Error("Failed to generate image after multiple attempts. The AI model did not return an image.");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, data, tariffData } = await req.json() as InfographicRequest;
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const promptFn = prompts[type];
    if (!promptFn) {
      throw new Error(`Invalid infographic type: ${type}`);
    }

    const prompt = promptFn(data, tariffData);
    console.log(`Generating ${type} infographic with prompt:`, prompt.substring(0, 100) + "...");

    const imageUrl = await generateImage(prompt, LOVABLE_API_KEY);

    console.log(`Successfully generated ${type} infographic`);

    return new Response(
      JSON.stringify({ 
        imageUrl,
        type,
        description: `${type} infographic for ${data.projectName || 'Solar Project'}`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error generating infographic:", error);
    
    // Handle specific error statuses
    if (typeof error === 'object' && error !== null && 'status' in error) {
      const statusError = error as { status: number; message: string };
      return new Response(
        JSON.stringify({ error: statusError.message }),
        { status: statusError.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
