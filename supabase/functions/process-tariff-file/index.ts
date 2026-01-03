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
  // Unbundled Eskom 2025-2026 fields
  is_unbundled?: boolean;
  tariff_family?: string;
  transmission_zone?: "Zone 0-300km" | "Zone 300-600km" | "Zone 600-900km" | "Zone >900km";
  generation_capacity_charge?: number;
  legacy_charge_per_kwh?: number;
  service_charge_per_day?: number;
  administration_charge_per_day?: number;
  rates: Array<{
    rate_per_kwh: number;
    block_start_kwh?: number;
    block_end_kwh?: number;
    season?: string;
    time_of_use?: string;
    reactive_energy_charge?: number;
    // Unbundled rate components
    network_charge_per_kwh?: number;
    ancillary_charge_per_kwh?: number;
    energy_charge_per_kwh?: number;
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
      console.log("PDF size:", fileData.size, "bytes");
      
      // Convert to base64 using Deno's built-in encoding (fast and safe)
      const uint8Array = new Uint8Array(await fileData.arrayBuffer());
      console.log("Uint8Array length:", uint8Array.length);
      
      // Use Deno's standard base64 encoding - much faster than manual conversion
      const { encode } = await import("https://deno.land/std@0.208.0/encoding/base64.ts");
      const base64 = encode(uint8Array);
      console.log("Base64 length:", base64.length);
      
      console.log("Sending PDF to AI vision...");
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

      console.log("AI vision response status:", visionRes.status);
      
      if (visionRes.ok) {
        try {
          const responseText = await visionRes.text();
          console.log("Raw response length:", responseText.length);
          const visionData = JSON.parse(responseText);
          extractedText = visionData.choices?.[0]?.message?.content || "";
          console.log("PDF text extracted, length:", extractedText.length);
        } catch (parseError) {
          console.error("Failed to parse AI response:", parseError);
          extractedText = "PDF extraction failed - AI response was invalid";
        }
      } else {
        const errorText = await visionRes.text();
        console.error("PDF extraction failed:", visionRes.status, errorText);
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
      
      // SPECIAL CASE: Eskom is a national utility, not bound by municipalities
      const isEskom = province.toLowerCase() === "eskom";
      
      // For Excel files, sheet names are often municipality names
      let municipalityNames: string[] = [];
      const sheetNameToMuni: Record<string, string> = {};
      
      if (isEskom) {
        // Eskom gets a single "Eskom Direct" entry - all tariffs go under it
        municipalityNames = ["Eskom Direct"];
        console.log("Eskom detected - using single 'Eskom Direct' entity");
      } else if (fileType === "xlsx" || fileType === "xls") {
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

      // Get municipality ID, reprise count and existing tariffs first
      const { data: muniData } = await supabase
        .from("municipalities")
        .select("id, reprise_count")
        .ilike("name", municipality)
        .single();

      if (!muniData) {
        return new Response(
          JSON.stringify({ error: `Municipality "${municipality}" not found in database` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Get current reprise count for batch selection
      const repriseCount = muniData.reprise_count || 0;

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

      // SPECIAL CASE: Check if this is Eskom extraction
      const isEskomExtraction = municipality.toLowerCase() === "eskom direct";
      
      // Get data for this specific municipality (or selective data for Eskom)
      let municipalityText = "";
      
      // For Eskom, we'll do BATCHED extraction by category to avoid WORKER_LIMIT errors
      // Each batch processes specific sheets for one category
      // ESKOM 2025-2026 TARIFF CATEGORIES (unbundled structure with GCC)
      // Sheet names in file have "NLA" (Non-Local Authority) and "Munic" suffixes
      const eskomBatches = isEskomExtraction ? [
        // 1. Urban Large Power User (LPU) Tariffs - NMD > 1 MVA
        { 
          name: "Megaflex", 
          sheets: ["megaflex nla", "megaflex gen", "megaflex"],
          description: "Urban TOU for large customers >1MVA NMD. Seasonally differentiated energy + GCC (R/kVA) + Transmission/Distribution network charges + reactive energy charge."
        },
        { 
          name: "Miniflex", 
          sheets: ["miniflex nla", "miniflex"],
          description: "Urban TOU for high-load factor customers 25kVA-5MVA NMD. For customers without grid-tied generation."
        },
        { 
          name: "Nightsave", 
          sheets: ["nightsave urban", "nightsave rural", "nightsave"],
          description: "Urban/Rural seasonally differentiated TOU. Energy demand charges based on peak period chargeable demand."
        },
        // 2. Urban Small Power User (SPU) and Commercial
        { 
          name: "Businessrate", 
          sheets: ["businessrate nla", "businessrate"],
          description: "Urban commercial/non-commercial (schools, clinics) up to 100kVA NMD. Single c/kWh + daily fixed charges for network capacity and retail services."
        },
        { 
          name: "Public Lighting", 
          sheets: ["public lighting nla", "public lighting munic", "public lighting"],
          description: "Non-metered urban tariff. Fixed charges based on light count and wattage (All Night = 333.3 hours/month)."
        },
        // 3. Residential Tariffs (No IBT structure for FY2026)
        { 
          name: "Homepower", 
          sheets: ["homepower nla", "homepower"],
          description: "Standard urban residential up to 100kVA. Unbundled: energy + network + retail (service/admin) charges. No IBT for 2025-2026."
        },
        { 
          name: "Homeflex", 
          sheets: ["homeflex nla", "homeflex"],
          description: "Residential TOU mandatory for grid-tied generation. Supports net-billing (Gen-offset) for export credits."
        },
        { 
          name: "Homelight", 
          sheets: ["homelight nla", "homelight"],
          description: "Subsidized tariff for low-usage households. ONLY tariff with all-inclusive single c/kWh rate (no separate GCC)."
        },
        // 4. Rural and Agricultural Tariffs
        { 
          name: "Ruraflex", 
          sheets: ["ruraflex nla", "ruraflex gen", "ruraflex"],
          description: "Rural TOU from 16kVA NMD, supply voltage ≤22kV (or 33kV in specific areas). For agricultural customers."
        },
        { 
          name: "Landrate", 
          sheets: ["landrate nla", "landrate"],
          description: "Conventional rural tariff up to 100kVA at <500V. Single energy charge + daily network/retail charges."
        },
        // 5. Municipal (Local Authority) Bulk Tariffs - Consolidated for 2025-2026
        { 
          name: "Municflex", 
          sheets: ["municflex"],
          description: "NEW bulk TOU for local authorities from 16kVA NMD. Replaces Megaflex/Miniflex for municipalities."
        },
        { 
          name: "Municrate", 
          sheets: ["municrate"],
          description: "NEW bulk tariff for local authority up to 100kVA. Consolidates previous commercial/residential bulk rates."
        },
        // 6. WEPS (Wholesale)
        { 
          name: "WEPS", 
          sheets: ["weps nla", "weps munic", "weps"],
          description: "Wholesale Electricity Pricing System. Local/Non-local authority variants for bulk energy purchase."
        },
        // 7. Generator and Wheeling Tariffs
        { 
          name: "Generator Tariffs", 
          sheets: ["gen-offset", "gen reconcil", "tuos nla", "duos nla"],
          description: "Use-of-System charges for generators (TUoS/DUoS). Gen-offset for net-billing/offset. Includes excess NCC charges."
        },
        // 8. Excess NCC
        { 
          name: "Excess NCC", 
          sheets: ["excess ncc nla", "excess ncc munic", "excess ncc"],
          description: "Excess Network Capacity Charges for NLA and Municipal customers."
        }
      ] : [];
      
      // Determine which batch to process using database tracking
      let currentBatchIndex = 0;
      
      if (isEskomExtraction) {
        // Initialize batch status records if not exist
        const { data: existingBatches } = await supabase
          .from("eskom_batch_status")
          .select("batch_index, status")
          .eq("municipality_id", muniData.id)
          .order("batch_index");
        
        if (!existingBatches || existingBatches.length === 0) {
          // Create batch status records for all 15 batches
          const batchRecords = eskomBatches.map((batch, index) => ({
            municipality_id: muniData.id,
            batch_index: index,
            batch_name: batch.name,
            status: "pending"
          }));
          
          await supabase.from("eskom_batch_status").insert(batchRecords);
          console.log(`Created ${batchRecords.length} batch status records for Eskom`);
        }
        
        // Find first incomplete batch
        const { data: nextBatch } = await supabase
          .from("eskom_batch_status")
          .select("batch_index, batch_name, status")
          .eq("municipality_id", muniData.id)
          .neq("status", "completed")
          .order("batch_index")
          .limit(1)
          .single();
        
        if (nextBatch) {
          currentBatchIndex = nextBatch.batch_index;
          console.log(`Eskom batch tracking - processing batch ${currentBatchIndex + 1}/${eskomBatches.length}: ${nextBatch.batch_name}`);
          
          // Mark as in_progress
          await supabase
            .from("eskom_batch_status")
            .update({ status: "in_progress", updated_at: new Date().toISOString() })
            .eq("municipality_id", muniData.id)
            .eq("batch_index", currentBatchIndex);
        } else {
          // All batches complete
          console.log("All Eskom batches already completed");
          
          // Get completion summary
          const { data: completedBatches } = await supabase
            .from("eskom_batch_status")
            .select("batch_name, tariffs_extracted")
            .eq("municipality_id", muniData.id)
            .eq("status", "completed");
          
          const totalTariffs = completedBatches?.reduce((sum, b) => sum + (b.tariffs_extracted || 0), 0) || 0;
          
          return new Response(
            JSON.stringify({ 
              allComplete: true,
              message: "All 15 Eskom batches have been extracted",
              totalBatches: eskomBatches.length,
              completedBatches: eskomBatches.length,
              totalTariffs
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      
      if (isEskomExtraction) {
        // For Eskom, use selective sheets based on current batch
        console.log("Eskom extraction - available sheets:", sheetNames.join(", "));
        
        const currentBatch = eskomBatches[currentBatchIndex];
        
        // Filter sheets for this batch - more flexible matching
        const batchSheets = sheetNames.filter(name => {
          const lower = name.toLowerCase().trim();
          return currentBatch.sheets.some(keyword => {
            const keyLower = keyword.toLowerCase();
            return lower.includes(keyLower);
          });
        });
        
        console.log(`Batch "${currentBatch.name}" - matched sheets:`, batchSheets.join(", ") || "none");
        
        // If no specific sheets found, skip this batch
        if (batchSheets.length === 0) {
          console.log(`No sheets match batch "${currentBatch.name}" - skipping`);
          return new Response(
            JSON.stringify({ 
              inserted: 0, 
              updated: 0, 
              skipped: 0, 
              confidence: 100,
              message: `No sheets found for ${currentBatch.name} batch`
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        const sheetsToUse = batchSheets.slice(0, 5);
        console.log(`Batch "${currentBatch.name}" - using sheets:`, sheetsToUse.join(", "));
        
        // Build text from selected sheets - increase to 100 rows per sheet
        for (const sheetName of sheetsToUse) {
          if (sheetData[sheetName]) {
            municipalityText += `\n=== SHEET: ${sheetName} ===\n`;
            municipalityText += sheetData[sheetName].slice(0, 100).map(row => 
              row.filter(cell => cell != null && cell !== "").join(" | ")
            ).filter(row => row.trim()).join("\n");
          }
        }
        
        // Add batch context to help AI focus
        municipalityText = `BATCH FOCUS: ${currentBatch.name} tariffs\n${currentBatch.description}\n\n${municipalityText}`;
        
        console.log("Eskom batch text length:", municipalityText.length);
        
        // For PDF, append limited content
        if (extractedText && fileType === "pdf") {
          municipalityText = extractedText.slice(0, 12000);
        }
      } else if (fileType === "xlsx" || fileType === "xls") {
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

      // Get current batch info for Eskom
      const currentBatch = isEskomExtraction ? eskomBatches[currentBatchIndex] : null;
      
      // Use different extraction prompt for Eskom vs regular municipalities
      const extractPrompt = isEskomExtraction 
        ? `TASK: Extract ${currentBatch?.name || "Eskom"} tariffs from Eskom 2025-2026 tariff data.

BATCH FOCUS: ${currentBatch?.name || "All"} - ${currentBatch?.description || "Extract all tariffs"}
Reprise #${repriseCount} - Batch ${currentBatchIndex + 1}/${eskomBatches.length}

SOURCE DATA:
${municipalityText.slice(0, 15000)}
${existingContext}

=== ESKOM 2025-2026 UNBUNDLED TARIFF STRUCTURE ===

Eskom's 2025-2026 tariffs are FULLY UNBUNDLED. You MUST extract these components:

**TARIFF-LEVEL UNBUNDLED FIELDS (REQUIRED for all Eskom tariffs):**
- is_unbundled: true (ALWAYS set this for Eskom 2025-26)
- tariff_family: "${currentBatch?.name || "Megaflex"}" (the tariff family being processed)
- transmission_zone: "Zone 0-300km", "Zone 300-600km", "Zone 600-900km", or "Zone >900km" (based on distance from Johannesburg)
- generation_capacity_charge: R/kVA/month (GCC - the new capacity charge, NOT for Homelight)
- legacy_charge_per_kwh: R/kWh (government energy procurement charge - convert from c/kWh)
- service_charge_per_day: R/day (daily service/retail fee)
- administration_charge_per_day: R/day (daily admin fee)

**RATE-LEVEL UNBUNDLED FIELDS (extract if available):**
For each TOU rate, try to extract the separate components:
- rate_per_kwh: Total combined energy rate in R/kWh
- network_charge_per_kwh: Network component (Transmission + Distribution) in R/kWh
- energy_charge_per_kwh: Pure energy component (excluding legacy, network) in R/kWh
- ancillary_charge_per_kwh: Ancillary services component in R/kWh

=== EXTRACTION FOCUS: ${currentBatch?.name?.toUpperCase() || "ESKOM TARIFFS"} ===

Extract ALL variants of ${currentBatch?.name || "Eskom"} tariffs:

**For TOU tariffs (Megaflex, Miniflex, Nightsave, Ruraflex, Municflex):**
- Extract 6 energy rates: Peak/Standard/Off-Peak × High Demand(Winter)/Low Demand(Summer)
- Look for "Active Energy" tables with c/kWh values
- GCC → generation_capacity_charge (R/kVA/month)
- Network Access Charge → demand_charge_per_kva (R/kVA)
- Service/Admin/Retail charges → service_charge_per_day and administration_charge_per_day
- Reactive energy charge (kVArh) for power factor during high demand season

**For Fixed tariffs (Businessrate, Homepower, Landrate, Municrate):**
- Single energy rate + daily fixed charges
- Extract network capacity and retail service charges separately

**For Subsidized tariffs (Homelight, Landlight):**
- All-inclusive single c/kWh rate (NO separate GCC - is_unbundled can still be true but no GCC)
- No fixed charges for prepaid variants

=== KEY RULES ===
1. RATE CONVERSION: c/kWh → R/kWh (divide by 100). 392.75 c/kWh → 3.9275 R/kWh
2. VOLTAGE LEVELS: LV (<500V), MV (500V-66kV), HV (>66kV)
3. Include transmission zone in tariff name AND set transmission_zone field
4. Include Local/Non-local authority variants
5. Include Key Customer variants for large power users
6. Note NMD (Notified Maximum Demand) requirements in tariff_name
7. SET is_unbundled: true for ALL Eskom tariffs!

Extract EVERY ${currentBatch?.name || ""} variant with ALL unbundled components!`
        : `TASK: Extract electricity tariffs for "${municipality}" municipality.

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

3. IBT BLOCK PARSING (CRITICAL - DO NOT USE "Any" WITHOUT BLOCK RANGES):
   Parse ALL consumption-based rate patterns:
   
   FORMAT A: "Block N (X - Y)kWh" or "Block N (X-Y)kWh"
   - "Block 1 (0 - 50)kWh" → block_start_kwh: 0, block_end_kwh: 50
   - "Block 2 (51 - 350)kWh" → block_start_kwh: 51, block_end_kwh: 350
   - "Block 3 (351 - 600)kWh" → block_start_kwh: 351, block_end_kwh: 600
   - "Block 4 (>600)kWh" or "Block 4 (600+)kWh" → block_start_kwh: 600, block_end_kwh: null
   
   FORMAT B: Range notation
   - "<500kWh" or "≤500kWh" → block_start_kwh: 0, block_end_kwh: 500
   - ">500kWh" or "≥500kWh" → block_start_kwh: 500, block_end_kwh: null
   - "0-50kWh" → block_start_kwh: 0, block_end_kwh: 50
   - "51-350kWh" → block_start_kwh: 51, block_end_kwh: 350
   
   MANDATORY: For IBT tariffs, EVERY rate MUST have block_start_kwh and block_end_kwh!
   DO NOT extract IBT rates without block ranges - that's incorrect extraction!

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

=== EXAMPLE IBT EXTRACTION (4 BLOCKS) ===
Source data:
  "Domestic Conventional 20A & 60A"
  "Block 1 (0 - 50)kWh: 172.40"
  "Block 2 (51 - 350)kWh: 221.44"
  "Block 3 (351 - 600)kWh: 311.35"
  "Block 4 (>600)kWh: 367.37"
  "Basic Charge (R/month): 500.29"

Correct extraction:
{
  "category": "Domestic",
  "tariff_name": "Domestic Conventional 20A & 60A",
  "tariff_type": "IBT",
  "phase_type": "Single Phase",
  "is_prepaid": false,
  "fixed_monthly_charge": 500.29,
  "rates": [
    { "rate_per_kwh": 1.7240, "block_start_kwh": 0, "block_end_kwh": 50, "time_of_use": "Any", "season": "All Year" },
    { "rate_per_kwh": 2.2144, "block_start_kwh": 51, "block_end_kwh": 350, "time_of_use": "Any", "season": "All Year" },
    { "rate_per_kwh": 3.1135, "block_start_kwh": 351, "block_end_kwh": 600, "time_of_use": "Any", "season": "All Year" },
    { "rate_per_kwh": 3.6737, "block_start_kwh": 600, "block_end_kwh": null, "time_of_use": "Any", "season": "All Year" }
  ]
}

=== TOU TARIFF EXTRACTION (CRITICAL - RATES ARE MANDATORY!) ===

**CRITICAL**: TOU tariffs MUST have energy rates in the rates array! A TOU tariff with empty rates is INVALID and will be rejected!

TOU tariffs require energy rates (c/kWh converted to R/kWh) for EACH combination:
- Seasons: "High/Winter" (June-Aug) AND "Low/Summer" (Sep-May)  
- Periods: "Peak", "Standard", "Off-Peak"

That's 6 rate entries minimum for a complete TOU tariff!

Look for these patterns in Eskom/source data:
- "Active Energy" tables with c/kWh rates by season and TOU period
- "Peak", "Standard", "Off-Peak" column headers
- "High Demand Season" vs "Low Demand Season" sections

Example TOU rates array (REQUIRED - not optional!):
[
  { "rate_per_kwh": 3.50, "season": "High/Winter", "time_of_use": "Peak" },
  { "rate_per_kwh": 1.80, "season": "High/Winter", "time_of_use": "Standard" },
  { "rate_per_kwh": 0.95, "season": "High/Winter", "time_of_use": "Off-Peak" },
  { "rate_per_kwh": 2.10, "season": "Low/Summer", "time_of_use": "Peak" },
  { "rate_per_kwh": 1.20, "season": "Low/Summer", "time_of_use": "Standard" },
  { "rate_per_kwh": 0.75, "season": "Low/Summer", "time_of_use": "Off-Peak" }
]

**VALIDATION**: If you extract a TOU tariff, it MUST have at least 3 rates. If you cannot find energy rates, DO NOT mark it as TOU!

=== ESKOM TARIFF SPECIFICS (FOR PDF EXTRACTION) ===
Eskom tariffs (Megaflex, Miniflex, Nightsave, Ruraflex) have:
- **Active Energy charges** (c/kWh) - THESE ARE THE RATES TO EXTRACT!
- Network Access Charge (R/kVA/month) → demand_charge_per_kva  
- Service charge (R/account/day) → fixed_monthly_charge (convert to monthly)

Find the Active Energy table showing Peak/Standard/Off-Peak by High/Low Demand Season!

=== VOLTAGE LEVEL DETECTION ===
- "Medium Voltage" or "MV" or "11kV/22kV" → voltage_level: "MV"
- "High Voltage" or "HV" or ">66kV" → voltage_level: "HV"  
- "Low Voltage" or "LV" or "<500V" → voltage_level: "LV"

=== PHASE TYPE RULES ===
- Bulk supply/MV/HV tariffs → phase_type: "Three Phase"
- "Three Phase" in name → phase_type: "Three Phase"
- Domestic ≤60A → phase_type: "Single Phase"

=== DEMAND CHARGE HANDLING ===
- "Network Access Charge" or "R/kVA" → demand_charge_per_kva

=== PRECISION RULE ===
Preserve EXACT values - convert c/kWh to R/kWh by dividing by 100.
If source says 392.75 c/kWh → extract as 3.9275 R/kWh

Extract ALL tariffs with their COMPLETE rate data!`;

      // Retry logic for AI call - handles connection timeouts and empty responses
      const MAX_RETRIES = 3;
      let aiData = null;
      let lastError = null;
      
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          console.log(`Extract AI call attempt ${attempt}/${MAX_RETRIES}`);
          
          const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${lovableApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-pro",
              messages: [
                { role: "system", content: "You are an expert at extracting South African electricity tariff data from documents. Focus on accuracy." },
                { role: "user", content: extractPrompt }
              ],
              tools: [{
                type: "function",
                function: {
                  name: "save_tariffs",
                  description: "Save extracted tariffs. Mark each with action: 'new' or 'update'",
                  parameters: {
                    type: "object",
                    properties: {
                      confidence_score: { 
                        type: "integer", 
                        minimum: 0, 
                        maximum: 100,
                        description: "Your confidence in the extraction accuracy (0-100). 100 = completely certain all tariffs captured correctly, 50 = moderate uncertainty, 0 = very uncertain" 
                      },
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
                            // Unbundled Eskom 2025-2026 fields
                            is_unbundled: { type: "boolean", description: "True for Eskom 2025-26 unbundled tariffs with separate GCC, legacy, network charges" },
                            tariff_family: { type: "string", enum: ["Megaflex", "Miniflex", "Homepower", "Homeflex", "Homelight", "Nightsave Urban Large", "Nightsave Urban Small", "Ruraflex", "Landrate", "Nightsave Rural", "Landlight", "Municflex", "Municrate", "Transit", "Gen-wheeling"], description: "Eskom tariff family name" },
                            transmission_zone: { type: "string", enum: ["Zone 0-300km", "Zone 300-600km", "Zone 600-900km", "Zone >900km"], description: "Distance from Johannesburg for transmission pricing" },
                            generation_capacity_charge: { type: "number", description: "GCC in R/kVA/month - Eskom capacity charge" },
                            legacy_charge_per_kwh: { type: "number", description: "Legacy charge in c/kWh for government energy programs (convert to R)" },
                            service_charge_per_day: { type: "number", description: "Daily service charge in R/day" },
                            administration_charge_per_day: { type: "number", description: "Daily administration charge in R/day" },
                            rates: {
                              type: "array",
                              description: "ONLY energy rates in R/kWh. Convert c/kWh to R/kWh by dividing by 100.",
                              items: {
                                type: "object",
                                properties: {
                                  rate_per_kwh: { type: "number", description: "Total energy rate in R/kWh (convert from c/kWh by dividing by 100)" },
                                  block_start_kwh: { type: "number", description: "For IBT: start of block. <500kWh→0, >500kWh→500, 0-50kWh→0" },
                                  block_end_kwh: { type: ["number", "null"], description: "For IBT: end of block. <500kWh→500, >500kWh→null, 0-50kWh→50" },
                                  season: { type: "string", enum: ["All Year", "High/Winter", "Low/Summer"] },
                                  time_of_use: { type: "string", enum: ["Any", "Peak", "Standard", "Off-Peak", "High Demand", "Low Demand"], description: "For IBT with blocks, use 'Any'" },
                                  reactive_energy_charge: { type: "number", description: "Reactive energy charge for this TOU period if varies" },
                                  // Unbundled rate components
                                  network_charge_per_kwh: { type: "number", description: "Network component in R/kWh (Transmission + Distribution)" },
                                  ancillary_charge_per_kwh: { type: "number", description: "Ancillary services in R/kWh" },
                                  energy_charge_per_kwh: { type: "number", description: "Pure energy component in R/kWh (excluding legacy, network)" }
                                },
                                required: ["rate_per_kwh"]
                              }
                            }
                          },
                          required: ["category", "tariff_name", "tariff_type", "is_prepaid", "rates"]
                        }
                      }
                    },
                    required: ["confidence_score", "tariffs"]
                  }
                }
              }],
              tool_choice: { type: "function", function: { name: "save_tariffs" } }
            }),
          });

          if (!aiRes.ok) {
            const errText = await aiRes.text();
            throw new Error(`AI returned ${aiRes.status}: ${errText}`);
          }

          const responseData = await aiRes.json();
          console.log("AI response structure:", JSON.stringify({
            hasChoices: !!responseData.choices,
            choiceCount: responseData.choices?.length,
            hasToolCalls: !!responseData.choices?.[0]?.message?.tool_calls,
            toolCallCount: responseData.choices?.[0]?.message?.tool_calls?.length,
            hasContent: !!responseData.choices?.[0]?.message?.content
          }));
          
          // Check if we got a valid tool call response
          const toolCall = responseData.choices?.[0]?.message?.tool_calls?.[0];
          const content = responseData.choices?.[0]?.message?.content;
          
          if (!toolCall && !content) {
            // Empty response - retry
            throw new Error("AI returned empty response (no tool call, no content)");
          }
          
          aiData = responseData;
          console.log(`Extract AI call succeeded on attempt ${attempt}`);
          break; // Success - exit retry loop
          
        } catch (error) {
          lastError = error;
          console.error(`Extract AI attempt ${attempt} failed:`, error);
          
          if (attempt < MAX_RETRIES) {
            // Wait before retrying (exponential backoff: 2s, 4s)
            const waitMs = 2000 * attempt;
            console.log(`Waiting ${waitMs}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitMs));
          }
        }
      }
      
      if (!aiData) {
        console.error("All extract AI attempts failed:", lastError);
        return new Response(
          JSON.stringify({ 
            error: "AI extraction failed after 3 attempts - please retry.",
            details: lastError instanceof Error ? lastError.message : "Connection timeout"
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      
      let extractedTariffs: Omit<ExtractedTariff, 'municipality'>[];
      let confidenceScore: number | null = null;
      
      if (toolCall) {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          extractedTariffs = args.tariffs;
          confidenceScore = args.confidence_score ?? null;
          console.log(`AI confidence score: ${confidenceScore}`);
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
            JSON.stringify({ error: "AI returned empty response after retries" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      
      if (!extractedTariffs || extractedTariffs.length === 0) {
        console.log(`No tariffs found in source data for ${municipality}`);
        // Return success with zero tariffs - this is a valid outcome for some sheets
        return new Response(
          JSON.stringify({ 
            success: true,
            municipality,
            inserted: 0, 
            updated: 0, 
            skipped: 0, 
            total: 0,
            message: "No tariffs found in source data - sheet may be empty or contain non-tariff data"
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
            // Unbundled Eskom 2025-2026 fields
            is_unbundled: tariff.is_unbundled || false,
            tariff_family: tariff.tariff_family || null,
            transmission_zone: tariff.transmission_zone || null,
            generation_capacity_charge: tariff.generation_capacity_charge || null,
            legacy_charge_per_kwh: tariff.legacy_charge_per_kwh || null,
            service_charge_per_day: tariff.service_charge_per_day || null,
            administration_charge_per_day: tariff.administration_charge_per_day || null,
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
                // Unbundled rate components
                network_charge_per_kwh: rate.network_charge_per_kwh || null,
                ancillary_charge_per_kwh: rate.ancillary_charge_per_kwh || null,
                energy_charge_per_kwh: rate.energy_charge_per_kwh || null,
              });
            }
          }
        } catch (e) {
          errors.push(`${tariff.tariff_name}: ${e instanceof Error ? e.message : "Unknown error"}`);
          skipped++;
        }
      }

      // Create extraction run record
      const { data: runRecord } = await supabase
        .from("extraction_runs")
        .insert({
          municipality_id: muniData.id,
          run_type: "extraction",
          tariffs_found: extractedTariffs.length,
          tariffs_inserted: inserted,
          tariffs_updated: updated,
          tariffs_skipped: skipped,
          ai_confidence: confidenceScore,
          status: "completed",
          completed_at: new Date().toISOString()
        })
        .select("id")
        .single();

      // Update municipality summary stats
      const { count: totalTariffs } = await supabase
        .from("tariffs")
        .select("*", { count: "exact", head: true })
        .eq("municipality_id", muniData.id);

      await supabase
        .from("municipalities")
        .update({
          extraction_status: "done",
          extraction_error: null,
          extraction_score: Math.round((inserted + updated) / Math.max(extractedTariffs.length, 1) * 100),
          ai_confidence: confidenceScore,
          total_tariffs: totalTariffs || 0,
          last_extraction_at: new Date().toISOString()
        })
        .eq("id", muniData.id);

      // Update Eskom batch status if applicable
      const isEskomMuni = municipality.toLowerCase() === "eskom direct";
      let batchProgress = null;
      
      if (isEskomMuni) {
        // Get current batch info from tracking table
        const { data: currentBatchInfo } = await supabase
          .from("eskom_batch_status")
          .select("batch_index, batch_name")
          .eq("municipality_id", muniData.id)
          .eq("status", "in_progress")
          .single();
        
        if (currentBatchInfo) {
          // Mark current batch as completed
          await supabase
            .from("eskom_batch_status")
            .update({ 
              status: "completed", 
              tariffs_extracted: inserted + updated,
              updated_at: new Date().toISOString() 
            })
            .eq("municipality_id", muniData.id)
            .eq("batch_index", currentBatchInfo.batch_index);
          
          console.log(`Marked batch ${currentBatchInfo.batch_index + 1} (${currentBatchInfo.batch_name}) as completed with ${inserted + updated} tariffs`);
          
          // Get overall progress
          const { count: completedCount } = await supabase
            .from("eskom_batch_status")
            .select("*", { count: "exact", head: true })
            .eq("municipality_id", muniData.id)
            .eq("status", "completed");
          
          const { count: totalBatches } = await supabase
            .from("eskom_batch_status")
            .select("*", { count: "exact", head: true })
            .eq("municipality_id", muniData.id);
          
          batchProgress = {
            currentBatch: currentBatchInfo.batch_index + 1,
            currentBatchName: currentBatchInfo.batch_name,
            completedBatches: completedCount || 0,
            totalBatches: totalBatches || 15,
            allComplete: (completedCount || 0) >= (totalBatches || 15)
          };
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
          confidence: confidenceScore,
          runId: runRecord?.id,
          errors: errors.slice(0, 20),
          ...(batchProgress && { batchProgress })
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PHASE 4: Reprise - second AI pass to catch nuances
    if (action === "reprise") {
      if (!municipality) {
        return new Response(
          JSON.stringify({ error: "Municipality name is required for reprise" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Running reprise pass for municipality:", municipality);

      // Get municipality ID and existing tariffs
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

      // Fetch all current tariffs with rates
      const { data: currentTariffs } = await supabase
        .from("tariffs")
        .select(`
          id, name, tariff_type, phase_type, amperage_limit, is_prepaid,
          fixed_monthly_charge, demand_charge_per_kva, voltage_level,
          reactive_energy_charge, capacity_kva, customer_category,
          category:tariff_categories(name),
          tariff_rates(rate_per_kwh, block_start_kwh, block_end_kwh, season, time_of_use)
        `)
        .eq("municipality_id", muniData.id);

      // Get raw source data
      let municipalityText = "";
      if (fileType === "xlsx" || fileType === "xls") {
        const matchingSheet = sheetNames.find(name => 
          name.toLowerCase().includes(municipality.toLowerCase()) ||
          municipality.toLowerCase().includes(name.replace(/\s*-\s*\d+\.?\d*%$/, '').toLowerCase())
        );
        
        if (matchingSheet && sheetData[matchingSheet]) {
          municipalityText = `=== ${matchingSheet} ===\n` + 
            sheetData[matchingSheet].slice(0, 250).map(row => 
              row.filter(cell => cell != null && cell !== "").join(" | ")
            ).filter(row => row.trim()).join("\n");
        }
      } else {
        municipalityText = extractedText;
      }

      // Build current extraction summary
      const currentSummary = currentTariffs?.map(t => ({
        name: t.name,
        category: (t.category as any)?.name || "Unknown",
        tariff_type: t.tariff_type,
        phase_type: t.phase_type,
        amperage_limit: t.amperage_limit,
        is_prepaid: t.is_prepaid,
        fixed_monthly_charge: t.fixed_monthly_charge,
        demand_charge_per_kva: t.demand_charge_per_kva,
        rates: t.tariff_rates
      })) || [];

      const reprisePrompt = `REPRISE EXTRACTION: Review and refine the tariff extraction for "${municipality}".

=== ORIGINAL SOURCE DATA ===
${municipalityText.slice(0, 12000)}

=== CURRENT EXTRACTION (from first pass) ===
${JSON.stringify(currentSummary, null, 2)}

=== YOUR TASK ===
Compare the source data CAREFULLY against the current extraction and identify:

1. **TOU TARIFFS WITH EMPTY RATES** (CRITICAL!): Any TOU tariff in the extraction that has empty or missing rates array. TOU tariffs MUST have Peak/Standard/Off-Peak energy rates for both High/Winter and Low/Summer seasons. This is the MOST COMMON issue!
2. MISSED TARIFFS: Any tariffs in the source that are completely missing from the extraction
3. INCORRECT VALUES: Any rates, charges, or values that don't match the source
4. MISSING BLOCKS: IBT tariffs that should have multiple blocks but don't
5. WRONG TARIFF TYPE: Tariffs misclassified (e.g., IBT classified as Fixed)
6. MISSING DETAILS: Phase type, voltage level, amperage limits that should be set

For each issue found, provide the CORRECTED tariff data with COMPLETE rates.

If the extraction is accurate and complete (all TOU tariffs have rates!), return an empty tariffs array.

=== CRITICAL CHECK: TOU RATES ===
For Eskom tariffs (Megaflex, Miniflex, Nightsave, Ruraflex), find the "Active Energy" rates in c/kWh.
Each TOU tariff MUST have rates like:
- High Demand Season: Peak, Standard, Off-Peak (3 rates)
- Low Demand Season: Peak, Standard, Off-Peak (3 rates)
Convert c/kWh to R/kWh by dividing by 100.

=== IBT BLOCK CHECK ===
- "<500kWh" should be block 0-500
- ">500kWh" should be block 500-null
- Each block needs its own rate entry`;

      // Retry logic for AI call - handles connection timeouts
      const MAX_RETRIES = 3;
      let aiData = null;
      let lastError = null;
      
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          console.log(`Reprise AI call attempt ${attempt}/${MAX_RETRIES}`);
          
          const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${lovableApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-pro",
              messages: [
                { role: "system", content: `You are an expert electricity tariff auditor for South African municipalities. 
Your job is to VERIFY extractions against source data and find discrepancies.

Be meticulous. Check:
- Every rate value matches the source (remember c/kWh → R/kWh conversion: divide by 100)
- Block ranges are correct for IBT tariffs  
- Fixed charges (R/month) are separated from energy rates (R/kWh)
- No tariffs are missing from the extraction

Only report issues - if everything is correct, return empty tariffs array.` },
                { role: "user", content: reprisePrompt }
              ],
              tools: [{
                type: "function",
                function: {
                  name: "report_corrections",
                  description: "Report tariffs that need to be added or corrected",
                  parameters: {
                    type: "object",
                    properties: {
                      analysis: { type: "string", description: "Brief summary of issues found (or 'No issues found')" },
                      confidence_score: { 
                        type: "integer", 
                        minimum: 0, 
                        maximum: 100,
                        description: "Your confidence in the accuracy of the CURRENT extraction after review (0-100). 100 = fully accurate, 0 = many issues" 
                      },
                      tariffs: {
                        type: "array",
                        description: "Tariffs to add or update. Empty if extraction is accurate.",
                        items: {
                          type: "object",
                          properties: {
                            action: { type: "string", enum: ["add", "update"], description: "Whether to add new or update existing" },
                            existing_name: { type: "string", description: "For updates: the name of the existing tariff to update" },
                            category: { type: "string" },
                            tariff_name: { type: "string" },
                            tariff_type: { type: "string", enum: ["Fixed", "IBT", "TOU"] },
                            phase_type: { type: "string", enum: ["Single Phase", "Three Phase"] },
                            amperage_limit: { type: "string" },
                            is_prepaid: { type: "boolean" },
                            fixed_monthly_charge: { type: "number" },
                            demand_charge_per_kva: { type: "number" },
                            voltage_level: { type: "string", enum: ["LV", "MV", "HV"] },
                            customer_category: { type: "string" },
                            rates: {
                              type: "array",
                              items: {
                                type: "object",
                                properties: {
                                  rate_per_kwh: { type: "number" },
                                  block_start_kwh: { type: "number" },
                                  block_end_kwh: { type: ["number", "null"] },
                                  season: { type: "string" },
                                  time_of_use: { type: "string" }
                                },
                                required: ["rate_per_kwh"]
                              }
                            }
                          },
                          required: ["action", "category", "tariff_name", "tariff_type", "is_prepaid", "rates"]
                        }
                      }
                    },
                    required: ["analysis", "confidence_score", "tariffs"]
                  }
                }
              }],
              tool_choice: { type: "function", function: { name: "report_corrections" } }
            }),
          });

          if (!aiRes.ok) {
            const errText = await aiRes.text();
            throw new Error(`AI returned ${aiRes.status}: ${errText}`);
          }

          const responseData = await aiRes.json();
          
          // Check if we got a valid tool call response
          const toolCall = responseData.choices?.[0]?.message?.tool_calls?.[0];
          
          if (!toolCall) {
            // Empty response - retry
            throw new Error("AI returned empty response (no tool call)");
          }
          
          aiData = responseData;
          console.log(`Reprise AI call succeeded on attempt ${attempt}`);
          break; // Success - exit retry loop
          
        } catch (error) {
          lastError = error;
          console.error(`Reprise AI attempt ${attempt} failed:`, error);
          
          if (attempt < MAX_RETRIES) {
            // Wait before retrying (exponential backoff: 2s, 4s)
            const waitMs = 2000 * attempt;
            console.log(`Waiting ${waitMs}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitMs));
          }
        }
      }
      
      if (!aiData) {
        console.error("All reprise AI attempts failed:", lastError);
        return new Response(
          JSON.stringify({ 
            error: "AI response failed after 3 attempts - please retry.",
            details: lastError instanceof Error ? lastError.message : "Connection timeout"
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

      let analysis, repriseConfidence, corrections;
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        analysis = parsed.analysis;
        repriseConfidence = parsed.confidence_score;
        corrections = parsed.tariffs;
      } catch (argParseError) {
        console.error("Failed to parse tool arguments:", argParseError);
        return new Response(
          JSON.stringify({ error: "AI response format invalid", details: toolCall.function.arguments }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.log(`Reprise analysis: ${analysis}`);
      console.log(`Reprise confidence: ${repriseConfidence}`);
      console.log(`Found ${corrections?.length || 0} corrections needed`);

      // Get current stored confidence to ensure we NEVER go backwards
      const { data: currentMuniState } = await supabase
        .from("municipalities")
        .select("ai_confidence, reprise_count")
        .eq("id", muniData.id)
        .single();
      const currentStoredConfidence = currentMuniState?.ai_confidence || 0;

      if (!corrections || corrections.length === 0) {
        // AI verified extraction - no corrections needed
        // If AI says 100% confident, we're verified. Otherwise, keep existing confidence or bump slightly
        const verifiedConfidence = repriseConfidence === 100 
          ? 100  // AI verified as perfect
          : Math.max(currentStoredConfidence, Math.min(100, currentStoredConfidence + 5)); // Bump slightly for verification pass
        
        console.log(`No corrections: Current ${currentStoredConfidence}%, AI says ${repriseConfidence}%, Setting to ${verifiedConfidence}%`);
        
        // Create run record for successful verification
        await supabase.from("extraction_runs").insert({
          municipality_id: muniData.id,
          run_type: "reprise",
          corrections_made: 0,
          ai_confidence: verifiedConfidence,
          ai_analysis: analysis,
          status: "completed",
          completed_at: new Date().toISOString()
        });

        // Update municipality stats - never decrease confidence
        await supabase.from("municipalities").update({
          ai_confidence: verifiedConfidence,
          last_reprise_at: new Date().toISOString(),
          reprise_count: (currentMuniState?.reprise_count || 0) + 1
        }).eq("id", muniData.id);

        return new Response(
          JSON.stringify({ 
            success: true,
            municipality,
            analysis,
            confidence: verifiedConfidence,
            corrections: 0,
            message: repriseConfidence === 100 
              ? "Verified as 100% accurate - no corrections needed"
              : "No corrections needed - confidence maintained"
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Apply corrections
      const { data: categories } = await supabase.from("tariff_categories").select("id, name");
      const categoryMap = new Map(categories?.map(c => [c.name.toLowerCase(), c.id]) || []);

      let added = 0;
      let updated = 0;
      const errors: string[] = [];

      for (const correction of corrections) {
        try {
          let categoryId = categoryMap.get(correction.category.toLowerCase());
          if (!categoryId) {
            const { data: newCat } = await supabase
              .from("tariff_categories")
              .insert({ name: correction.category })
              .select("id")
              .single();
            if (newCat) {
              categoryId = newCat.id;
              categoryMap.set(correction.category.toLowerCase(), categoryId);
            }
          }

          if (!categoryId) {
            errors.push(`${correction.tariff_name}: Missing category`);
            continue;
          }

          const tariffData = {
            name: correction.tariff_name,
            municipality_id: muniData.id,
            category_id: categoryId,
            tariff_type: correction.tariff_type,
            phase_type: correction.phase_type || "Single Phase",
            fixed_monthly_charge: correction.fixed_monthly_charge || 0,
            demand_charge_per_kva: correction.demand_charge_per_kva || 0,
            is_prepaid: correction.is_prepaid,
            amperage_limit: correction.amperage_limit || null,
            voltage_level: correction.voltage_level || "LV",
            customer_category: correction.customer_category || correction.category,
          };

          if (correction.action === "update" && correction.existing_name) {
            // Find and update existing tariff
            const existing = currentTariffs?.find(t => 
              t.name.toLowerCase() === correction.existing_name.toLowerCase()
            );
            
            if (existing) {
              await supabase.from("tariffs").update(tariffData).eq("id", existing.id);
              await supabase.from("tariff_rates").delete().eq("tariff_id", existing.id);
              
              if (correction.rates) {
                for (const rate of correction.rates) {
                  await supabase.from("tariff_rates").insert({
                    tariff_id: existing.id,
                    rate_per_kwh: rate.rate_per_kwh,
                    block_start_kwh: rate.block_start_kwh || 0,
                    block_end_kwh: rate.block_end_kwh || null,
                    season: rate.season || "All Year",
                    time_of_use: rate.time_of_use || "Any",
                  });
                }
              }
              updated++;
              console.log(`Reprise updated: ${correction.tariff_name}`);
            }
          } else {
            // Add new tariff
            const { data: newTariff, error: tariffErr } = await supabase
              .from("tariffs")
              .insert(tariffData)
              .select("id")
              .single();

            if (tariffErr || !newTariff) {
              errors.push(`${correction.tariff_name}: ${tariffErr?.message || "Insert failed"}`);
              continue;
            }

            if (correction.rates) {
              for (const rate of correction.rates) {
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
            added++;
            console.log(`Reprise added: ${correction.tariff_name}`);
          }
        } catch (e) {
          errors.push(`${correction.tariff_name}: ${e instanceof Error ? e.message : "Unknown error"}`);
        }
      }

      // Calculate POST-CORRECTION confidence: must NEVER go backwards
      const successfulCorrections = added + updated;
      const correctionSuccessRate = successfulCorrections / Math.max(corrections.length, 1);
      
      // Start from the HIGHER of current stored confidence or AI's assessment
      const baseConfidence = Math.max(currentStoredConfidence, repriseConfidence);
      
      // Boost confidence aggressively toward 100% based on successful fixes
      // Each successful fix closes 70% of the remaining gap to 100%
      const postCorrectionConfidence = Math.min(100, Math.round(
        baseConfidence + (100 - baseConfidence) * correctionSuccessRate * 0.7
      ));
      
      console.log(`Current stored: ${currentStoredConfidence}%, AI pre-fix: ${repriseConfidence}%, Post-correction: ${postCorrectionConfidence}%`);

      // Create reprise run record
      await supabase.from("extraction_runs").insert({
        municipality_id: muniData.id,
        run_type: "reprise",
        tariffs_inserted: added,
        tariffs_updated: updated,
        corrections_made: corrections.length,
        ai_confidence: postCorrectionConfidence, // Store post-correction confidence
        ai_analysis: `${analysis} | Applied ${successfulCorrections}/${corrections.length} corrections successfully.`,
        status: "completed",
        completed_at: new Date().toISOString()
      });

      // Update municipality stats
      const { data: currentMuni } = await supabase
        .from("municipalities")
        .select("reprise_count, total_corrections")
        .eq("id", muniData.id)
        .single();

      const { count: totalTariffs } = await supabase
        .from("tariffs")
        .select("*", { count: "exact", head: true })
        .eq("municipality_id", muniData.id);

      await supabase.from("municipalities").update({
        ai_confidence: postCorrectionConfidence, // Store improved confidence
        total_tariffs: totalTariffs || 0,
        last_reprise_at: new Date().toISOString(),
        reprise_count: (currentMuni?.reprise_count || 0) + 1,
        total_corrections: (currentMuni?.total_corrections || 0) + corrections.length
      }).eq("id", muniData.id);

      return new Response(
        JSON.stringify({ 
          success: true,
          municipality,
          analysis,
          preConfidence: repriseConfidence,
          confidence: postCorrectionConfidence, // Return improved confidence
          corrections: corrections.length,
          added,
          updated,
          errors: errors.slice(0, 10)
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
