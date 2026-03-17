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
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: `Generate an image: ${prompt}. IMPORTANT: You MUST generate an actual image, not just describe it.` },
                ],
              },
            ],
            generationConfig: {
              responseModalities: ["TEXT", "IMAGE"],
            },
          }),
        }
      );

      const responseText = await response.text();

      if (!response.ok) {
        console.error("Gemini API error:", response.status, responseText);
        if (response.status === 429) {
          throw { status: 429, message: "Rate limit exceeded. Please try again later." };
        }
        if (response.status === 403) {
          throw { status: 402, message: "Gemini API quota exhausted or access denied." };
        }
        throw new Error(`Gemini API error: ${response.status}`);
      }

      if (!responseText || responseText.trim() === '') {
        console.warn(`Attempt ${attempt + 1}: Empty response from Gemini`);
        if (attempt < retries) { await new Promise(r => setTimeout(r, 1000)); continue; }
        throw new Error("Empty response from Gemini API");
      }

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (_parseError) {
        console.warn(`Attempt ${attempt + 1}: Invalid JSON:`, responseText.substring(0, 200));
        if (attempt < retries) { await new Promise(r => setTimeout(r, 1000)); continue; }
        throw new Error("Invalid JSON response from Gemini API");
      }

      console.log("Gemini response keys:", JSON.stringify(Object.keys(result)));

      // Gemini returns: { candidates: [{ content: { parts: [{ inlineData: { mimeType, data } }] } }] }
      const parts = result.candidates?.[0]?.content?.parts;
      if (parts) {
        for (const part of parts) {
          if (part.inlineData?.data) {
            const mimeType = part.inlineData.mimeType || "image/png";
            const base64Url = `data:${mimeType};base64,${part.inlineData.data}`;
            console.log("Successfully generated image from Gemini");
            return base64Url;
          }
        }
      }

      console.warn(`Attempt ${attempt + 1}: No image in Gemini response`);
      if (attempt < retries) {
        console.log("Retrying image generation...");
        await new Promise(r => setTimeout(r, 1000));
      }
    } catch (fetchError) {
      console.error(`Attempt ${attempt + 1} failed:`, fetchError);
      if (typeof fetchError === 'object' && fetchError !== null && 'status' in fetchError) {
        throw fetchError;
      }
      if (attempt < retries) { await new Promise(r => setTimeout(r, 1000)); continue; }
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
    
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const promptFn = prompts[type];
    if (!promptFn) {
      throw new Error(`Invalid infographic type: ${type}`);
    }

    const prompt = promptFn(data, tariffData);
    console.log(`Generating ${type} infographic with prompt:`, prompt.substring(0, 100) + "...");

    const imageUrl = await generateImage(prompt, GEMINI_API_KEY);

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
