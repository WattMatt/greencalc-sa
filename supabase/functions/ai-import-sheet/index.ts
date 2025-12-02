import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SheetMetadata {
  spreadsheetId: string;
  properties: { title: string };
  sheets: Array<{ properties: { sheetId: number; title: string } }>;
}

interface ExtractedTariff {
  province: string;
  municipality: string;
  category: string;
  tariff_name: string;
  tariff_type: string;
  phase_type?: string;
  fixed_monthly_charge?: number;
  demand_charge_per_kva?: number;
  is_prepaid?: boolean;
  amperage_limit?: string;
  rates?: Array<{
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
    throw new Error("Invalid service account credentials - missing client_email or private_key");
  }

  // Import the private key
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = private_key
    .replace(pemHeader, "")
    .replace(pemFooter, "")
    .replace(/\s/g, "");
  
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  // Create JWT
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

  // Exchange JWT for access token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error("Token exchange failed:", errorText);
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
    const { sheetId, action = "analyze" } = await req.json();
    
    if (!sheetId) {
      return new Response(
        JSON.stringify({ error: "Sheet ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    
    // Get access token using service account
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

    // Step 1: Get sheet metadata (all tabs)
    console.log("Fetching sheet metadata for:", sheetId);
    const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`;
    const metadataRes = await fetch(metadataUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (!metadataRes.ok) {
      const errorText = await metadataRes.text();
      console.error("Sheet metadata error:", metadataRes.status, errorText);
      
      let errorMessage = "Failed to access sheet.";
      try {
        const errorJson = JSON.parse(errorText);
        const apiError = errorJson.error?.message || errorJson.error?.status;
        if (metadataRes.status === 403 || metadataRes.status === 404) {
          errorMessage = "Cannot access sheet. Make sure the sheet is shared with the service account email.";
        } else if (apiError) {
          errorMessage = apiError;
        }
      } catch {}
      
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const metadata: SheetMetadata = await metadataRes.json();
    const sheetTabs = metadata.sheets.map(s => s.properties.title);
    console.log("Found tabs:", sheetTabs);

    // Step 2: Fetch data from each tab
    const allData: Record<string, string[][]> = {};
    
    for (const tabName of sheetTabs) {
      const dataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(tabName)}`;
      const dataRes = await fetch(dataUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      if (dataRes.ok) {
        const tabData = await dataRes.json();
        allData[tabName] = tabData.values || [];
        console.log(`Tab "${tabName}": ${allData[tabName].length} rows`);
      }
    }

    // If just analyzing, return the structure
    if (action === "analyze") {
      // Use AI to analyze the structure
      const analysisPrompt = `Analyze this Google Sheet structure and describe what data it contains. The sheet is called "${metadata.properties.title}" and has these tabs: ${sheetTabs.join(", ")}.

Here's a sample of the data from each tab (first 5 rows):
${Object.entries(allData).map(([tab, rows]) => `
### Tab: ${tab}
${rows.slice(0, 5).map(r => r.join(" | ")).join("\n")}
`).join("\n")}

Identify:
1. Which tabs appear to be provinces or regions
2. What municipalities are mentioned
3. What tariff/pricing structures are present
4. The general organization of the data

Be concise.`;

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You are a data analyst helping to understand spreadsheet structures for electricity tariff data. Be concise and focus on the structure." },
            { role: "user", content: analysisPrompt }
          ],
        }),
      });

      if (!aiRes.ok) {
        console.error("AI analysis failed:", await aiRes.text());
        return new Response(
          JSON.stringify({ 
            tabs: sheetTabs, 
            rowCounts: Object.fromEntries(Object.entries(allData).map(([k, v]) => [k, v.length])),
            analysis: "AI analysis unavailable - showing raw structure"
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const aiData = await aiRes.json();
      const analysis = aiData.choices?.[0]?.message?.content || "Unable to analyze";

      return new Response(
        JSON.stringify({ 
          title: metadata.properties.title,
          tabs: sheetTabs, 
          rowCounts: Object.fromEntries(Object.entries(allData).map(([k, v]) => [k, v.length])),
          analysis,
          sampleData: Object.fromEntries(
            Object.entries(allData).map(([k, v]) => [k, v.slice(0, 3)])
          )
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: AI extraction of tariff data
    if (action === "extract") {
      const extractPrompt = `Extract electricity tariff data from this spreadsheet. The sheet is "${metadata.properties.title}" with tabs: ${sheetTabs.join(", ")}.

Data from each tab:
${Object.entries(allData).map(([tab, rows]) => `
### Tab: ${tab}
${rows.slice(0, 50).map(r => r.join(" | ")).join("\n")}
`).join("\n")}

Extract all tariffs and return them as structured data. For each tariff, identify:
- Province (from tab name or data)
- Municipality name
- Category (Residential, Commercial, Industrial, Agricultural, etc.)
- Tariff name
- Tariff type (Fixed, IBT for inclining block, TOU for time-of-use)
- Fixed monthly charges if any
- Energy rates (c/kWh or R/kWh - convert all to c/kWh)
- Block thresholds for IBT tariffs
- Season and time-of-use periods if applicable`;

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You are a data extraction expert for South African electricity tariffs. Extract structured tariff data accurately." },
            { role: "user", content: extractPrompt }
          ],
          tools: [{
            type: "function",
            function: {
              name: "save_tariffs",
              description: "Save extracted tariff data to the database",
              parameters: {
                type: "object",
                properties: {
                  tariffs: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        province: { type: "string" },
                        municipality: { type: "string" },
                        category: { type: "string" },
                        tariff_name: { type: "string" },
                        tariff_type: { type: "string", enum: ["Fixed", "IBT", "TOU"] },
                        phase_type: { type: "string", enum: ["Single Phase", "Three Phase"] },
                        fixed_monthly_charge: { type: "number" },
                        demand_charge_per_kva: { type: "number" },
                        is_prepaid: { type: "boolean" },
                        amperage_limit: { type: "string" },
                        rates: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              rate_per_kwh: { type: "number", description: "Rate in c/kWh" },
                              block_start_kwh: { type: "number" },
                              block_end_kwh: { type: "number" },
                              season: { type: "string" },
                              time_of_use: { type: "string" }
                            },
                            required: ["rate_per_kwh"]
                          }
                        }
                      },
                      required: ["province", "municipality", "category", "tariff_name", "tariff_type"]
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

      // Get/create lookup maps
      const { data: provinces } = await supabase.from("provinces").select("id, name");
      const { data: municipalities } = await supabase.from("municipalities").select("id, name, province_id");
      const { data: categories } = await supabase.from("tariff_categories").select("id, name");

      const provinceMap = new Map(provinces?.map(p => [p.name.toLowerCase(), p.id]) || []);
      const municipalityMap = new Map(municipalities?.map(m => [m.name.toLowerCase(), { id: m.id, province_id: m.province_id }]) || []);
      const categoryMap = new Map(categories?.map(c => [c.name.toLowerCase(), c.id]) || []);

      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const tariff of extractedTariffs) {
        try {
          // Get or create province
          let provinceId = provinceMap.get(tariff.province.toLowerCase());
          if (!provinceId) {
            const { data: newProv } = await supabase
              .from("provinces")
              .insert({ name: tariff.province })
              .select("id")
              .single();
            if (newProv) {
              provinceId = newProv.id;
              provinceMap.set(tariff.province.toLowerCase(), provinceId);
            }
          }

          // Get or create municipality
          let muniInfo = municipalityMap.get(tariff.municipality.toLowerCase());
          if (!muniInfo && provinceId) {
            const { data: newMuni } = await supabase
              .from("municipalities")
              .insert({ name: tariff.municipality, province_id: provinceId })
              .select("id, province_id")
              .single();
            if (newMuni) {
              muniInfo = { id: newMuni.id, province_id: newMuni.province_id };
              municipalityMap.set(tariff.municipality.toLowerCase(), muniInfo);
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
              is_prepaid: tariff.is_prepaid || false,
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
    console.error("AI import error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Import failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
