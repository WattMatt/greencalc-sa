import { createClient } from "npm:@supabase/supabase-js@2.86.0";
import * as XLSX from "npm:xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// === NERSA Schema Mapping Helpers ===

function mapStructure(tariffType: string): string {
  const map: Record<string, string> = {
    "fixed": "flat",
    "ibt": "inclining_block",
    "tou": "time_of_use",
    "demand": "demand",
    "seasonal": "seasonal",
    "hybrid": "hybrid",
  };
  return map[tariffType.toLowerCase()] || "flat";
}

function mapCategory(category: string): string {
  const map: Record<string, string> = {
    "domestic": "domestic",
    "residential": "domestic",
    "domestic indigent": "domestic_indigent",
    "indigent": "domestic_indigent",
    "commercial": "commercial",
    "business": "commercial",
    "industrial": "industrial",
    "agriculture": "agricultural",
    "agricultural": "agricultural",
    "street lighting": "public_lighting",
    "public lighting": "public_lighting",
    "sports facilities": "sports_facilities",
    "public benefit": "public_benefit",
    "bulk reseller": "bulk_reseller",
    "departmental": "departmental",
    "availability": "availability",
    "other": "other",
  };
  return map[category.toLowerCase()] || "other";
}

function mapVoltage(voltage?: string): string | null {
  if (!voltage) return null;
  const map: Record<string, string> = {
    "lv": "low", "low": "low", "low voltage": "low",
    "mv": "medium", "medium": "medium", "medium voltage": "medium",
    "hv": "high", "high": "high", "high voltage": "high",
  };
  return map[voltage.toLowerCase()] || null;
}

function mapSeason(season?: string): string {
  if (!season) return "all";
  const s = season.toLowerCase();
  if (s.includes("high") || s.includes("winter")) return "high";
  if (s.includes("low") || s.includes("summer")) return "low";
  return "all";
}

function mapTou(tou?: string): string {
  if (!tou) return "all";
  const t = tou.toLowerCase();
  if (t === "peak") return "peak";
  if (t === "standard") return "standard";
  if (t.includes("off")) return "off_peak";
  if (t.includes("high demand")) return "peak";
  if (t.includes("low demand")) return "off_peak";
  return "all";
}

function mapMetering(isPrepaid?: boolean): string | null {
  if (isPrepaid === true) return "prepaid";
  if (isPrepaid === false) return "conventional";
  return null;
}

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
  voltage_level?: "LV" | "MV" | "HV";
  reactive_energy_charge?: number;
  capacity_kva?: number;
  customer_category?: string;
  is_unbundled?: boolean;
  tariff_family?: string;
  transmission_zone?: string;
  generation_capacity_charge?: number;
  legacy_charge_per_kwh?: number;
  service_charge_per_day?: number;
  administration_charge_per_day?: number;
  effective_from?: string;
  effective_to?: string;
  rates: Array<{
    rate_per_kwh: number;
    block_start_kwh?: number;
    block_end_kwh?: number;
    season?: string;
    time_of_use?: string;
    reactive_energy_charge?: number;
    network_charge_per_kwh?: number;
    ancillary_charge_per_kwh?: number;
    energy_charge_per_kwh?: number;
    electrification_rural_per_kwh?: number;
    affordability_subsidy_per_kwh?: number;
  }>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { filePath, fileType, province = "Western Cape", action = "analyze", municipality, effectiveFrom, effectiveTo } = await req.json();
    
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
        
        extractedText += `\n=== SHEET: ${sheetName} ===\n`;
        extractedText += jsonData.slice(0, 150).map(row => 
          row.filter(cell => cell != null && cell !== "").join(" | ")
        ).filter(row => row.trim()).join("\n");
      }
      console.log(`Processed ${workbook.SheetNames.length} sheets`);
    } else if (fileType === "pdf") {
      console.log("Processing PDF file - using AI vision...");
      const uint8Array = new Uint8Array(await fileData.arrayBuffer());
      const { encode } = await import("https://deno.land/std@0.208.0/encoding/base64.ts");
      const base64 = encode(uint8Array);
      console.log("PDF base64 size:", base64.length, "bytes");
      
      const visionRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{
            role: "user",
            content: [
              { type: "text", text: "Extract ALL text content from this PDF document. This contains South African electricity tariff data. Preserve the structure - identify municipality names, tariff categories, and all rates/charges. Format as structured text." },
              { type: "image_url", image_url: { url: `data:application/pdf;base64,${base64}` } }
            ]
          }],
        }),
      });

      if (visionRes.ok) {
        try {
          const visionData = await visionRes.json();
          extractedText = visionData.choices?.[0]?.message?.content || "";
        } catch {
          extractedText = "PDF extraction failed - AI response was invalid";
        }
      } else {
        const errBody = await visionRes.text();
        console.error("Vision API failed:", visionRes.status, errBody);
        extractedText = "PDF extraction failed - please try Excel format";
      }
    }

    // PHASE 1: Analyze
    if (action === "analyze") {
      const analysisPrompt = `Analyze this South African electricity tariff data and describe its structure:\n\n${extractedText.slice(0, 50000)}\n\nIdentify:\n1. Municipality names found\n2. Tariff categories (Domestic, Commercial, Industrial, etc.)\n3. Tariff types (Fixed, IBT/block tariffs, TOU/time-of-use)\n4. Rate structures (basic charges, energy rates, demand charges)\n5. Any issues or inconsistencies in the data\n\nBe specific and concise.`;

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
          success: true, fileType,
          sheets: Object.keys(sheetData),
          rowCounts: Object.fromEntries(Object.entries(sheetData).map(([k, v]) => [k, v.length])),
          analysis,
          sampleText: extractedText.slice(0, 5000)
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PHASE 2: Extract municipalities
    if (action === "extract-municipalities") {
      console.log("Extracting municipalities for province:", province);
      
      const isEskom = province.toLowerCase() === "eskom";
      let municipalityNames: string[] = [];
      const sheetNameToMuni: Record<string, string> = {};
      
      if (isEskom) {
        municipalityNames = ["Eskom Direct"];
      } else if (fileType === "xlsx" || fileType === "xls") {
        for (const sheetName of sheetNames) {
          const cleanName = sheetName.replace(/\s*-\s*\d+\.?\d*%$/, '').trim();
          if (cleanName.length > 0) {
            municipalityNames.push(cleanName);
            sheetNameToMuni[cleanName] = sheetName;
          }
        }
      } else {
        // Two-pass approach: regex first, AI fallback
        // Pass 1: Regex-based extraction for standard SA tariff PDF format
        // Pattern: "MUNICIPALITY_NAME - XX.XX%" or "MUNICIPALITY_NAME XX.XX%"
        const regexWithDash = /^([A-Z][A-Z\s\-\/]+?)\s*[-–]\s*\d+[\.,]\d+%/gm;
        const regexNoDash = /^([A-Z][A-Z\s\-\/]+?)\s+\d+[\.,]\d+%/gm;
        
        const regexMatches = new Set<string>();
        let match: RegExpExecArray | null;
        
        while ((match = regexWithDash.exec(extractedText)) !== null) {
          const name = match[1].replace(/\s*(LIM|EC|WC|NC|NW|FS|GP|KZN|MP)\s*\d+/gi, '').trim();
          if (name.length > 2) regexMatches.add(name);
        }
        while ((match = regexNoDash.exec(extractedText)) !== null) {
          const name = match[1].replace(/\s*(LIM|EC|WC|NC|NW|FS|GP|KZN|MP)\s*\d+/gi, '').trim();
          if (name.length > 2) regexMatches.add(name);
        }
        
        console.log(`Regex found ${regexMatches.size} municipality names:`, [...regexMatches]);
        
        if (regexMatches.size > 0) {
          municipalityNames = [...regexMatches];
        } else {
          // Pass 2: AI fallback with increased context
          console.log("Regex found no matches, falling back to AI extraction...");
          const muniPrompt = `Extract ONLY the municipality names from this South African electricity tariff document.\n\n${extractedText.slice(0, 50000)}\n\nReturn ONLY municipality names, one per line. Remove any percentages like "- 12.72%".`;

          const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [{ role: "user", content: muniPrompt }],
              tools: [{
                type: "function",
                function: {
                  name: "list_municipalities",
                  description: "List extracted municipality names",
                  parameters: {
                    type: "object",
                    properties: { municipalities: { type: "array", items: { type: "string" } } },
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
      }

      // Save to database - NO source_file_path references
      const { data: provinces } = await supabase.from("provinces").select("id, name");
      const provinceMap = new Map(provinces?.map(p => [p.name.toLowerCase(), p.id]) || []);
      
      let provinceId = provinceMap.get(province.toLowerCase());
      if (!provinceId) {
        const { data: newProv } = await supabase.from("provinces").insert({ name: province, code: province.substring(0, 3).toUpperCase() }).select("id").single();
        if (newProv) provinceId = newProv.id;
      }

      const savedMunicipalities: Array<{ id: string; name: string; sheetName?: string }> = [];
      const errors: string[] = [];

      if (provinceId) {
        const { data: existingMunis } = await supabase
          .from("municipalities")
          .select("id, name")
          .eq("province_id", provinceId);
        
        const existingNames = new Set(existingMunis?.map(m => m.name.toLowerCase()) || []);

        for (const muniName of municipalityNames) {
          const cleanName = muniName.replace(/\s*-\s*\d+\.?\d*%$/, '').trim();
          if (!cleanName) continue;
          
          if (existingNames.has(cleanName.toLowerCase())) {
            const existing = existingMunis?.find(m => m.name.toLowerCase() === cleanName.toLowerCase());
            if (existing) {
              savedMunicipalities.push({ id: existing.id, name: existing.name, sheetName: sheetNameToMuni[cleanName] || cleanName });
            }
            continue;
          }

          const { data: newMuni, error } = await supabase
            .from("municipalities")
            .insert({ name: cleanName, province_id: provinceId })
            .select("id, name")
            .single();
          
          if (newMuni) {
            savedMunicipalities.push({ id: newMuni.id, name: newMuni.name, sheetName: sheetNameToMuni[cleanName] || cleanName });
            existingNames.add(cleanName.toLowerCase());
          } else if (error) {
            errors.push(`${cleanName}: ${error.message}`);
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, province, provinceId, municipalities: savedMunicipalities, total: savedMunicipalities.length, errors }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PHASE 2.5: Preview raw sheet data
    if (action === "preview") {
      if (!municipality) {
        return new Response(JSON.stringify({ error: "Municipality name is required for preview" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      let previewData: string[][] = [];
      let sheetTitle = municipality;
      let isPdf = false;
      let pdfFilePath: string | null = null;

      if (fileType === "pdf") {
        // For PDFs, return the extracted text split into rows for display
        isPdf = true;
        pdfFilePath = filePath;
        const lines = extractedText.split('\n').filter((l: string) => l.trim());
        previewData = lines.map((line: string) => [line]);
        sheetTitle = municipality;
      } else if (fileType === "xlsx" || fileType === "xls") {
        const matchingSheet = sheetNames.find(name => 
          name.toLowerCase().includes(municipality.toLowerCase()) ||
          municipality.toLowerCase().includes(name.replace(/\s*-\s*\d+\.?\d*%$/, '').toLowerCase())
        );
        if (matchingSheet && sheetData[matchingSheet]) {
          sheetTitle = matchingSheet;
          previewData = sheetData[matchingSheet].slice(0, 100);
        }
      }

      return new Response(
        JSON.stringify({ success: true, municipality, sheetTitle, data: previewData, rowCount: previewData.length, isPdf, pdfFilePath }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PHASE 3: Extract tariffs for a specific municipality
    if (action === "extract-tariffs") {
      if (!municipality) {
        return new Response(JSON.stringify({ error: "Municipality name is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      console.log("Extracting tariffs for municipality:", municipality);

      const { data: muniData } = await supabase
        .from("municipalities")
        .select("id")
        .ilike("name", municipality)
        .single();

      if (!muniData) {
        return new Response(JSON.stringify({ error: `Municipality "${municipality}" not found` }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Fetch existing tariff_plans with rates for comparison
      const { data: existingTariffs } = await supabase
        .from("tariff_plans")
        .select(`
          id, name, structure, category, phase, scale_code, voltage, metering,
          tariff_rates(amount, charge, season, tou, block_min_kwh, block_max_kwh, unit)
        `)
        .eq("municipality_id", muniData.id);

      const existingTariffSummary = existingTariffs?.map(t => ({
        name: t.name,
        category: t.category,
        structure: t.structure,
        rates: t.tariff_rates?.map(r => ({
          amount: r.amount,
          charge: r.charge,
          season: r.season,
          tou: r.tou
        }))
      })) || [];

      console.log(`Found ${existingTariffSummary.length} existing tariff plans for ${municipality}`);

      // ESKOM BATCHING
      const isEskomExtraction = municipality.toLowerCase() === "eskom direct";
      
      const eskomBatches = isEskomExtraction ? [
        { name: "Megaflex", sheets: ["megaflex nla", "megaflex gen", "megaflex"], description: "Urban TOU for large customers >1MVA NMD." },
        { name: "Miniflex", sheets: ["miniflex nla", "miniflex"], description: "Urban TOU for high-load factor customers 25kVA-5MVA NMD." },
        { name: "Nightsave", sheets: ["nightsave urban", "nightsave rural", "nightsave"], description: "Urban/Rural seasonally differentiated TOU." },
        { name: "Businessrate", sheets: ["businessrate nla", "businessrate"], description: "Urban commercial up to 100kVA NMD." },
        { name: "Public Lighting", sheets: ["public lighting nla", "public lighting munic", "public lighting"], description: "Non-metered urban tariff." },
        { name: "Homepower", sheets: ["homepower nla", "homepower"], description: "Standard urban residential up to 100kVA." },
        { name: "Homeflex", sheets: ["homeflex nla", "homeflex"], description: "Residential TOU for grid-tied generation." },
        { name: "Homelight", sheets: ["homelight nla", "homelight"], description: "Subsidized tariff for low-usage households." },
        { name: "Ruraflex", sheets: ["ruraflex nla", "ruraflex gen", "ruraflex"], description: "Rural TOU from 16kVA NMD." },
        { name: "Landrate", sheets: ["landrate nla", "landrate"], description: "Conventional rural tariff up to 100kVA." },
        { name: "Municflex", sheets: ["municflex"], description: "Bulk TOU for local authorities from 16kVA NMD." },
        { name: "Municrate", sheets: ["municrate"], description: "Bulk tariff for local authority up to 100kVA." },
        { name: "WEPS", sheets: ["weps nla", "weps munic", "weps"], description: "Wholesale Electricity Pricing System." },
        { name: "Generator Tariffs", sheets: ["gen-offset", "gen reconcil", "tuos nla", "duos nla"], description: "Use-of-System charges for generators." },
        { name: "Excess NCC", sheets: ["excess ncc nla", "excess ncc munic", "excess ncc"], description: "Excess Network Capacity Charges." }
      ] : [];
      
      let currentBatchIndex = 0;
      
      if (isEskomExtraction) {
        const { data: existingBatches } = await supabase
          .from("eskom_batch_status")
          .select("batch_index, status")
          .eq("municipality_id", muniData.id)
          .order("batch_index");
        
        if (!existingBatches || existingBatches.length === 0) {
          const batchRecords = eskomBatches.map((batch, index) => ({
            municipality_id: muniData.id,
            batch_index: index,
            batch_name: batch.name,
            status: "pending"
          }));
          await supabase.from("eskom_batch_status").insert(batchRecords);
        }
        
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
          console.log(`Processing batch ${currentBatchIndex + 1}/${eskomBatches.length}: ${nextBatch.batch_name}`);
          
          await supabase.from("eskom_batch_status")
            .update({ status: "in_progress", updated_at: new Date().toISOString() })
            .eq("municipality_id", muniData.id)
            .eq("batch_index", currentBatchIndex);
        } else {
          const { data: completedBatches } = await supabase
            .from("eskom_batch_status")
            .select("batch_name, tariffs_extracted")
            .eq("municipality_id", muniData.id)
            .eq("status", "completed");
          
          const totalTariffs = completedBatches?.reduce((sum, b) => sum + (b.tariffs_extracted || 0), 0) || 0;
          
          return new Response(
            JSON.stringify({ allComplete: true, message: "All Eskom batches extracted", totalBatches: eskomBatches.length, completedBatches: eskomBatches.length, totalTariffs }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      
      // Build municipality text for AI
      let municipalityText = "";
      
      if (isEskomExtraction) {
        const currentBatch = eskomBatches[currentBatchIndex];
        const batchSheets = sheetNames.filter(name => {
          const lower = name.toLowerCase().trim();
          return currentBatch.sheets.some(keyword => lower.includes(keyword.toLowerCase()));
        });
        
        if (batchSheets.length === 0) {
          // Skip empty batch
          await supabase.from("eskom_batch_status")
            .update({ status: "completed", tariffs_extracted: 0, updated_at: new Date().toISOString() })
            .eq("municipality_id", muniData.id)
            .eq("batch_index", currentBatchIndex);
          
          return new Response(
            JSON.stringify({ inserted: 0, updated: 0, skipped: 0, confidence: 100, message: `No sheets for ${currentBatch.name}` }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        for (const sheetName of batchSheets.slice(0, 5)) {
          if (sheetData[sheetName]) {
            municipalityText += `\n=== SHEET: ${sheetName} ===\n`;
            municipalityText += sheetData[sheetName].slice(0, 100).map(row => 
              row.filter(cell => cell != null && cell !== "").join(" | ")
            ).filter(row => row.trim()).join("\n");
          }
        }
        
        municipalityText = `BATCH FOCUS: ${currentBatch.name}\n${currentBatch.description}\n\n${municipalityText}`;
        
        if (extractedText && fileType === "pdf") {
          municipalityText = extractedText.slice(0, 12000);
        }
      } else if (fileType === "xlsx" || fileType === "xls") {
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
        // PDF: Extract only the section relevant to this municipality
        const muniUpper = municipality.toUpperCase();
        // Try to find municipality section boundaries using regex
        // SA tariff PDFs typically have headers like "POLOKWANE - 14.59%" or "POLOKWANE 14.59%"
        const escapedName = muniUpper.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const sectionRegex = new RegExp(
          `(${escapedName}[\\s\\S]*?)(?=\\n[A-Z][A-Z\\s\\-\\/]{2,}\\s*[-–]?\\s*\\d+[\\.,]\\d+%|$)`,
          's'
        );
        const sectionMatch = extractedText.match(sectionRegex);
        
        if (sectionMatch && sectionMatch[1]) {
          municipalityText = sectionMatch[1].slice(0, 15000);
          console.log(`Found municipality section for ${municipality}: ${municipalityText.length} chars`);
        } else {
          // Fallback: pass full text but with strong focus instruction
          municipalityText = `FOCUS ONLY ON TARIFFS FOR: ${municipality}\nIgnore data for all other municipalities.\n\n${extractedText.slice(0, 15000)}`;
          console.log(`No section boundary found for ${municipality}, using full text with focus instruction`);
        }
      }

      if (!municipalityText) {
        return new Response(JSON.stringify({ error: `No data found for: ${municipality}` }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Build incremental context
      const existingContext = existingTariffSummary.length > 0 
        ? `\n\nEXISTING TARIFFS IN DATABASE (${existingTariffSummary.length} total):\n${JSON.stringify(existingTariffSummary, null, 2)}\n\nINCREMENTAL EXTRACTION RULES:\n- Compare against existing tariffs above\n- ONLY return NEW or UPDATED tariffs\n- Mark each with "action": "new" or "action": "update"\n- Skip tariffs with IDENTICAL values`
        : "";

      const currentBatch = isEskomExtraction ? eskomBatches[currentBatchIndex] : null;
      
      // Build extraction prompt (keeping AI prompt logic intact - well-tuned for SA tariff docs)
      const extractPrompt = isEskomExtraction 
        ? `TASK: Extract ${currentBatch?.name || "Eskom"} tariffs from Eskom 2025-2026 tariff data.\n\nBATCH FOCUS: ${currentBatch?.name || "All"} - ${currentBatch?.description || "Extract all tariffs"}\nBatch ${currentBatchIndex + 1}/${eskomBatches.length}\n\nSOURCE DATA:\n${municipalityText.slice(0, 15000)}\n${existingContext}\n\n=== ESKOM 2025-2026 UNBUNDLED TARIFF STRUCTURE ===\n\nExtract ALL variants of ${currentBatch?.name || "Eskom"} tariffs with these fields:\n- category: "Domestic", "Commercial", "Industrial", "Agricultural", "Public Lighting", or "Other"\n- tariff_name: Full name from document\n- tariff_type: "Fixed", "IBT", or "TOU"\n- voltage_level: "LV", "MV", or "HV"\n- phase_type: "Single Phase" or "Three Phase"\n- is_prepaid: boolean\n- tariff_family: "${currentBatch?.name || "Megaflex"}"\n- fixed_monthly_charge: Basic/service charge in R/month\n- demand_charge_per_kva: Network access charge in R/kVA\n- rates: Array of energy rates in R/kWh (convert c/kWh ÷ 100)\n  - Each rate: { rate_per_kwh, season ("All Year"/"High/Winter"/"Low/Summer"), time_of_use ("Any"/"Peak"/"Standard"/"Off-Peak"), block_start_kwh, block_end_kwh }\n\nKEY RULES:\n1. Use VAT-EXCLUSIVE values only\n2. c/kWh → R/kWh: divide by 100\n3. TOU tariffs need 6 rates minimum (Peak/Standard/Off-Peak × High/Low seasons)\n4. Include all voltage and zone variants\n\nExtract EVERY variant with COMPLETE rate data!`
        : `TASK: Extract electricity tariffs for "${municipality}" municipality.\n\nSOURCE DATA:\n${municipalityText.slice(0, 15000)}\n\n=== EXTRACTION RULES ===\n\n1. TARIFF IDENTIFICATION: Look for "Domestic", "Commercial", "Industrial", "Agricultural", "Prepaid" sections.\n\n2. TARIFF TYPE DETECTION:\n   - IBT: Different rates for different kWh levels → tariff_type: "IBT"\n   - TOU: High/Low Demand or Peak/Standard/Off-Peak → tariff_type: "TOU"  \n   - Fixed: Single flat rate → tariff_type: "Fixed"\n\n3. IBT BLOCKS: EVERY IBT rate MUST have block_start_kwh and block_end_kwh!\n   - "Block 1 (0-50)kWh" → block_start_kwh: 0, block_end_kwh: 50\n   - ">600kWh" → block_start_kwh: 600, block_end_kwh: null\n\n4. CHARGES:\n   - "Basic Charge (R/month)" → fixed_monthly_charge\n   - "Per kVA" charges → demand_charge_per_kva\n   - "Energy Charge (c/kWh)" → rates array\n\n5. RATE CONVERSION: c/kWh → R/kWh (divide by 100). Use VAT-EXCLUSIVE values.\n\n6. CATEGORIES: Domestic, Commercial, Industrial, Agriculture\n\n7. PHASE: "Single Phase" or "Three Phase"\n\n8. PREPAID: is_prepaid: true if "Prepaid" in name\n\n9. TOU RATES must have at least 6 entries:\n   - High/Winter: Peak, Standard, Off-Peak\n   - Low/Summer: Peak, Standard, Off-Peak\n\n10. VOLTAGE: "LV" (≤400V), "MV" (11kV/22kV), "HV" (≥44kV)\n\n11. EFFECTIVE DATES: If the document mentions effective dates, financial year, or validity period (e.g. "Effective 1 July 2024", "2024/2025 tariffs"), extract them as:\n   - effective_from: YYYY-MM-DD (e.g. "2024-07-01")\n   - effective_to: YYYY-MM-DD (e.g. "2025-06-30")\n\nExtract ALL tariffs with COMPLETE rate data!`;

      // Retry logic for AI call
      const MAX_RETRIES = 3;
      let aiData = null;
      let lastError = null;
      
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          console.log(`Extract AI call attempt ${attempt}/${MAX_RETRIES}`);
          
          const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
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
                      confidence_score: { type: "integer", minimum: 0, maximum: 100, description: "Extraction accuracy confidence (0-100)" },
                      tariffs: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            category: { type: "string", description: "Domestic, Commercial, Industrial, Agricultural, Public Lighting, or Other" },
                            tariff_name: { type: "string", description: "Full tariff name from document" },
                            tariff_type: { type: "string", enum: ["Fixed", "IBT", "TOU"] },
                            voltage_level: { type: "string", enum: ["LV", "MV", "HV"] },
                            phase_type: { type: "string", enum: ["Single Phase", "Three Phase"] },
                            amperage_limit: { type: "string" },
                            is_prepaid: { type: "boolean" },
                            fixed_monthly_charge: { type: "number", description: "Basic charge R/month" },
                            demand_charge_per_kva: { type: "number", description: "R/kVA charge" },
                            tariff_family: { type: "string", description: "Eskom tariff family name" },
                            capacity_kva: { type: "number" },
                            effective_from: { type: "string", description: "Effective start date (YYYY-MM-DD) if found in document, e.g. 2024-07-01" },
                            effective_to: { type: "string", description: "Effective end date (YYYY-MM-DD) if found in document, e.g. 2025-06-30" },
                            rates: {
                              type: "array",
                              description: "Energy rates in R/kWh (convert c/kWh by dividing by 100)",
                              items: {
                                type: "object",
                                properties: {
                                  rate_per_kwh: { type: "number", description: "Energy rate in R/kWh" },
                                  block_start_kwh: { type: "number" },
                                  block_end_kwh: { type: ["number", "null"] },
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
          const toolCall = responseData.choices?.[0]?.message?.tool_calls?.[0];
          const content = responseData.choices?.[0]?.message?.content;
          
          if (!toolCall && !content) throw new Error("AI returned empty response");
          
          aiData = responseData;
          break;
        } catch (error) {
          lastError = error;
          console.error(`Attempt ${attempt} failed:`, error);
          if (attempt < MAX_RETRIES) await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        }
      }
      
      if (!aiData) {
        return new Response(
          JSON.stringify({ error: "AI extraction failed after retries", details: lastError instanceof Error ? lastError.message : "Timeout" }),
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
        } catch {
          return new Response(
            JSON.stringify({ error: "Failed to parse AI response" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        const content = aiData.choices?.[0]?.message?.content;
        if (content) {
          const jsonMatch = content.match(/\{[\s\S]*"tariffs"[\s\S]*\}/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0]);
              extractedTariffs = parsed.tariffs;
            } catch {
              return new Response(JSON.stringify({ error: "AI did not return structured data" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
          } else {
            return new Response(JSON.stringify({ error: "AI did not return structured data" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        } else {
          return new Response(JSON.stringify({ error: "AI returned empty response" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
      
      if (!extractedTariffs || extractedTariffs.length === 0) {
        return new Response(
          JSON.stringify({ success: true, municipality, inserted: 0, updated: 0, skipped: 0, total: 0, message: "No tariffs found in source data" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      console.log(`AI extracted ${extractedTariffs.length} tariffs for ${municipality}`);

      // === NERSA SCHEMA: Write to tariff_plans + tariff_rates ===
      const existingTariffMap = new Map(
        existingTariffs?.map(t => [`${t.name.toLowerCase()}|${t.category}`, t]) || []
      );

      let inserted = 0;
      let updated = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const tariff of extractedTariffs) {
        try {
          const tariffPlanData = {
            name: tariff.tariff_name,
            municipality_id: muniData.id,
            category: mapCategory(tariff.customer_category || tariff.category),
            structure: mapStructure(tariff.tariff_type),
            voltage: mapVoltage(tariff.voltage_level),
            phase: tariff.phase_type || "Single Phase",
            scale_code: tariff.tariff_family || null,
            metering: mapMetering(tariff.is_prepaid),
            min_amps: tariff.amperage_limit ? parseFloat(tariff.amperage_limit.replace(/[^0-9.]/g, '')) || null : null,
            max_amps: null as number | null,
            min_kva: null as number | null,
            max_kva: tariff.capacity_kva || null,
            is_redundant: false,
            is_recommended: false,
            description: null as string | null,
            effective_from: tariff.effective_from || null,
            effective_to: tariff.effective_to || null,
          };

          // Check if tariff already exists
          const tariffKey = `${tariff.tariff_name.toLowerCase()}|${tariffPlanData.category}`;
          const existingTariff = existingTariffMap.get(tariffKey);

          let tariffPlanId: string;

          if (existingTariff) {
            const { error: updateErr } = await supabase
              .from("tariff_plans")
              .update(tariffPlanData)
              .eq("id", existingTariff.id);

            if (updateErr) {
              errors.push(`${tariff.tariff_name}: Update failed - ${updateErr.message}`);
              skipped++;
              continue;
            }

            tariffPlanId = existingTariff.id;
            // Delete existing rates and re-insert
            await supabase.from("tariff_rates").delete().eq("tariff_plan_id", tariffPlanId);
            updated++;
          } else {
            const { data: newPlan, error: planErr } = await supabase
              .from("tariff_plans")
              .insert(tariffPlanData)
              .select("id")
              .single();

            if (planErr || !newPlan) {
              errors.push(`${tariff.tariff_name}: ${planErr?.message || "Insert failed"}`);
              skipped++;
              continue;
            }

            tariffPlanId = newPlan.id;
            inserted++;
          }

          // Build rate rows for NERSA schema
          const rateRows: any[] = [];

          // Add basic charge as a rate row
          if (tariff.fixed_monthly_charge && tariff.fixed_monthly_charge > 0) {
            rateRows.push({
              tariff_plan_id: tariffPlanId,
              charge: "basic",
              amount: tariff.fixed_monthly_charge,
              unit: "R/month",
              season: "all",
              tou: "all",
            });
          }

          // Add demand charge as a rate row
          if (tariff.demand_charge_per_kva && tariff.demand_charge_per_kva > 0) {
            rateRows.push({
              tariff_plan_id: tariffPlanId,
              charge: "demand",
              amount: tariff.demand_charge_per_kva,
              unit: "R/kVA",
              season: "all",
              tou: "all",
            });
          }

          // Add energy rates
          if (tariff.rates) {
            for (let i = 0; i < tariff.rates.length; i++) {
              const rate = tariff.rates[i];
              rateRows.push({
                tariff_plan_id: tariffPlanId,
                charge: "energy",
                amount: rate.rate_per_kwh,
                unit: "R/kWh",
                season: mapSeason(rate.season),
                tou: mapTou(rate.time_of_use),
                block_number: rate.block_start_kwh !== undefined ? i + 1 : null,
                block_min_kwh: rate.block_start_kwh ?? null,
                block_max_kwh: rate.block_end_kwh ?? null,
              });
            }
          }

          // Batch insert all rates
          if (rateRows.length > 0) {
            const { error: ratesErr } = await supabase.from("tariff_rates").insert(rateRows);
            if (ratesErr) {
              console.error(`Rate insert error for ${tariff.tariff_name}:`, ratesErr.message);
            }
          }
        } catch (e) {
          errors.push(`${tariff.tariff_name}: ${e instanceof Error ? e.message : "Unknown error"}`);
          skipped++;
        }
      }

      // Create extraction run record
      await supabase.from("extraction_runs").insert({
        municipality_id: muniData.id,
        run_type: "extraction",
        tariffs_found: extractedTariffs.length,
        tariffs_inserted: inserted,
        tariffs_updated: updated,
        tariffs_skipped: skipped,
        ai_confidence: confidenceScore,
        status: "completed",
        completed_at: new Date().toISOString()
      });

      // Update Eskom batch status if applicable
      let batchProgress = null;
      if (isEskomExtraction) {
        const { data: currentBatchInfo } = await supabase
          .from("eskom_batch_status")
          .select("batch_index, batch_name")
          .eq("municipality_id", muniData.id)
          .eq("status", "in_progress")
          .single();
        
        if (currentBatchInfo) {
          await supabase.from("eskom_batch_status")
            .update({ status: "completed", tariffs_extracted: inserted + updated, updated_at: new Date().toISOString() })
            .eq("municipality_id", muniData.id)
            .eq("batch_index", currentBatchInfo.batch_index);
          
          const { count: completedCount } = await supabase.from("eskom_batch_status")
            .select("*", { count: "exact", head: true })
            .eq("municipality_id", muniData.id)
            .eq("status", "completed");
          
          batchProgress = {
            currentBatch: currentBatchInfo.batch_index + 1,
            currentBatchName: currentBatchInfo.batch_name,
            completedBatches: completedCount || 0,
            totalBatches: eskomBatches.length,
            allComplete: (completedCount || 0) >= eskomBatches.length
          };
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, municipality, extracted: extractedTariffs.length,
          inserted, updated, skipped, existingCount: existingTariffSummary.length,
          confidence: confidenceScore,
          errors: errors.slice(0, 20),
          ...(batchProgress && { batchProgress })
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PHASE 4: Reprise - second AI pass for corrections
    if (action === "reprise") {
      if (!municipality) {
        return new Response(JSON.stringify({ error: "Municipality name is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      console.log("Running reprise for:", municipality);

      const { data: muniData } = await supabase.from("municipalities").select("id").ilike("name", municipality).single();
      if (!muniData) {
        return new Response(JSON.stringify({ error: `Municipality "${municipality}" not found` }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Fetch current tariff_plans with rates
      const { data: currentTariffs } = await supabase
        .from("tariff_plans")
        .select(`
          id, name, structure, category, phase, voltage, metering, scale_code,
          tariff_rates(amount, charge, season, tou, block_min_kwh, block_max_kwh, unit)
        `)
        .eq("municipality_id", muniData.id);

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

      const currentSummary = currentTariffs?.map(t => ({
        name: t.name,
        category: t.category,
        structure: t.structure,
        phase: t.phase,
        rates: t.tariff_rates
      })) || [];

      const reprisePrompt = `REPRISE EXTRACTION: Review tariff extraction for "${municipality}".\n\n=== ORIGINAL SOURCE DATA ===\n${municipalityText.slice(0, 12000)}\n\n=== CURRENT EXTRACTION ===\n${JSON.stringify(currentSummary, null, 2)}\n\n=== YOUR TASK ===\nCompare source against current extraction. Find:\n1. TOU tariffs with empty/missing rates (CRITICAL!)\n2. MISSED tariffs\n3. INCORRECT values\n4. Missing IBT blocks\n5. Wrong tariff types\n\nFor each issue, provide CORRECTED tariff data. If accurate, return empty tariffs array.`;

      const MAX_RETRIES = 3;
      let aiData = null;
      let lastError = null;
      
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-pro",
              messages: [
                { role: "system", content: "You are an expert electricity tariff auditor for South African municipalities. Be meticulous. Check every value." },
                { role: "user", content: reprisePrompt }
              ],
              tools: [{
                type: "function",
                function: {
                  name: "report_corrections",
                  description: "Report tariffs to add or correct",
                  parameters: {
                    type: "object",
                    properties: {
                      analysis: { type: "string" },
                      confidence_score: { type: "integer", minimum: 0, maximum: 100 },
                      tariffs: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            action: { type: "string", enum: ["add", "update"] },
                            existing_name: { type: "string" },
                            category: { type: "string" },
                            tariff_name: { type: "string" },
                            tariff_type: { type: "string", enum: ["Fixed", "IBT", "TOU"] },
                            phase_type: { type: "string", enum: ["Single Phase", "Three Phase"] },
                            amperage_limit: { type: "string" },
                            is_prepaid: { type: "boolean" },
                            fixed_monthly_charge: { type: "number" },
                            demand_charge_per_kva: { type: "number" },
                            voltage_level: { type: "string", enum: ["LV", "MV", "HV"] },
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

          if (!aiRes.ok) throw new Error(`AI returned ${aiRes.status}`);
          const responseData = await aiRes.json();
          if (!responseData.choices?.[0]?.message?.tool_calls?.[0]) throw new Error("No tool call");
          aiData = responseData;
          break;
        } catch (error) {
          lastError = error;
          if (attempt < MAX_RETRIES) await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        }
      }
      
      if (!aiData) {
        return new Response(
          JSON.stringify({ error: "Reprise failed after retries" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const repriseToolCall = aiData.choices[0].message.tool_calls[0];
      let analysis: string, repriseConfidence: number, corrections: any[];
      
      try {
        const parsed = JSON.parse(repriseToolCall.function.arguments);
        analysis = parsed.analysis;
        repriseConfidence = parsed.confidence_score;
        corrections = parsed.tariffs;
      } catch {
        return new Response(JSON.stringify({ error: "Invalid reprise response" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (!corrections || corrections.length === 0) {
        await supabase.from("extraction_runs").insert({
          municipality_id: muniData.id, run_type: "reprise", corrections_made: 0,
          ai_confidence: repriseConfidence, ai_analysis: analysis, status: "completed", completed_at: new Date().toISOString()
        });

        return new Response(
          JSON.stringify({ success: true, municipality, analysis, confidence: repriseConfidence, corrections: 0, message: "No corrections needed" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Apply corrections using NERSA schema
      let added = 0;
      let correctionUpdated = 0;
      const correctionErrors: string[] = [];

      for (const correction of corrections) {
        try {
          const planData = {
            name: correction.tariff_name,
            municipality_id: muniData.id,
            category: mapCategory(correction.category),
            structure: mapStructure(correction.tariff_type),
            voltage: mapVoltage(correction.voltage_level),
            phase: correction.phase_type || "Single Phase",
            metering: mapMetering(correction.is_prepaid),
          };

          if (correction.action === "update" && correction.existing_name) {
            const existing = currentTariffs?.find(t => t.name.toLowerCase() === correction.existing_name.toLowerCase());
            if (existing) {
              await supabase.from("tariff_plans").update(planData).eq("id", existing.id);
              await supabase.from("tariff_rates").delete().eq("tariff_plan_id", existing.id);
              
              const rateRows: any[] = [];
              if (correction.fixed_monthly_charge > 0) {
                rateRows.push({ tariff_plan_id: existing.id, charge: "basic", amount: correction.fixed_monthly_charge, unit: "R/month", season: "all", tou: "all" });
              }
              if (correction.demand_charge_per_kva > 0) {
                rateRows.push({ tariff_plan_id: existing.id, charge: "demand", amount: correction.demand_charge_per_kva, unit: "R/kVA", season: "all", tou: "all" });
              }
              if (correction.rates) {
                for (let i = 0; i < correction.rates.length; i++) {
                  const rate = correction.rates[i];
                  rateRows.push({
                    tariff_plan_id: existing.id, charge: "energy", amount: rate.rate_per_kwh, unit: "R/kWh",
                    season: mapSeason(rate.season), tou: mapTou(rate.time_of_use),
                    block_number: rate.block_start_kwh !== undefined ? i + 1 : null,
                    block_min_kwh: rate.block_start_kwh ?? null, block_max_kwh: rate.block_end_kwh ?? null,
                  });
                }
              }
              if (rateRows.length > 0) await supabase.from("tariff_rates").insert(rateRows);
              correctionUpdated++;
            }
          } else {
            const { data: newPlan, error: planErr } = await supabase.from("tariff_plans").insert(planData).select("id").single();
            if (planErr || !newPlan) {
              correctionErrors.push(`${correction.tariff_name}: ${planErr?.message || "Insert failed"}`);
              continue;
            }

            const rateRows: any[] = [];
            if (correction.fixed_monthly_charge > 0) {
              rateRows.push({ tariff_plan_id: newPlan.id, charge: "basic", amount: correction.fixed_monthly_charge, unit: "R/month", season: "all", tou: "all" });
            }
            if (correction.demand_charge_per_kva > 0) {
              rateRows.push({ tariff_plan_id: newPlan.id, charge: "demand", amount: correction.demand_charge_per_kva, unit: "R/kVA", season: "all", tou: "all" });
            }
            if (correction.rates) {
              for (let i = 0; i < correction.rates.length; i++) {
                const rate = correction.rates[i];
                rateRows.push({
                  tariff_plan_id: newPlan.id, charge: "energy", amount: rate.rate_per_kwh, unit: "R/kWh",
                  season: mapSeason(rate.season), tou: mapTou(rate.time_of_use),
                  block_number: rate.block_start_kwh !== undefined ? i + 1 : null,
                  block_min_kwh: rate.block_start_kwh ?? null, block_max_kwh: rate.block_end_kwh ?? null,
                });
              }
            }
            if (rateRows.length > 0) await supabase.from("tariff_rates").insert(rateRows);
            added++;
          }
        } catch (e) {
          correctionErrors.push(`${correction.tariff_name}: ${e instanceof Error ? e.message : "Unknown error"}`);
        }
      }

      // Record reprise run
      await supabase.from("extraction_runs").insert({
        municipality_id: muniData.id, run_type: "reprise",
        tariffs_inserted: added, tariffs_updated: correctionUpdated, corrections_made: corrections.length,
        ai_confidence: repriseConfidence, ai_analysis: analysis,
        status: "completed", completed_at: new Date().toISOString()
      });

      return new Response(
        JSON.stringify({ success: true, municipality, analysis, confidence: repriseConfidence, corrections: corrections.length, added, updated: correctionUpdated, errors: correctionErrors.slice(0, 10) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Process file error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Processing failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
