import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import { create } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExtractedLoadProfile {
  name: string;
  category: string;
  description?: string;
  kwh_per_sqm_month: number;
  load_profile_weekday: number[];
  load_profile_weekend?: number[];
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
      
      if (response.status === 400 || response.status === 401 || response.status === 403) {
        return response;
      }
      
      lastError = new Error(`HTTP ${response.status}: ${await response.text()}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Attempt ${attempt} failed:`, lastError.message);
    }
    
    if (attempt < maxRetries) {
      const delay = Math.pow(2, attempt) * 1000;
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
    const { sheetId, action = "analyze", existingCategories = [] } = await req.json();
    
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
      const analysisPrompt = `Analyze this spreadsheet containing shop/tenant energy consumption data for load profile extraction.
Title: "${metadata.properties.title}"
Tabs: ${sheetTabs.join(", ")}

Sample data from each tab (first 40 rows):
${Object.entries(allData).map(([tab, rows]) => `
### Tab: ${tab}
${rows.slice(0, 40).map(r => r.join(" | ")).join("\n")}
`).join("\n")}

Identify:
1. What shop types/tenant categories are listed (e.g., restaurants, retail, supermarkets, cinemas)
2. What consumption metrics exist (kWh/sqm/month, total kWh, consumption per hour, etc.)
3. Is there hourly load profile data (24 hours)? What format?
4. Are there different profiles for weekday vs weekend?
5. What sector/category groupings can you identify?

Describe the data structure and how shop types and their consumption patterns are organized.`;

      const aiRes = await fetchWithRetry("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            { role: "system", content: "You are an expert in commercial building energy consumption patterns. Analyze spreadsheet data to identify shop types and their energy consumption characteristics for load profile modeling." },
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
        `=== TAB: ${tab} ===\n${rows.slice(0, 200).map(r => r.join(" | ")).join("\n")}`
      ).join("\n\n");

      const extractPrompt = `TASK: Extract shop type load profiles from this energy consumption spreadsheet.

EXISTING CATEGORIES IN DATABASE: ${existingCategories.length > 0 ? existingCategories.join(", ") : "None yet - you should suggest appropriate categories"}

SOURCE DATA:
${combinedData}

=== EXTRACTION RULES ===

1. SHOP TYPE IDENTIFICATION:
   - Each distinct shop/tenant type = one load profile entry
   - Look for names like: Restaurant, Cafe, Supermarket, Cinema, Bank, Hair Salon, Gym, Retail, Fashion, Electronics, etc.
   - Group similar types appropriately

2. CATEGORY MAPPING:
   Map each shop type to one of these categories (or suggest new ones if needed):
   - Food & Beverage (restaurants, cafes, fast food, bars)
   - Retail - Fashion (clothing, shoes, accessories)
   - Retail - General (electronics, homeware, gifts)
   - Grocery & Supermarket
   - Entertainment (cinema, arcade, bowling)
   - Services (bank, salon, spa, laundry, post office)
   - Health & Fitness (gym, pharmacy, clinic)
   - Other

3. CONSUMPTION RATE (kwh_per_sqm_month):
   - Extract or calculate kWh per square meter per month
   - If only total kWh given, estimate based on typical shop sizes
   - If hourly data given, sum to daily then monthly
   - Typical ranges: Restaurants 80-200, Retail 30-60, Supermarket 70-120, Cinema 80-100

4. 24-HOUR LOAD PROFILE:
   - Extract hourly consumption pattern (must be 24 values for hours 0-23)
   - Normalize so values represent percentage of daily consumption per hour
   - If no hourly data, estimate based on typical operating hours
   - Example: Restaurant peak at lunch (12-14) and dinner (18-21)
   
5. WEEKEND PROFILE (if available):
   - Extract separate weekend pattern if data shows different weekend behavior
   - If not available, can use same as weekday or estimate

=== PROFILE ESTIMATION GUIDELINES ===

If hourly data is not explicitly provided, estimate based on:
- Operating hours (when is the shop open?)
- Peak business hours (when are customers most active?)
- Equipment operation (HVAC, refrigeration, lighting schedules)

Example weekday profile for a restaurant (values are % of daily consumption):
[1, 1, 1, 1, 1, 2, 4, 6, 8, 8, 10, 12, 10, 8, 6, 5, 5, 7, 10, 10, 8, 5, 3, 2]

=== OUTPUT FORMAT ===

For each shop type found, provide:
- name: Clear shop type name
- category: Category from the list above (or new if justified)
- description: Brief description of the shop type
- kwh_per_sqm_month: Consumption intensity (numeric)
- load_profile_weekday: Array of 24 numbers (percentage per hour, should roughly sum to 100)
- load_profile_weekend: Array of 24 numbers (optional, if different from weekday)

BE THOROUGH: Extract ALL distinct shop types found in the data.`;

      const aiRes = await fetchWithRetry("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            { role: "system", content: `You are an expert in commercial building energy consumption and load profile analysis. 
Extract shop type load profiles from spreadsheet data, intelligently mapping various data formats to our schema.
Always provide complete 24-hour load profiles (arrays of 24 values).
Normalize profiles so hourly values represent percentage of daily consumption.` },
            { role: "user", content: extractPrompt }
          ],
          tools: [{
            type: "function",
            function: {
              name: "save_load_profiles",
              description: "Save extracted load profiles to the database",
              parameters: {
                type: "object",
                properties: {
                  confidence_score: { 
                    type: "integer", 
                    minimum: 0, 
                    maximum: 100,
                    description: "Your confidence in the extraction accuracy (0-100)" 
                  },
                  new_categories: {
                    type: "array",
                    items: { type: "string" },
                    description: "New categories to create (if any existing categories don't fit)"
                  },
                  profiles: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Shop type name (e.g., Fine Dining Restaurant)" },
                        category: { type: "string", description: "Category name (must match existing or new_categories)" },
                        description: { type: "string", description: "Brief description" },
                        kwh_per_sqm_month: { type: "number", description: "kWh per square meter per month" },
                        load_profile_weekday: { 
                          type: "array", 
                          items: { type: "number" },
                          description: "24 values for hourly consumption (% of daily total)" 
                        },
                        load_profile_weekend: { 
                          type: "array", 
                          items: { type: "number" },
                          description: "24 values for weekend hourly consumption (optional)" 
                        }
                      },
                      required: ["name", "category", "kwh_per_sqm_month", "load_profile_weekday"]
                    }
                  }
                },
                required: ["confidence_score", "profiles"]
              }
            }
          }],
          tool_choice: { type: "function", function: { name: "save_load_profiles" } }
        }),
      });

      const aiData = await aiRes.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      
      if (!toolCall) {
        return new Response(
          JSON.stringify({ error: "AI failed to extract load profiles", raw: aiData }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const extracted = JSON.parse(toolCall.function.arguments);
      console.log(`Extracted ${extracted.profiles?.length || 0} profiles with ${extracted.confidence_score}% confidence`);
      
      // Validate and normalize profiles
      const validatedProfiles = (extracted.profiles || []).map((p: ExtractedLoadProfile) => {
        // Ensure 24-hour arrays
        let weekday = p.load_profile_weekday || [];
        if (weekday.length !== 24) {
          // Pad or truncate to 24
          weekday = Array.from({ length: 24 }, (_, i) => weekday[i] || 4.17);
        }
        
        // Normalize to sum to ~100
        const sum = weekday.reduce((a, b) => a + b, 0);
        if (sum > 0 && Math.abs(sum - 100) > 5) {
          weekday = weekday.map(v => (v / sum) * 100);
        }

        let weekend = p.load_profile_weekend || weekday;
        if (weekend.length !== 24) {
          weekend = Array.from({ length: 24 }, (_, i) => weekend[i] || weekday[i] || 4.17);
        }
        const weekendSum = weekend.reduce((a, b) => a + b, 0);
        if (weekendSum > 0 && Math.abs(weekendSum - 100) > 5) {
          weekend = weekend.map(v => (v / weekendSum) * 100);
        }

        return {
          ...p,
          load_profile_weekday: weekday,
          load_profile_weekend: weekend,
          kwh_per_sqm_month: p.kwh_per_sqm_month || 50
        };
      });

      return new Response(
        JSON.stringify({
          confidence_score: extracted.confidence_score,
          new_categories: extracted.new_categories || [],
          profiles: validatedProfiles,
          profiles_count: validatedProfiles.length
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
