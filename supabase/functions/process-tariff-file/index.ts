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
  // NERSA-compliant fields
  voltage_level?: "LV" | "MV" | "HV";
  reactive_energy_charge?: number;
  capacity_kva?: number;
  customer_category?: string;
  rates: Array<{
    rate_per_kwh: number;
    block_start_kwh?: number;
    block_end_kwh?: number;
    season?: string;
    time_of_use?: string;
    reactive_energy_charge?: number;
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
          .select("id, name, source_file_path")
          .eq("province_id", provinceId);
        
        const existingNames = new Set(existingMunis?.map(m => m.name.toLowerCase()) || []);

        for (const muniName of municipalityNames) {
          const cleanName = muniName.replace(/\s*-\s*\d+\.?\d*%$/, '').trim();
          if (!cleanName) continue;
          
          // Check if already exists
          if (existingNames.has(cleanName.toLowerCase())) {
            const existing = existingMunis?.find(m => m.name.toLowerCase() === cleanName.toLowerCase());
            if (existing) {
              // Update source_file_path if not already set or different
              if (existing.source_file_path !== filePath) {
                await supabase
                  .from("municipalities")
                  .update({ source_file_path: filePath })
                  .eq("id", existing.id);
                console.log("Updated source_file_path for:", cleanName);
              }
              savedMunicipalities.push({ 
                id: existing.id, 
                name: existing.name,
                sheetName: sheetNameToMuni[cleanName] || cleanName
              });
            }
            continue;
          }

          // Create new municipality with source_file_path
          const { data: newMuni, error } = await supabase
            .from("municipalities")
            .insert({ name: cleanName, province_id: provinceId, source_file_path: filePath })
            .select("id, name")
            .single();
          
          if (newMuni) {
            savedMunicipalities.push({ 
              id: newMuni.id, 
              name: newMuni.name,
              sheetName: sheetNameToMuni[cleanName] || cleanName
            });
            existingNames.add(cleanName.toLowerCase());
            console.log("Created municipality:", cleanName, "with source:", filePath);
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

      // Get municipality ID and existing tariffs first
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

      // Fetch existing tariffs with their rates for comparison
      const { data: existingTariffs } = await supabase
        .from("tariffs")
        .select(`
          id, name, tariff_type, phase_type, amperage_limit, is_prepaid,
          fixed_monthly_charge, demand_charge_per_kva, voltage_level,
          reactive_energy_charge, capacity_kva, customer_category,
          category:tariff_categories(name),
          tariff_rates(rate_per_kwh, block_start_kwh, block_end_kwh, season, time_of_use)
        `)
        .eq("municipality_id", muniData.id);

      // Build summary of existing tariffs for AI context
      const existingTariffSummary = existingTariffs?.map(t => ({
        name: t.name,
        category: (t.category as any)?.name || "Unknown",
        tariff_type: t.tariff_type,
        fixed_monthly_charge: t.fixed_monthly_charge,
        demand_charge_per_kva: t.demand_charge_per_kva,
        rates: t.tariff_rates?.map(r => ({
          rate_per_kwh: r.rate_per_kwh,
          time_of_use: r.time_of_use,
          season: r.season
        }))
      })) || [];

      console.log(`Found ${existingTariffSummary.length} existing tariffs for ${municipality}`);

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

      // Build context about existing tariffs
      const existingContext = existingTariffSummary.length > 0 
        ? `\n\nEXISTING TARIFFS IN DATABASE (${existingTariffSummary.length} total):
${JSON.stringify(existingTariffSummary, null, 2)}

INCREMENTAL EXTRACTION RULES:
- Compare the source document against the existing tariffs above
- ONLY return tariffs that are:
  1. NEW: Not in the existing list (different name/category combination)
  2. UPDATED: Exist but have different values (rates, charges changed)
- For UPDATED tariffs, include ALL current values from the document (we'll replace them)
- Mark each tariff with "action": "new" or "action": "update"
- If a tariff exists with IDENTICAL values, DO NOT include it
- Focus on finding MISSING tariffs that weren't extracted before`
        : "";

      const extractPrompt = `TASK: Extract electricity tariffs for "${municipality}" municipality.

SOURCE DATA:
${municipalityText.slice(0, 15000)}

=== EXTRACTION RULES ===

1. TARIFF IDENTIFICATION:
   Look for section headers like "Domestic", "Commercial", "Industrial", "Agricultural", "Prepaid"
   Each distinct tariff structure = one tariff entry

2. TARIFF TYPE DETECTION (CRITICAL):
   - IBT (Incremental Block Tariff): When you see DIFFERENT rates for different kWh consumption levels
     Examples: "<500kWh: 303.02" and ">500kWh: 268.04" = IBT with 2 blocks
     Examples: "0-50kWh", "51-350kWh", "351-600kWh" = IBT with 3 blocks
   - TOU (Time of Use): When you see "High Demand" AND "Low Demand" rates, OR "Peak/Standard/Off-Peak"
   - Fixed: Single flat energy rate with no blocks or time variations

3. IBT BLOCK PARSING (VERY IMPORTANT):
   When the source shows consumption-based rates like:
   - "<500kWh" or "≤500kWh" → block_start_kwh: 0, block_end_kwh: 500
   - ">500kWh" or "≥500kWh" or "500kWh+" → block_start_kwh: 500, block_end_kwh: null
   - "0-50kWh" → block_start_kwh: 0, block_end_kwh: 50
   - "51-350kWh" → block_start_kwh: 51, block_end_kwh: 350
   - "351+" or ">350kWh" → block_start_kwh: 351, block_end_kwh: null
   
   EACH BLOCK = ONE RATE ENTRY with block_start_kwh and block_end_kwh populated!

4. CHARGE TYPE SEPARATION:
   - "Basic Charge (R/month)" or "Service Charge" → fixed_monthly_charge (NOT in rates array)
   - "Per Amp" or "Per kVA" charges → demand_charge_per_kva (NOT in rates array)
   - "Energy Charge (c/kWh)" → rates array with rate_per_kwh
   
5. RATE CONVERSION:
   - If rate is in c/kWh (like 303.02), convert to R/kWh by dividing by 100 → 3.0302
   - If rate is already in R/kWh (like 3.03), use as-is

6. CUSTOMER CATEGORIES:
   - Domestic/Residential → "Domestic"
   - Commercial/Business → "Commercial"  
   - Industrial/LPU/Large Power → "Industrial"
   - Agriculture/Farm → "Agriculture"

7. PHASE & AMPERAGE:
   - "Single Phase" or "1 Phase" → phase_type: "Single Phase"
   - "Three Phase" or "3 Phase" → phase_type: "Three Phase"
   - Extract amperage limits like ">20A", "60A", "100A"

8. PREPAID:
   - is_prepaid: true if "Prepaid" appears in tariff name

=== EXAMPLE IBT EXTRACTION ===
Source data:
  "Agricultural Conventional Low"
  "Basic Charge (R/month): 2507.73"
  "Energy Charge (c/kWh):"
  "<500kWh: 336.38"
  ">500kWh: 298.88"

Correct extraction:
{
  "category": "Agricultural",
  "tariff_name": "Agricultural Conventional Low Users Three Phase",
  "tariff_type": "IBT",
  "phase_type": "Three Phase",
  "is_prepaid": false,
  "fixed_monthly_charge": 2507.73,
  "rates": [
    { "rate_per_kwh": 3.3638, "block_start_kwh": 0, "block_end_kwh": 500, "time_of_use": "Any", "season": "All Year" },
    { "rate_per_kwh": 2.9888, "block_start_kwh": 500, "block_end_kwh": null, "time_of_use": "Any", "season": "All Year" }
  ]
}

Extract ALL tariffs found. Be thorough and accurate.`;

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            { role: "system", content: `You are an expert electricity tariff data extractor for South African municipalities. 

CRITICAL ACCURACY RULES:
1. For IBT (block) tariffs: ALWAYS populate block_start_kwh and block_end_kwh for each rate
2. "<500kWh" = block 0-500, ">500kWh" = block 500-null
3. Never use time_of_use "Any" for IBT blocks - use "Any" but MUST have block ranges
4. Convert c/kWh to R/kWh (divide by 100)
5. Separate fixed charges from energy rates - fixed_monthly_charge is NOT a rate

Be meticulous. Every piece of data in the source must be captured accurately.` },
            { role: "user", content: extractPrompt }
          ],
          tools: [{
            type: "function",
            function: {
              name: "save_tariffs",
              description: "Save NERSA-compliant tariff data. Include voltage_level, reactive_energy_charge, capacity_kva, and customer_category per NERSA guidelines.",
              parameters: {
                type: "object",
                properties: {
                  tariffs: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        category: { type: "string", description: "Domestic, Commercial, Industrial, Agricultural, Public Lighting, or Other" },
                        customer_category: { type: "string", enum: ["Domestic", "Commercial", "Industrial", "Agriculture", "Street Lighting"], description: "NERSA customer classification" },
                        tariff_name: { type: "string", description: "Full tariff name from document" },
                        tariff_type: { type: "string", enum: ["Fixed", "IBT", "TOU"], description: "TOU if High/Low Demand rates or MV/HV supply, IBT if block rates, Fixed otherwise" },
                        voltage_level: { type: "string", enum: ["LV", "MV", "HV"], description: "LV=≤400V, MV=11kV/22kV, HV=≥44kV. Default LV for domestic" },
                        capacity_kva: { type: "number", description: "Connection capacity in kVA (e.g., 50, 100, 1000)" },
                        phase_type: { type: "string", enum: ["Single Phase", "Three Phase"] },
                        amperage_limit: { type: "string", description: "e.g., >20A, 60A, 100A" },
                        is_prepaid: { type: "boolean" },
                        fixed_monthly_charge: { type: "number", description: "Basic Charge per month in Rands (R/month). NOT an energy rate!" },
                        demand_charge_per_kva: { type: "number", description: "Per-amp or per-kVA charges in Rands (R/A/m or R/kVA). NOT an energy rate!" },
                        reactive_energy_charge: { type: "number", description: "Reactive energy charge in R/kVArh for power factor compensation" },
                        rates: {
                          type: "array",
                          description: "ONLY energy rates in R/kWh. Convert c/kWh to R/kWh by dividing by 100.",
                          items: {
                            type: "object",
                            properties: {
                              rate_per_kwh: { type: "number", description: "Energy rate in R/kWh (convert from c/kWh by dividing by 100)" },
                              block_start_kwh: { type: "number", description: "For IBT: start of block. <500kWh→0, >500kWh→500, 0-50kWh→0" },
                              block_end_kwh: { type: ["number", "null"], description: "For IBT: end of block. <500kWh→500, >500kWh→null, 0-50kWh→50" },
                              season: { type: "string", enum: ["All Year", "High/Winter", "Low/Summer"] },
                              time_of_use: { type: "string", enum: ["Any", "Peak", "Standard", "Off-Peak", "High Demand", "Low Demand"], description: "For IBT with blocks, use 'Any'" },
                              reactive_energy_charge: { type: "number", description: "Reactive energy charge for this TOU period if varies" }
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

      // Build map of existing tariffs for incremental updates
      const existingTariffMap = new Map(
        existingTariffs?.map(t => [
          `${t.name.toLowerCase()}|${((t.category as any)?.name || '').toLowerCase()}`,
          t
        ]) || []
      );

      const { data: categories } = await supabase.from("tariff_categories").select("id, name");
      const categoryMap = new Map(categories?.map(c => [c.name.toLowerCase(), c.id]) || []);

      let inserted = 0;
      let updated = 0;
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

          // Check if tariff already exists
          const tariffKey = `${tariff.tariff_name.toLowerCase()}|${tariff.category.toLowerCase()}`;
          const existingTariff = existingTariffMap.get(tariffKey);

          const tariffData = {
            name: tariff.tariff_name,
            municipality_id: muniData.id,
            category_id: categoryId,
            tariff_type: tariff.tariff_type,
            phase_type: tariff.phase_type || "Single Phase",
            fixed_monthly_charge: tariff.fixed_monthly_charge || 0,
            demand_charge_per_kva: tariff.demand_charge_per_kva || 0,
            is_prepaid: tariff.is_prepaid,
            amperage_limit: tariff.amperage_limit || null,
            voltage_level: tariff.voltage_level || "LV",
            reactive_energy_charge: tariff.reactive_energy_charge || 0,
            capacity_kva: tariff.capacity_kva || null,
            customer_category: tariff.customer_category || tariff.category,
          };

          let tariffId: string;

          if (existingTariff) {
            // Update existing tariff
            const { error: updateErr } = await supabase
              .from("tariffs")
              .update(tariffData)
              .eq("id", existingTariff.id);

            if (updateErr) {
              errors.push(`${tariff.tariff_name}: Update failed - ${updateErr.message}`);
              skipped++;
              continue;
            }

            tariffId = existingTariff.id;

            // Delete existing rates and re-insert (simpler than diffing rates)
            await supabase.from("tariff_rates").delete().eq("tariff_id", tariffId);
            updated++;
            console.log(`Updated existing tariff: ${tariff.tariff_name}`);
          } else {
            // Insert new tariff
            const { data: newTariff, error: tariffErr } = await supabase
              .from("tariffs")
              .insert(tariffData)
              .select("id")
              .single();

            if (tariffErr || !newTariff) {
              errors.push(`${tariff.tariff_name}: ${tariffErr?.message || "Insert failed"}`);
              skipped++;
              continue;
            }

            tariffId = newTariff.id;
            inserted++;
            console.log(`Inserted new tariff: ${tariff.tariff_name}`);
          }

          // Insert rates
          if (tariff.rates && tariffId) {
            for (const rate of tariff.rates) {
              await supabase.from("tariff_rates").insert({
                tariff_id: tariffId,
                rate_per_kwh: rate.rate_per_kwh,
                block_start_kwh: rate.block_start_kwh || 0,
                block_end_kwh: rate.block_end_kwh || null,
                season: rate.season || "All Year",
                time_of_use: rate.time_of_use || "Any",
                reactive_energy_charge: rate.reactive_energy_charge || null,
              });
            }
          }
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
          inserted,
          updated,
          skipped,
          existingCount: existingTariffSummary.length,
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
