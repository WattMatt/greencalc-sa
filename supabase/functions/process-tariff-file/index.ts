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
      
      if (fileType === "xlsx" || fileType === "xls") {
        // Use sheet names as municipality names (common pattern)
        municipalityNames = sheetNames.map(name => 
          name.replace(/\s*-\s*\d+\.?\d*%$/, '').trim()
        ).filter(name => name.length > 0);
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

      const savedMunicipalities: Array<{ id: string; name: string }> = [];
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
            if (existing) savedMunicipalities.push({ id: existing.id, name: existing.name });
            continue;
          }

          // Create new municipality
          const { data: newMuni, error } = await supabase
            .from("municipalities")
            .insert({ name: cleanName, province_id: provinceId })
            .select("id, name")
            .single();
          
          if (newMuni) {
            savedMunicipalities.push({ id: newMuni.id, name: newMuni.name });
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

EXTRACTION RULES:
1. Municipality: "${municipality}"
2. Categories: Domestic, Commercial, Industrial, Agricultural, Public Lighting
3. Tariff types:
   - "IBT" for block tariffs with Block 1, Block 2, etc.
   - "TOU" for time-of-use with Peak/Standard/Off-peak
   - "Fixed" for simple single rate
4. Extract ALL rates:
   - Basic charge (R/month) - convert R/day to R/month by *30
   - Energy rates (c/kWh) with block thresholds if IBT
   - Demand charges (R/kVA)
5. Phase: "Single Phase" or "Three Phase"
6. Amperage: from "15A", "60A", "100A" etc.
7. Prepaid: true if "Prepaid" mentioned

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
            { role: "system", content: "You are a data extraction expert for South African electricity tariffs. Extract complete and accurate tariff data for the specified municipality." },
            { role: "user", content: extractPrompt }
          ],
          tools: [{
            type: "function",
            function: {
              name: "save_tariffs",
              description: "Save extracted tariff data",
              parameters: {
                type: "object",
                properties: {
                  tariffs: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        category: { type: "string" },
                        tariff_name: { type: "string" },
                        tariff_type: { type: "string", enum: ["Fixed", "IBT", "TOU"] },
                        phase_type: { type: "string", enum: ["Single Phase", "Three Phase"] },
                        amperage_limit: { type: "string" },
                        is_prepaid: { type: "boolean" },
                        fixed_monthly_charge: { type: "number" },
                        demand_charge_per_kva: { type: "number" },
                        rates: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              rate_per_kwh: { type: "number" },
                              block_start_kwh: { type: "number" },
                              block_end_kwh: { type: "number" },
                              season: { type: "string", enum: ["All Year", "High/Winter", "Low/Summer"] },
                              time_of_use: { type: "string", enum: ["Any", "Peak", "Standard", "Off-Peak"] }
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
          JSON.stringify({ error: "AI extraction failed" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const aiData = await aiRes.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      
      if (!toolCall) {
        return new Response(
          JSON.stringify({ error: "AI did not return structured data" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let extractedTariffs: Omit<ExtractedTariff, 'municipality'>[];
      try {
        const args = JSON.parse(toolCall.function.arguments);
        extractedTariffs = args.tariffs;
        console.log(`AI extracted ${extractedTariffs.length} tariffs for ${municipality}`);
      } catch (e) {
        return new Response(
          JSON.stringify({ error: "Failed to parse extracted data" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

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
