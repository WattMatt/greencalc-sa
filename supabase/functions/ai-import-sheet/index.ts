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
  rates: Array<{
    rate_per_kwh: number;
    block_start_kwh?: number;
    block_end_kwh?: number;
    season?: string;
    time_of_use?: string;
  }>;
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

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
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
        `=== TAB: ${tab} ===\n${rows.slice(0, 100).map(r => r.join(" | ")).join("\n")}`
      ).join("\n\n");

      const extractPrompt = `Extract all electricity tariffs from this South African municipality data. Province: ${province}

DATA:
${combinedData}

EXTRACTION RULES:
1. Each section starting with "Municipality Name - X%" is a separate municipality
2. Categories: Domestic, Commercial, Industrial, Agricultural, Public Lighting
3. Tariff types:
   - "IBT" for block tariffs with Block 1, Block 2, etc. (0-50kWh, 51-350kWh, etc.)
   - "TOU" for time-of-use tariffs with Peak/Standard/Off-peak and Low/High Season
   - "Fixed" for simple basic charge + single energy rate
4. Extract ALL rates found, including:
   - Basic charge (R/month or R/day converted to R/month)
   - Energy rates (c/kWh) with block thresholds if IBT
   - Demand charges (R/kVA) if present
   - For TOU: extract each season+period combination as separate rate
5. Phase type: "Single Phase" or "Three Phase" if mentioned
6. Amperage: extract from descriptions like "15A", "60A", "100A"
7. Prepaid: true if "Prepaid" mentioned, false otherwise

Return ALL tariffs found. Each municipality may have 10-20+ different tariff structures.`;

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You are a data extraction expert specializing in South African electricity tariffs. Extract structured tariff data accurately and completely." },
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
                        municipality: { type: "string", description: "Municipality name (without percentage)" },
                        category: { type: "string", description: "Domestic, Commercial, Industrial, Agricultural, or Public Lighting" },
                        tariff_name: { type: "string", description: "Descriptive name like 'Prepaid Single Phase 60A' or 'Domestic IBT Conventional'" },
                        tariff_type: { type: "string", enum: ["Fixed", "IBT", "TOU"] },
                        phase_type: { type: "string", enum: ["Single Phase", "Three Phase"] },
                        amperage_limit: { type: "string", description: "e.g., '60A', '15-32A', '100A'" },
                        is_prepaid: { type: "boolean" },
                        fixed_monthly_charge: { type: "number", description: "Basic/service charge in Rands per month" },
                        demand_charge_per_kva: { type: "number", description: "Demand charge in R/kVA if applicable" },
                        rates: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              rate_per_kwh: { type: "number", description: "Energy rate in c/kWh" },
                              block_start_kwh: { type: "number", description: "Block start (0, 51, 351, etc.)" },
                              block_end_kwh: { type: "number", description: "Block end (50, 350, 600, null for unlimited)" },
                              season: { type: "string", enum: ["All Year", "High/Winter", "Low/Summer"] },
                              time_of_use: { type: "string", enum: ["Any", "Peak", "Standard", "Off-Peak"] }
                            },
                            required: ["rate_per_kwh"]
                          }
                        }
                      },
                      required: ["municipality", "category", "tariff_name", "tariff_type", "is_prepaid", "rates"]
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
        console.error("No tool call in response:", JSON.stringify(aiData));
        return new Response(
          JSON.stringify({ error: "AI did not return structured data" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let extractedTariffs: ExtractedTariff[];
      try {
        const args = JSON.parse(toolCall.function.arguments);
        extractedTariffs = args.tariffs;
        console.log(`AI extracted ${extractedTariffs.length} tariffs`);
      } catch (e) {
        console.error("Failed to parse AI response:", e);
        return new Response(
          JSON.stringify({ error: "Failed to parse extracted data" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Save to database
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

      let imported = 0;
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

          // Create tariff
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
                block_start_kwh: rate.block_start_kwh || 0,
                block_end_kwh: rate.block_end_kwh || null,
                season: rate.season || "All Year",
                time_of_use: rate.time_of_use || "Any",
              });
            }
          }

          municipalitiesImported.add(muniName);
          imported++;
        } catch (e) {
          errors.push(`${tariff.tariff_name}: ${e instanceof Error ? e.message : "Unknown error"}`);
          skipped++;
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          extracted: extractedTariffs.length,
          imported,
          skipped,
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
