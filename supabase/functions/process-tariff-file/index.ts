import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExtractedTariff {
  municipality: string;
  category: string;
  tariff_name: string;
  tariff_type: "Fixed" | "IBT" | "TOU";
  phase_type?: string;
  amperage_limit?: string;
  is_prepaid: boolean;
  fixed_monthly_charge?: number;
  demand_charge_per_kva?: number;
  rates: Array<{
    rate_per_kwh: number;
    block_start_kwh?: number;
    block_end_kwh?: number;
    season?: string;
    time_of_use?: string;
  }>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { filePath, fileType, province = "Western Cape", action = "analyze", municipality } = await req.json();
    
    if (!filePath) {
      return new Response(
        JSON.stringify({ error: "File path is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Download file from storage
    console.log("Downloading file:", filePath);
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("tariff-uploads")
      .download(filePath);

    if (downloadError || !fileData) {
      console.error("Download error:", downloadError);
      return new Response(
        JSON.stringify({ error: "Failed to download file" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let extractedText = "";
    let sheetData: Record<string, string[][]> = {};
    let sheetNames: string[] = [];

    // Process based on file type
    if (fileType === "xlsx" || fileType === "xls") {
      console.log("Processing Excel file...");
      const arrayBuffer = await fileData.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      sheetNames = workbook.SheetNames;
      
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];
        sheetData[sheetName] = jsonData;
        
        // Convert to text for AI
        extractedText += `\n=== SHEET: ${sheetName} ===\n`;
        extractedText += jsonData.slice(0, 150).map(row => 
          row.filter(cell => cell != null && cell !== "").join(" | ")
        ).filter(row => row.trim()).join("\n");
      }
      console.log(`Processed ${workbook.SheetNames.length} sheets`);
    } else if (fileType === "pdf") {
      console.log("Processing PDF file - using AI vision...");
      const base64 = btoa(String.fromCharCode(...new Uint8Array(await fileData.arrayBuffer())));
      
      const visionRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { 
              role: "user", 
              content: [
                {
                  type: "text",
                  text: "Extract ALL text content from this PDF document. This contains South African electricity tariff data. Preserve the structure - identify municipality names, tariff categories, and all rates/charges. Format as structured text."
                },
                {
                  type: "image_url",
                  image_url: { url: `data:application/pdf;base64,${base64}` }
                }
              ]
            }
          ],
        }),
      });

      if (visionRes.ok) {
        const visionData = await visionRes.json();
        extractedText = visionData.choices?.[0]?.message?.content || "";
        console.log("PDF text extracted, length:", extractedText.length);
      } else {
        console.error("PDF extraction failed:", await visionRes.text());
        extractedText = "PDF extraction failed - please try Excel format";
      }
    }

    // PHASE 1: Analyze - return structure info
    if (action === "analyze") {
      const analysisPrompt = `Analyze this South African electricity tariff data and describe its structure:

${extractedText.slice(0, 8000)}

Identify:
1. Municipality names found (look for "Municipality" in headers)
2. Tariff categories (Domestic, Commercial, Industrial, etc.)
3. Tariff types (Fixed, IBT/block tariffs, TOU/time-of-use)
4. Rate structures (basic charges, energy rates, demand charges)
5. Any issues or inconsistencies in the data

Be specific and concise.`;

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You are an expert in South African electricity tariff structures." },
            { role: "user", content: analysisPrompt }
          ],
        }),
      });

      const aiData = await aiRes.json();
      const analysis = aiData.choices?.[0]?.message?.content || "Analysis failed";

      return new Response(
        JSON.stringify({ 
          success: true,
          fileType,
          sheets: Object.keys(sheetData),
          rowCounts: Object.fromEntries(Object.entries(sheetData).map(([k, v]) => [k, v.length])),
          analysis,
          sampleText: extractedText.slice(0, 2000)
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PHASE 2: Extract municipalities only
    if (action === "extract-municipalities") {
      console.log("Extracting municipalities for province:", province);
      
      // For Excel files, sheet names are often municipality names
      let municipalityNames: string[] = [];
      const sheetNameToMuni: Record<string, string> = {};
      
      if (fileType === "xlsx" || fileType === "xls") {
        // Use sheet names as municipality names (common pattern)
        for (const sheetName of sheetNames) {
          const cleanName = sheetName.replace(/\s*-\s*\d+\.?\d*%$/, '').trim();
          if (cleanName.length > 0) {
            municipalityNames.push(cleanName);
            sheetNameToMuni[cleanName] = sheetName; // Map clean name to original sheet name
          }
        }
        console.log("Found municipalities from sheets:", municipalityNames);
      } else {
        // For PDF, use AI to extract municipality names
        const muniPrompt = `Extract ONLY the municipality names from this South African electricity tariff document.

${extractedText.slice(0, 10000)}

Look for patterns like:
- "XXX Municipality" 
- Municipality names in headers/titles
- Tab names or section headers

Return ONLY municipality names, one per line. Remove any percentages like "- 12.72%".`;

        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "user", content: muniPrompt }
            ],
            tools: [{
              type: "function",
              function: {
                name: "list_municipalities",
                description: "List extracted municipality names",
                parameters: {
                  type: "object",
                  properties: {
                    municipalities: {
                      type: "array",
                      items: { type: "string" },
                      description: "List of municipality names"
                    }
                  },
                  required: ["municipalities"]
                }
              }
            }],
            tool_choice: { type: "function", function: { name: "list_municipalities" } }
          }),
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall) {
            const args = JSON.parse(toolCall.function.arguments);
            municipalityNames = args.municipalities || [];
          }
        }
      }

      // Save to database
      const { data: provinces } = await supabase.from("provinces").select("id, name");
      const provinceMap = new Map(provinces?.map(p => [p.name.toLowerCase(), p.id]) || []);
      
      let provinceId = provinceMap.get(province.toLowerCase());
      if (!provinceId) {
        const { data: newProv } = await supabase.from("provinces").insert({ name: province }).select("id").single();
        if (newProv) provinceId = newProv.id;
        console.log("Created new province:", province, provinceId);
      }

      const savedMunicipalities: Array<{ id: string; name: string; sheetName?: string }> = [];
      const errors: string[] = [];

      if (provinceId) {
        // Get existing municipalities for this province
        const { data: existingMunis } = await supabase
          .from("municipalities")
          .select("id, name")
          .eq("province_id", provinceId);
        
        const existingNames = new Set(existingMunis?.map(m => m.name.toLowerCase()) || []);

        for (const muniName of municipalityNames) {
          const cleanName = muniName.replace(/\s*-\s*\d+\.?\d*%$/, '').trim();
          if (!cleanName) continue;
          
          // Check if already exists
          if (existingNames.has(cleanName.toLowerCase())) {
            const existing = existingMunis?.find(m => m.name.toLowerCase() === cleanName.toLowerCase());
            if (existing) savedMunicipalities.push({ 
              id: existing.id, 
              name: existing.name,
              sheetName: sheetNameToMuni[cleanName] || cleanName
            });
            continue;
          }

          // Create new municipality
          const { data: newMuni, error } = await supabase
            .from("municipalities")
            .insert({ name: cleanName, province_id: provinceId })
            .select("id, name")
            .single();
          
          if (newMuni) {
            savedMunicipalities.push({ 
              id: newMuni.id, 
              name: newMuni.name,
              sheetName: sheetNameToMuni[cleanName] || cleanName
            });
            existingNames.add(cleanName.toLowerCase());
            console.log("Created municipality:", cleanName);
          } else if (error) {
            errors.push(`${cleanName}: ${error.message}`);
          }
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          province,
          provinceId,
          municipalities: savedMunicipalities,
          total: savedMunicipalities.length,
          errors
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PHASE 2.5: Preview raw sheet data for a municipality
    if (action === "preview") {
      if (!municipality) {
        return new Response(
          JSON.stringify({ error: "Municipality name is required for preview" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Previewing data for municipality:", municipality);

      let previewData: string[][] = [];
      let sheetTitle = municipality;

      if (fileType === "xlsx" || fileType === "xls") {
        // Find the sheet matching this municipality
        const matchingSheet = sheetNames.find(name => 
          name.toLowerCase().includes(municipality.toLowerCase()) ||
          municipality.toLowerCase().includes(name.replace(/\s*-\s*\d+\.?\d*%$/, '').toLowerCase())
        );
        
        if (matchingSheet && sheetData[matchingSheet]) {
          sheetTitle = matchingSheet;
          previewData = sheetData[matchingSheet].slice(0, 100); // First 100 rows
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          municipality,
          sheetTitle,
          data: previewData,
          rowCount: previewData.length
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PHASE 3: Extract tariffs for a specific municipality
    if (action === "extract-tariffs") {
      if (!municipality) {
        return new Response(
          JSON.stringify({ error: "Municipality name is required for tariff extraction" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Extracting tariffs for municipality:", municipality);

      // Get data for this specific municipality
      let municipalityText = "";
      if (fileType === "xlsx" || fileType === "xls") {
        // Find the sheet matching this municipality
        const matchingSheet = sheetNames.find(name => 
          name.toLowerCase().includes(municipality.toLowerCase()) ||
          municipality.toLowerCase().includes(name.replace(/\s*-\s*\d+\.?\d*%$/, '').toLowerCase())
        );
        
        if (matchingSheet && sheetData[matchingSheet]) {
          municipalityText = `=== ${matchingSheet} ===\n` + 
            sheetData[matchingSheet].slice(0, 200).map(row => 
              row.filter(cell => cell != null && cell !== "").join(" | ")
            ).filter(row => row.trim()).join("\n");
        }
      } else {
        // For PDF, extract section related to this municipality
        municipalityText = extractedText;
      }

      if (!municipalityText) {
        return new Response(
          JSON.stringify({ error: `No data found for municipality: ${municipality}` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const extractPrompt = `Extract ALL electricity tariffs for "${municipality}" municipality from this data:

${municipalityText.slice(0, 12000)}

CRITICAL DATA MAPPING RULES:
1. Municipality: "${municipality}"
2. Categories: Domestic, Commercial, Industrial, Agricultural, Public Lighting, Other

3. FIXED CHARGES (NOT rates):
   - "Basic Charge per month (R/month)" → fixed_monthly_charge (number in Rands)
   - "Service Charge" or "Admin Charge" → fixed_monthly_charge
   - DO NOT put these in the rates array!

4. DEMAND/CAPACITY CHARGES (NOT rates):
   - "Per 5 Amp or Part (min 30A) (R/A/m)" → demand_charge_per_kva (number in Rands)
   - "Per kVA" charges → demand_charge_per_kva
   - "Capacity Charge" → demand_charge_per_kva
   - DO NOT put these in the rates array!

5. ENERGY RATES ONLY (put in rates array):
   - ONLY values measured in c/kWh go in the rates array
   - "Low Demand Energy Rate (c/kWh)" → rate with time_of_use: "Low Demand"
   - "High Demand Energy Rate (c/kWh)" → rate with time_of_use: "High Demand"
   - "Energy Rate (c/kWh)" with no demand distinction → time_of_use: "Any"
   - Block rates for IBT → include block_start_kwh and block_end_kwh

6. TARIFF TYPE DETERMINATION:
   - If has "High Demand" AND "Low Demand" energy rates → tariff_type: "TOU"
   - If has "Peak/Standard/Off-Peak" periods → tariff_type: "TOU"
   - If has Block 1, Block 2 etc. (consumption tiers) → tariff_type: "IBT"
   - If single flat energy rate → tariff_type: "Fixed"

7. Phase: "Single Phase" or "Three Phase" (from "1 Phase", "3 Phase", "1 & 3 Phase")
8. Amperage: from ">20A", "15A", "60A", "100A" etc.
9. Prepaid: true if "Prepaid" mentioned in name

EXAMPLE for "Domestic - Credit 1 & 3 Phase >20A":
- fixed_monthly_charge: 296.95 (from "Basic Charge per month")
- demand_charge_per_kva: 68.89 (from "Per 5 Amp or Part")
- rates: [
    { rate_per_kwh: 2.1093, time_of_use: "Low Demand" },
    { rate_per_kwh: 3.053, time_of_use: "High Demand" }
  ]
- tariff_type: "TOU" (has High/Low Demand distinction)

NOTE: Convert c/kWh to R/kWh by dividing by 100 (e.g., 210.93 c/kWh = 2.1093 R/kWh)

Extract EVERY tariff structure found for this municipality.`;

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You are a data extraction expert for South African electricity tariffs. You must correctly separate fixed charges (R/month), demand charges (R/A/m or R/kVA), and energy rates (c/kWh). ONLY energy rates go in the rates array. Fixed and demand charges are separate fields." },
            { role: "user", content: extractPrompt }
          ],
          tools: [{
            type: "function",
            function: {
              name: "save_tariffs",
              description: "Save extracted tariff data. IMPORTANT: Only energy rates (c/kWh values) go in the rates array. Basic charges go in fixed_monthly_charge, per-amp charges go in demand_charge_per_kva.",
              parameters: {
                type: "object",
                properties: {
                  tariffs: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        category: { type: "string", description: "Domestic, Commercial, Industrial, Agricultural, Public Lighting, or Other" },
                        tariff_name: { type: "string", description: "Full tariff name from document" },
                        tariff_type: { type: "string", enum: ["Fixed", "IBT", "TOU"], description: "TOU if High/Low Demand rates, IBT if block rates, Fixed otherwise" },
                        phase_type: { type: "string", enum: ["Single Phase", "Three Phase"] },
                        amperage_limit: { type: "string", description: "e.g., >20A, 60A, 100A" },
                        is_prepaid: { type: "boolean" },
                        fixed_monthly_charge: { type: "number", description: "Basic Charge per month in Rands (R/month). NOT an energy rate!" },
                        demand_charge_per_kva: { type: "number", description: "Per-amp or per-kVA charges in Rands (R/A/m or R/kVA). NOT an energy rate!" },
                        rates: {
                          type: "array",
                          description: "ONLY energy rates in R/kWh. Convert c/kWh to R/kWh by dividing by 100.",
                          items: {
                            type: "object",
                            properties: {
                              rate_per_kwh: { type: "number", description: "Energy rate in R/kWh (convert from c/kWh by dividing by 100)" },
                              block_start_kwh: { type: "number", description: "For IBT tariffs only" },
                              block_end_kwh: { type: "number", description: "For IBT tariffs only" },
                              season: { type: "string", enum: ["All Year", "High/Winter", "Low/Summer"] },
                              time_of_use: { type: "string", enum: ["Any", "Peak", "Standard", "Off-Peak", "High Demand", "Low Demand"], description: "High Demand or Low Demand for demand-based TOU tariffs" }
                            },
                            required: ["rate_per_kwh"]
                          }
                        }
                      },
                      required: ["category", "tariff_name", "tariff_type", "is_prepaid", "rates"]
                    }
                  }
                },
                required: ["tariffs"]
              }
            }
          }],
          tool_choice: { type: "function", function: { name: "save_tariffs" } }
        }),
      });

      if (!aiRes.ok) {
        const errText = await aiRes.text();
        console.error("AI extraction failed:", errText);
        return new Response(
          JSON.stringify({ error: "AI extraction failed", details: errText }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const aiData = await aiRes.json();
      console.log("AI response structure:", JSON.stringify({
        hasChoices: !!aiData.choices,
        choiceCount: aiData.choices?.length,
        hasToolCalls: !!aiData.choices?.[0]?.message?.tool_calls,
        toolCallCount: aiData.choices?.[0]?.message?.tool_calls?.length,
        hasContent: !!aiData.choices?.[0]?.message?.content
      }));
      
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      
      let extractedTariffs: Omit<ExtractedTariff, 'municipality'>[];
      
      if (toolCall) {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          extractedTariffs = args.tariffs;
        } catch (parseErr) {
          console.error("Failed to parse tool call arguments:", parseErr);
          return new Response(
            JSON.stringify({ error: "Failed to parse AI response", details: toolCall.function.arguments?.slice(0, 500) }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        // Fallback: try to extract from content if AI didn't use the tool
        const content = aiData.choices?.[0]?.message?.content;
        console.log("No tool call, checking content. Content length:", content?.length || 0);
        
        if (content) {
          // Try to find JSON in the content
          const jsonMatch = content.match(/\{[\s\S]*"tariffs"[\s\S]*\}/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0]);
              extractedTariffs = parsed.tariffs;
              console.log("Extracted tariffs from content:", extractedTariffs?.length || 0);
            } catch {
              console.error("Failed to parse JSON from content");
              return new Response(
                JSON.stringify({ error: "AI did not return structured data", aiContent: content.slice(0, 1000) }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          } else {
            return new Response(
              JSON.stringify({ error: "AI did not return structured data", aiContent: content.slice(0, 1000) }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } else {
          return new Response(
            JSON.stringify({ error: "AI returned empty response" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      
      if (!extractedTariffs || extractedTariffs.length === 0) {
        return new Response(
          JSON.stringify({ error: "No tariffs extracted", municipality }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      console.log(`AI extracted ${extractedTariffs.length} tariffs for ${municipality}`);

      // Save to database
      const { data: muniData } = await supabase
        .from("municipalities")
        .select("id")
        .ilike("name", municipality)
        .single();

      if (!muniData) {
        return new Response(
          JSON.stringify({ error: `Municipality "${municipality}" not found in database` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: categories } = await supabase.from("tariff_categories").select("id, name");
      const categoryMap = new Map(categories?.map(c => [c.name.toLowerCase(), c.id]) || []);

      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const tariff of extractedTariffs) {
        try {
          let categoryId = categoryMap.get(tariff.category.toLowerCase());
          if (!categoryId) {
            const { data: newCat } = await supabase
              .from("tariff_categories")
              .insert({ name: tariff.category })
              .select("id")
              .single();
            if (newCat) {
              categoryId = newCat.id;
              categoryMap.set(tariff.category.toLowerCase(), categoryId);
            }
          }

          if (!categoryId) {
            errors.push(`${tariff.tariff_name}: Missing category`);
            skipped++;
            continue;
          }

          const { data: newTariff, error: tariffErr } = await supabase
            .from("tariffs")
            .insert({
              name: tariff.tariff_name,
              municipality_id: muniData.id,
              category_id: categoryId,
              tariff_type: tariff.tariff_type,
              phase_type: tariff.phase_type || "Single Phase",
              fixed_monthly_charge: tariff.fixed_monthly_charge || 0,
              demand_charge_per_kva: tariff.demand_charge_per_kva || 0,
              is_prepaid: tariff.is_prepaid,
              amperage_limit: tariff.amperage_limit || null,
            })
            .select("id")
            .single();

          if (tariffErr) {
            errors.push(`${tariff.tariff_name}: ${tariffErr.message}`);
            skipped++;
            continue;
          }

          if (tariff.rates && newTariff) {
            for (const rate of tariff.rates) {
              await supabase.from("tariff_rates").insert({
                tariff_id: newTariff.id,
                rate_per_kwh: rate.rate_per_kwh,
                block_start_kwh: rate.block_start_kwh || 0,
                block_end_kwh: rate.block_end_kwh || null,
                season: rate.season || "All Year",
                time_of_use: rate.time_of_use || "Any",
              });
            }
          }

          imported++;
        } catch (e) {
          errors.push(`${tariff.tariff_name}: ${e instanceof Error ? e.message : "Unknown error"}`);
          skipped++;
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          municipality,
          extracted: extractedTariffs.length,
          imported,
          skipped,
          errors: errors.slice(0, 20)
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Process file error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Processing failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
