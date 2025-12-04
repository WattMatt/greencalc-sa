import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import { create } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

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

// Retry helper for AI calls
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`AI call attempt ${attempt}/${maxRetries}`);
      const response = await fetch(url, options);
      
      if (response.ok) {
        console.log(`AI call succeeded on attempt ${attempt}`);
        return response;
      }
      
      // Don't retry on certain status codes
      if (response.status === 400 || response.status === 401 || response.status === 403) {
        return response;
      }
      
      lastError = new Error(`HTTP ${response.status}: ${await response.text()}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Attempt ${attempt} failed:`, lastError.message);
    }
    
    if (attempt < maxRetries) {
      const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
      console.log(`Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error("All retry attempts failed");
}

// Get access token using service account
async function getAccessToken(): Promise<string> {
  const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!serviceAccountJson) {
    throw new Error("Service account credentials not configured");
  }

  const serviceAccount = JSON.parse(serviceAccountJson);
  const { client_email, private_key } = serviceAccount;

  if (!client_email || !private_key) {
    throw new Error("Invalid service account credentials");
  }

  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = private_key.replace(pemHeader, "").replace(pemFooter, "").replace(/\s/g, "");
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"]
  );

  const now = Math.floor(Date.now() / 1000);
  const jwt = await create(
    { alg: "RS256", typ: "JWT" },
    {
      iss: client_email,
      scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    },
    cryptoKey
  );

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error("Failed to get access token from Google");
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sheetId, action = "analyze", province = "Western Cape" } = await req.json();
    
    if (!sheetId) {
      return new Response(
        JSON.stringify({ error: "Sheet ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    
    let accessToken: string;
    try {
      accessToken = await getAccessToken();
      console.log("Successfully obtained access token");
    } catch (error) {
      console.error("Auth error:", error);
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : "Authentication failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get sheet metadata
    console.log("Fetching sheet metadata for:", sheetId);
    const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`;
    const metadataRes = await fetch(metadataUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (!metadataRes.ok) {
      return new Response(
        JSON.stringify({ error: "Cannot access sheet. Make sure it's shared with the service account." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const metadata = await metadataRes.json();
    const sheetTabs = metadata.sheets?.map((s: any) => s.properties.title) || [];
    console.log("Found tabs:", sheetTabs);

    // Fetch data from all tabs
    const allData: Record<string, string[][]> = {};
    for (const tabName of sheetTabs) {
      const dataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(tabName)}`;
      const dataRes = await fetch(dataUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (dataRes.ok) {
        const tabData = await dataRes.json();
        allData[tabName] = tabData.values || [];
        console.log(`Tab "${tabName}": ${allData[tabName].length} rows`);
      }
    }

    if (action === "analyze") {
      const analysisPrompt = `Analyze this South African electricity tariff spreadsheet. Title: "${metadata.properties.title}", Tabs: ${sheetTabs.join(", ")}.

Sample data from each tab (first 30 rows):
${Object.entries(allData).map(([tab, rows]) => `
### Tab: ${tab}
${rows.slice(0, 30).map(r => r.join(" | ")).join("\n")}
`).join("\n")}

Identify:
1. How municipalities are organized (separate tabs? sections within tabs?)
2. What tariff categories exist (Domestic, Commercial, Industrial, etc.)
3. What tariff types (Fixed rate, IBT/block tariffs, TOU/time-of-use)
4. Rate structures (basic charges, energy rates, demand charges, block thresholds)
5. Any seasonal or time-of-use variations

Be specific about the data structure.`;

      const aiRes = await fetchWithRetry("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            { role: "system", content: "You are an expert in South African electricity tariff structures. Analyze spreadsheet data to identify municipalities, tariff categories, and rate structures." },
            { role: "user", content: analysisPrompt }
          ],
        }),
      });

      const aiData = await aiRes.json();
      const analysis = aiData.choices?.[0]?.message?.content || "Unable to analyze";

      return new Response(
        JSON.stringify({ 
          title: metadata.properties.title,
          tabs: sheetTabs, 
          rowCounts: Object.fromEntries(Object.entries(allData).map(([k, v]) => [k, v.length])),
          analysis,
          sampleData: Object.fromEntries(Object.entries(allData).map(([k, v]) => [k, v.slice(0, 5)]))
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "extract") {
      // Combine all data for extraction
      const combinedData = Object.entries(allData).map(([tab, rows]) => 
        `=== TAB: ${tab} ===\n${rows.slice(0, 150).map(r => r.join(" | ")).join("\n")}`
      ).join("\n\n");

      // Enhanced extraction prompt from process-tariff-file learnings
      const extractPrompt = `TASK: Extract electricity tariffs from this South African municipality data. Province: ${province}

SOURCE DATA:
${combinedData}

=== EXTRACTION RULES ===

1. TARIFF IDENTIFICATION:
   Look for section headers like "Domestic", "Commercial", "Industrial", "Agricultural", "Prepaid"
   Each distinct tariff structure = one tariff entry
   Each section starting with "Municipality Name - X%" is a separate municipality

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
   - Bulk supply tariffs → phase_type: "Three Phase"
   - >50kVA tariffs → phase_type: "Three Phase"
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

=== TOU TARIFF EXTRACTION (CRITICAL - MOST COMMONLY MISSED) ===

TOU tariffs MUST have energy rates for EACH combination:
- Seasons: "High/Winter" (June-Aug) AND "Low/Summer" (Sep-May)
- Periods: "Peak", "Standard", "Off-Peak"

That's 6 rate entries minimum for a complete TOU tariff!

Example TOU rates array:
[
  { "rate_per_kwh": 3.50, "season": "High/Winter", "time_of_use": "Peak" },
  { "rate_per_kwh": 1.80, "season": "High/Winter", "time_of_use": "Standard" },
  { "rate_per_kwh": 0.95, "season": "High/Winter", "time_of_use": "Off-Peak" },
  { "rate_per_kwh": 2.10, "season": "Low/Summer", "time_of_use": "Peak" },
  { "rate_per_kwh": 1.20, "season": "Low/Summer", "time_of_use": "Standard" },
  { "rate_per_kwh": 0.75, "season": "Low/Summer", "time_of_use": "Off-Peak" }
]

=== VOLTAGE LEVEL DETECTION (OFTEN MISSED) ===
- "Medium Voltage" or "MV" or "11kV/22kV" → voltage_level: "MV"
- "High Voltage" or "HV" or "132kV/66kV" → voltage_level: "HV"  
- "Low Voltage" or "LV" or domestic/small business → voltage_level: "LV"
- Scale 40T/40R/40X tariffs are typically "MV"
- Bulk supply >100kVA is typically "MV" or "HV"

=== WHEELING CHARGES (OFTEN MISSED) ===
If you see "Wheeling" tariffs/charges, extract them as SEPARATE tariffs.

=== DEMAND CHARGE HANDLING ===
- "R/kVA" charges → demand_charge_per_kva
- "R/A/month" (per-Amp) → Calculate for the stated amperage OR leave as demand_charge_per_kva
- "Capacity Charge" → demand_charge_per_kva if it's per-kVA

=== PRECISION RULE ===
Preserve EXACT values from source - do NOT round! 
If source says 3.9275, extract 3.9275 (not 3.93)

Extract ALL tariffs found. Each municipality may have 10-20+ different tariff structures. Be thorough and accurate.`;

      const aiRes = await fetchWithRetry("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            { role: "system", content: `You are an expert electricity tariff data extractor for South African municipalities. 

CRITICAL EXTRACTION RULES FROM LEARNED PATTERNS:

1. IBT BLOCK EXTRACTION:
   - "Block N (X - Y)kWh" → block_start_kwh: X, block_end_kwh: Y
   - "Block 4 (>600)kWh" → block_start_kwh: 600, block_end_kwh: null
   - EVERY IBT rate MUST have block_start_kwh and block_end_kwh!

2. TOU TARIFF COMPLETENESS (MOST COMMON ISSUE):
   - TOU tariffs MUST have rates for Peak/Standard/Off-Peak
   - MUST have rates for BOTH High/Winter AND Low/Summer seasons
   - That's 6 rate entries minimum! If you only have 1-2, you're missing rates!

3. VOLTAGE LEVEL (COMMONLY MISSED):
   - "Medium Voltage", "MV", Scale 40T/40R → voltage_level: "MV"
   - "High Voltage", "HV", "132kV" → voltage_level: "HV"
   - Bulk >100kVA typically "MV"

4. PHASE TYPE:
   - Bulk supply = "Three Phase"
   - >50kVA = "Three Phase"
   - Domestic ≤60A = "Single Phase"

5. SEPARATE CHARGES:
   - Extract "Wheeling" as separate tariffs
   - "Capacity Charge" per kVA → demand_charge_per_kva

6. PRECISION: Keep exact values (3.9275 not 3.93)
7. CONVERT c/kWh to R/kWh (divide by 100)

If your TOU tariff has empty or minimal rates, YOUR EXTRACTION IS WRONG.` },
            { role: "user", content: extractPrompt }
          ],
          tools: [{
            type: "function",
            function: {
              name: "save_tariffs",
              description: "Save NERSA-compliant tariff data with confidence score",
              parameters: {
                type: "object",
                properties: {
                  confidence_score: { 
                    type: "integer", 
                    minimum: 0, 
                    maximum: 100,
                    description: "Your confidence in the extraction accuracy (0-100)" 
                  },
                  tariffs: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        municipality: { type: "string", description: "Municipality name (without percentage)" },
                        category: { type: "string", description: "Domestic, Commercial, Industrial, Agricultural, Public Lighting, or Other" },
                        customer_category: { type: "string", enum: ["Domestic", "Commercial", "Industrial", "Agriculture", "Street Lighting"] },
                        tariff_name: { type: "string", description: "Full tariff name from document" },
                        tariff_type: { type: "string", enum: ["Fixed", "IBT", "TOU"] },
                        voltage_level: { type: "string", enum: ["LV", "MV", "HV"] },
                        capacity_kva: { type: "number", description: "Connection capacity in kVA" },
                        phase_type: { type: "string", enum: ["Single Phase", "Three Phase"] },
                        amperage_limit: { type: "string", description: "e.g., >20A, 60A, 100A" },
                        is_prepaid: { type: "boolean" },
                        fixed_monthly_charge: { type: "number", description: "Basic Charge in R/month" },
                        demand_charge_per_kva: { type: "number", description: "Per-kVA charges in Rands" },
                        reactive_energy_charge: { type: "number", description: "Reactive energy charge in R/kVArh" },
                        rates: {
                          type: "array",
                          description: "Energy rates in R/kWh. Convert c/kWh by dividing by 100.",
                          items: {
                            type: "object",
                            properties: {
                              rate_per_kwh: { type: "number", description: "Energy rate in R/kWh" },
                              block_start_kwh: { type: "number", description: "For IBT: start of block" },
                              block_end_kwh: { type: ["number", "null"], description: "For IBT: end of block" },
                              season: { type: "string", enum: ["All Year", "High/Winter", "Low/Summer"] },
                              time_of_use: { type: "string", enum: ["Any", "Peak", "Standard", "Off-Peak", "High Demand", "Low Demand"] },
                              reactive_energy_charge: { type: "number" }
                            },
                            required: ["rate_per_kwh"]
                          }
                        }
                      },
                      required: ["municipality", "category", "tariff_name", "tariff_type", "is_prepaid", "rates"]
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
        console.error("AI extraction failed:", errText);
        return new Response(
          JSON.stringify({ error: "AI extraction failed" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const aiData = await aiRes.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      
      if (!toolCall) {
        console.error("No tool call in response:", JSON.stringify(aiData));
        return new Response(
          JSON.stringify({ error: "AI did not return structured data" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let extractedTariffs: ExtractedTariff[];
      let confidenceScore: number | null = null;
      try {
        const args = JSON.parse(toolCall.function.arguments);
        extractedTariffs = args.tariffs;
        confidenceScore = args.confidence_score ?? null;
        console.log(`AI extracted ${extractedTariffs.length} tariffs with ${confidenceScore}% confidence`);
      } catch (e) {
        console.error("Failed to parse AI response:", e);
        return new Response(
          JSON.stringify({ error: "Failed to parse extracted data" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Save to database with incremental logic
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Get/create province
      const { data: provinces } = await supabase.from("provinces").select("id, name");
      const provinceMap = new Map(provinces?.map(p => [p.name.toLowerCase(), p.id]) || []);
      
      let provinceId = provinceMap.get(province.toLowerCase());
      if (!provinceId) {
        const { data: newProv } = await supabase.from("provinces").insert({ name: province }).select("id").single();
        if (newProv) {
          provinceId = newProv.id;
          provinceMap.set(province.toLowerCase(), provinceId);
        }
      }

      const { data: municipalities } = await supabase.from("municipalities").select("id, name, province_id");
      const { data: categories } = await supabase.from("tariff_categories").select("id, name");

      const municipalityMap = new Map(municipalities?.map(m => [m.name.toLowerCase(), { id: m.id, province_id: m.province_id }]) || []);
      const categoryMap = new Map(categories?.map(c => [c.name.toLowerCase(), c.id]) || []);

      let inserted = 0;
      let updated = 0;
      let skipped = 0;
      const errors: string[] = [];
      const municipalitiesImported = new Set<string>();

      for (const tariff of extractedTariffs) {
        try {
          // Get or create municipality
          const muniName = tariff.municipality.replace(/\s*-\s*\d+\.?\d*%$/, '').trim();
          let muniInfo = municipalityMap.get(muniName.toLowerCase());
          
          if (!muniInfo && provinceId) {
            const { data: newMuni } = await supabase
              .from("municipalities")
              .insert({ name: muniName, province_id: provinceId })
              .select("id, province_id")
              .single();
            if (newMuni) {
              muniInfo = { id: newMuni.id, province_id: newMuni.province_id };
              municipalityMap.set(muniName.toLowerCase(), muniInfo);
            }
          }

          // Get or create category
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

          if (!muniInfo || !categoryId) {
            errors.push(`${tariff.tariff_name}: Missing municipality or category`);
            skipped++;
            continue;
          }

          // Check if tariff already exists (incremental logic)
          const { data: existingTariff } = await supabase
            .from("tariffs")
            .select("id, name")
            .eq("municipality_id", muniInfo.id)
            .eq("category_id", categoryId)
            .ilike("name", tariff.tariff_name)
            .maybeSingle();

          if (existingTariff) {
            // Update existing tariff
            const { error: updateErr } = await supabase
              .from("tariffs")
              .update({
                tariff_type: tariff.tariff_type,
                phase_type: tariff.phase_type || "Single Phase",
                fixed_monthly_charge: tariff.fixed_monthly_charge || 0,
                demand_charge_per_kva: tariff.demand_charge_per_kva || 0,
                is_prepaid: tariff.is_prepaid,
                amperage_limit: tariff.amperage_limit || null,
                voltage_level: tariff.voltage_level || "LV",
                reactive_energy_charge: tariff.reactive_energy_charge || null,
                capacity_kva: tariff.capacity_kva || null,
                customer_category: tariff.customer_category || null,
              })
              .eq("id", existingTariff.id);

            if (updateErr) {
              errors.push(`${tariff.tariff_name}: ${updateErr.message}`);
              skipped++;
              continue;
            }

            // Delete old rates and insert new ones
            await supabase.from("tariff_rates").delete().eq("tariff_id", existingTariff.id);
            
            if (tariff.rates) {
              for (const rate of tariff.rates) {
                await supabase.from("tariff_rates").insert({
                  tariff_id: existingTariff.id,
                  rate_per_kwh: rate.rate_per_kwh,
                  block_start_kwh: rate.block_start_kwh ?? 0,
                  block_end_kwh: rate.block_end_kwh ?? null,
                  season: rate.season || "All Year",
                  time_of_use: rate.time_of_use || "Any",
                  reactive_energy_charge: rate.reactive_energy_charge || null,
                });
              }
            }

            municipalitiesImported.add(muniName);
            updated++;
          } else {
            // Create new tariff
            const { data: newTariff, error: tariffErr } = await supabase
              .from("tariffs")
              .insert({
                name: tariff.tariff_name,
                municipality_id: muniInfo.id,
                category_id: categoryId,
                tariff_type: tariff.tariff_type,
                phase_type: tariff.phase_type || "Single Phase",
                fixed_monthly_charge: tariff.fixed_monthly_charge || 0,
                demand_charge_per_kva: tariff.demand_charge_per_kva || 0,
                is_prepaid: tariff.is_prepaid,
                amperage_limit: tariff.amperage_limit || null,
                voltage_level: tariff.voltage_level || "LV",
                reactive_energy_charge: tariff.reactive_energy_charge || null,
                capacity_kva: tariff.capacity_kva || null,
                customer_category: tariff.customer_category || null,
              })
              .select("id")
              .single();

            if (tariffErr) {
              errors.push(`${tariff.tariff_name}: ${tariffErr.message}`);
              skipped++;
              continue;
            }

            // Create rates
            if (tariff.rates && newTariff) {
              for (const rate of tariff.rates) {
                await supabase.from("tariff_rates").insert({
                  tariff_id: newTariff.id,
                  rate_per_kwh: rate.rate_per_kwh,
                  block_start_kwh: rate.block_start_kwh ?? 0,
                  block_end_kwh: rate.block_end_kwh ?? null,
                  season: rate.season || "All Year",
                  time_of_use: rate.time_of_use || "Any",
                  reactive_energy_charge: rate.reactive_energy_charge || null,
                });
              }
            }

            municipalitiesImported.add(muniName);
            inserted++;
          }
        } catch (e) {
          errors.push(`${tariff.tariff_name}: ${e instanceof Error ? e.message : "Unknown error"}`);
          skipped++;
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          extracted: extractedTariffs.length,
          inserted,
          updated,
          skipped,
          confidence: confidenceScore,
          municipalities: Array.from(municipalitiesImported),
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
    console.error("AI import error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Import failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
