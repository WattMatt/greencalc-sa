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
  trading_hours?: { open: number; close: number };
  seasonal_variation?: "summer_heavy" | "winter_heavy" | "balanced";
  confidence?: number;
  source_tab?: string;
  warnings?: string[];
}

interface FormatDetection {
  layout: "horizontal" | "vertical" | "matrix" | "unknown";
  hourFormat: "0-23" | "1-24" | "12h" | "hhmm" | "unknown";
  unitType: "kwh" | "wh" | "kw" | "percentage" | "unknown";
  unitPeriod: "hour" | "day" | "month" | "year" | "unknown";
  hasWeekendData: boolean;
  hasSeasonalData: boolean;
  columnPatterns: string[];
  detectedCategories: string[];
}

// Standard consumption rates for validation (kWh/sqm/month)
const CONSUMPTION_RANGES: Record<string, { min: number; max: number; typical: number }> = {
  "restaurant": { min: 60, max: 250, typical: 120 },
  "cafe": { min: 40, max: 150, typical: 80 },
  "fast food": { min: 80, max: 200, typical: 130 },
  "supermarket": { min: 50, max: 150, typical: 90 },
  "grocery": { min: 40, max: 120, typical: 70 },
  "retail": { min: 20, max: 80, typical: 45 },
  "fashion": { min: 20, max: 70, typical: 40 },
  "cinema": { min: 60, max: 120, typical: 85 },
  "gym": { min: 50, max: 150, typical: 90 },
  "bank": { min: 40, max: 100, typical: 65 },
  "salon": { min: 30, max: 100, typical: 55 },
  "pharmacy": { min: 30, max: 90, typical: 50 },
  "electronics": { min: 30, max: 90, typical: 55 },
  "default": { min: 20, max: 200, typical: 50 }
};

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

// Detect spreadsheet format patterns
function detectFormat(allData: Record<string, string[][]>): FormatDetection {
  const detection: FormatDetection = {
    layout: "unknown",
    hourFormat: "unknown",
    unitType: "unknown",
    unitPeriod: "unknown",
    hasWeekendData: false,
    hasSeasonalData: false,
    columnPatterns: [],
    detectedCategories: []
  };

  // Combine headers from all tabs
  const allHeaders: string[] = [];
  Object.values(allData).forEach(rows => {
    if (rows.length > 0) {
      allHeaders.push(...rows[0].map(h => String(h || "").toLowerCase()));
      if (rows.length > 1) {
        allHeaders.push(...rows[1].map(h => String(h || "").toLowerCase()));
      }
    }
  });

  const headerText = allHeaders.join(" ");

  // Detect hour format
  const hourPatterns = {
    "0-23": /\b(hour\s*0|h0|00:00|0h)\b/i,
    "1-24": /\b(hour\s*1[^0-9]|h1[^0-9]|01:00)\b/i,
    "12h": /\b(12\s*am|12\s*pm|1\s*am|1\s*pm)\b/i,
    "hhmm": /\b\d{2}:\d{2}\b/
  };
  
  for (const [format, pattern] of Object.entries(hourPatterns)) {
    if (pattern.test(headerText)) {
      detection.hourFormat = format as any;
      break;
    }
  }

  // Detect unit type
  if (/kwh\s*\/\s*m[²2]|kwh\/sqm/i.test(headerText)) {
    detection.unitType = "kwh";
    detection.unitPeriod = /\/\s*(month|mo)/i.test(headerText) ? "month" : 
                           /\/\s*(year|yr|annual)/i.test(headerText) ? "year" :
                           /\/\s*(day|daily)/i.test(headerText) ? "day" : "month";
  } else if (/wh\b/i.test(headerText)) {
    detection.unitType = "wh";
  } else if (/kw\b/i.test(headerText) && !/kwh/i.test(headerText)) {
    detection.unitType = "kw";
  } else if (/%|percent/i.test(headerText)) {
    detection.unitType = "percentage";
  }

  // Detect weekend/seasonal data
  detection.hasWeekendData = /weekend|saturday|sunday|sat\b|sun\b/i.test(headerText);
  detection.hasSeasonalData = /summer|winter|season|high\s*demand|low\s*demand/i.test(headerText);

  // Detect layout
  const hasHourColumns = /hour|h[0-9]|[0-9]{2}:[0-9]{2}|[0-9]h/i.test(headerText);
  const hasShopRows = /shop|tenant|store|type|name|category/i.test(headerText);
  
  if (hasHourColumns && hasShopRows) {
    detection.layout = "horizontal"; // Shops in rows, hours in columns
  } else if (hasHourColumns) {
    detection.layout = "vertical"; // Hours in rows
  } else {
    detection.layout = "matrix";
  }

  // Extract column patterns
  Object.values(allData).forEach(rows => {
    if (rows.length > 0) {
      detection.columnPatterns.push(...rows[0].filter(h => h).map(h => String(h)));
    }
  });

  // Try to detect categories from data
  const categoryKeywords = ["food", "beverage", "retail", "fashion", "entertainment", "service", "health", "grocery"];
  allHeaders.forEach(h => {
    categoryKeywords.forEach(cat => {
      if (h.includes(cat) && !detection.detectedCategories.includes(cat)) {
        detection.detectedCategories.push(cat);
      }
    });
  });

  return detection;
}

// Validate and normalize a single profile
function validateProfile(profile: ExtractedLoadProfile, existingProfiles: ExtractedLoadProfile[]): ExtractedLoadProfile {
  const warnings: string[] = [];
  
  // Ensure 24-hour arrays
  let weekday = profile.load_profile_weekday || [];
  if (weekday.length !== 24) {
    warnings.push(`Weekday profile had ${weekday.length} values, normalized to 24`);
    weekday = Array.from({ length: 24 }, (_, i) => weekday[i] || 4.17);
  }
  
  // Normalize to sum to ~100
  const sum = weekday.reduce((a, b) => a + b, 0);
  if (sum > 0 && Math.abs(sum - 100) > 5) {
    weekday = weekday.map(v => Math.round((v / sum) * 100 * 100) / 100);
  }

  // Handle weekend profile
  let weekend = profile.load_profile_weekend || [...weekday];
  if (weekend.length !== 24) {
    warnings.push(`Weekend profile had ${weekend.length} values, normalized to 24`);
    weekend = Array.from({ length: 24 }, (_, i) => weekend[i] || weekday[i] || 4.17);
  }
  const weekendSum = weekend.reduce((a, b) => a + b, 0);
  if (weekendSum > 0 && Math.abs(weekendSum - 100) > 5) {
    weekend = weekend.map(v => Math.round((v / weekendSum) * 100 * 100) / 100);
  }

  // Validate consumption rate
  let kwhPerSqm = profile.kwh_per_sqm_month || 50;
  const lowerName = profile.name.toLowerCase();
  let rangeKey = "default";
  for (const key of Object.keys(CONSUMPTION_RANGES)) {
    if (lowerName.includes(key)) {
      rangeKey = key;
      break;
    }
  }
  const range = CONSUMPTION_RANGES[rangeKey];
  
  if (kwhPerSqm < range.min || kwhPerSqm > range.max) {
    warnings.push(`Consumption ${kwhPerSqm} kWh/sqm/month outside typical range (${range.min}-${range.max}), using typical value`);
    if (kwhPerSqm < range.min * 0.5 || kwhPerSqm > range.max * 2) {
      kwhPerSqm = range.typical;
    }
  }

  // Check for duplicates
  const isDuplicate = existingProfiles.some(p => 
    p.name.toLowerCase() === profile.name.toLowerCase() ||
    (levenshteinDistance(p.name.toLowerCase(), profile.name.toLowerCase()) < 3)
  );
  if (isDuplicate) {
    warnings.push("Possible duplicate profile detected");
  }

  // Detect operating hours from profile
  const peakHours = weekday.map((v, i) => ({ hour: i, value: v }))
    .filter(h => h.value > 5)
    .map(h => h.hour);
  
  const tradingHours = peakHours.length > 0 ? {
    open: Math.min(...peakHours),
    close: Math.max(...peakHours) + 1
  } : { open: 8, close: 18 };

  // Determine seasonal variation
  let seasonal: "summer_heavy" | "winter_heavy" | "balanced" = "balanced";
  if (lowerName.includes("hvac") || lowerName.includes("air con")) {
    seasonal = "summer_heavy";
  } else if (lowerName.includes("heating") || lowerName.includes("restaurant")) {
    seasonal = "winter_heavy";
  }

  // Calculate confidence
  let confidence = profile.confidence || 70;
  if (warnings.length > 0) confidence -= warnings.length * 10;
  if (sum > 95 && sum < 105) confidence += 5;
  confidence = Math.max(20, Math.min(100, confidence));

  return {
    ...profile,
    load_profile_weekday: weekday,
    load_profile_weekend: weekend,
    kwh_per_sqm_month: Math.round(kwhPerSqm * 10) / 10,
    trading_hours: tradingHours,
    seasonal_variation: seasonal,
    confidence,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

// Simple Levenshtein distance for duplicate detection
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

// Convert various units to kWh/sqm/month
function convertToKwhPerSqmMonth(value: number, unitType: string, unitPeriod: string): number {
  let result = value;
  
  // Convert to kWh
  if (unitType === "wh") result = value / 1000;
  if (unitType === "kw") result = value * 8; // Assume 8 operating hours
  
  // Convert to per month
  if (unitPeriod === "hour") result = result * 8 * 30; // 8 hours/day, 30 days
  if (unitPeriod === "day") result = result * 30;
  if (unitPeriod === "year") result = result / 12;
  
  return Math.round(result * 10) / 10;
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

    // Fetch data from all tabs (increased row limit)
    const allData: Record<string, string[][]> = {};
    const fetchPromises = sheetTabs.map(async (tabName: string) => {
      const dataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(tabName)}!A1:AZ500`;
      const dataRes = await fetch(dataUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (dataRes.ok) {
        const tabData = await dataRes.json();
        allData[tabName] = tabData.values || [];
        console.log(`Tab "${tabName}": ${allData[tabName].length} rows`);
      }
    });
    await Promise.all(fetchPromises);

    // Detect format patterns
    const formatDetection = detectFormat(allData);
    console.log("Format detection:", formatDetection);

    if (action === "analyze") {
      const analysisPrompt = `Analyze this spreadsheet containing shop/tenant energy consumption data for load profile extraction.

SPREADSHEET INFO:
Title: "${metadata.properties.title}"
Tabs: ${sheetTabs.join(", ")}

DETECTED FORMAT PATTERNS:
- Layout: ${formatDetection.layout} (${formatDetection.layout === "horizontal" ? "shops in rows, hours in columns" : "hours in rows"})
- Hour Format: ${formatDetection.hourFormat}
- Unit Type: ${formatDetection.unitType} per ${formatDetection.unitPeriod}
- Has Weekend Data: ${formatDetection.hasWeekendData}
- Has Seasonal Data: ${formatDetection.hasSeasonalData}
- Column Headers: ${formatDetection.columnPatterns.slice(0, 20).join(", ")}

SAMPLE DATA FROM EACH TAB (first 60 rows):
${Object.entries(allData).map(([tab, rows]) => `
### Tab: ${tab}
${rows.slice(0, 60).map((r, i) => `Row ${i + 1}: ${r.join(" | ")}`).join("\n")}
`).join("\n")}

ANALYZE AND IDENTIFY:
1. Shop types/tenant categories found (be specific - e.g., "Fine Dining Restaurant" not just "Restaurant")
2. Consumption metrics and their units (kWh/sqm/month, total kWh/day, etc.)
3. Hourly load profile data format (if present)
4. Weekday vs weekend profile availability
5. Any seasonal or time-of-use variations
6. Operating/trading hours for different shop types
7. Data quality issues (missing values, inconsistent formats)
8. Category groupings and hierarchy

Describe the data structure and provide recommendations for extraction.`;

      const aiRes = await fetchWithRetry("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            { role: "system", content: `You are an expert in commercial building energy consumption patterns and load profile analysis for South African retail centers.
You understand HVAC loads, refrigeration cycles, lighting schedules, and how different retail/commercial tenant types consume energy throughout the day.
Analyze spreadsheet data to identify shop types and their energy consumption characteristics for solar PV and battery storage modeling.` },
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
          formatDetection,
          sampleData: Object.fromEntries(Object.entries(allData).map(([k, v]) => [k, v.slice(0, 5)]))
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "extract") {
      // Combine all data for extraction with more context
      const combinedData = Object.entries(allData).map(([tab, rows]) => 
        `=== TAB: ${tab} ===\n${rows.slice(0, 300).map((r, i) => `Row ${i + 1}: ${r.join(" | ")}`).join("\n")}`
      ).join("\n\n");

      const extractPrompt = `TASK: Extract shop type load profiles from this energy consumption spreadsheet.

DETECTED FORMAT:
- Layout: ${formatDetection.layout}
- Hour Format: ${formatDetection.hourFormat}
- Unit Type: ${formatDetection.unitType} per ${formatDetection.unitPeriod}
- Has Weekend Data: ${formatDetection.hasWeekendData}
- Column Headers: ${formatDetection.columnPatterns.slice(0, 30).join(", ")}

EXISTING CATEGORIES IN DATABASE: ${existingCategories.length > 0 ? existingCategories.join(", ") : "None yet - suggest appropriate categories"}

SOURCE DATA:
${combinedData}

=== EXTRACTION RULES ===

1. SHOP TYPE IDENTIFICATION:
   - Extract EVERY distinct shop/tenant type found
   - Use specific names (e.g., "Quick Service Restaurant" not just "Restaurant")
   - Include variations (e.g., "Anchor Supermarket", "Express Grocery")
   - Look for: shop name, tenant type, store category, business type columns

2. CATEGORY MAPPING (use existing categories when they match):
   Map to these categories or suggest new ones:
   - Food & Beverage (restaurants, cafes, fast food, bars, bakeries)
   - Retail - Fashion (clothing, shoes, accessories, jewelry)
   - Retail - General (electronics, homeware, gifts, bookstores)
   - Grocery & Supermarket (anchor stores, express marts, butcheries)
   - Entertainment (cinema, arcade, bowling, gaming)
   - Services (bank, salon, spa, laundry, post office, travel agent)
   - Health & Fitness (gym, pharmacy, clinic, optometrist)
   - Food Court (food court tenants, takeaways)
   - Anchor Tenant (large format stores)

3. CONSUMPTION RATE (kwh_per_sqm_month):
   ${formatDetection.unitType !== "unknown" ? `Data appears to be in ${formatDetection.unitType} per ${formatDetection.unitPeriod} - convert to kWh/sqm/month` : ""}
   - Extract or calculate kWh per square meter per month
   - Typical ranges: 
     * Restaurants: 80-200 kWh/sqm/mo
     * Supermarkets: 60-120 kWh/sqm/mo  
     * Fashion Retail: 25-50 kWh/sqm/mo
     * Electronics: 40-70 kWh/sqm/mo
     * Gym: 60-120 kWh/sqm/mo
     * Cinema: 70-100 kWh/sqm/mo

4. 24-HOUR LOAD PROFILE (CRITICAL):
   - Must be exactly 24 values for hours 0-23 (midnight to 11pm)
   - Values = percentage of daily consumption per hour
   - Must sum to approximately 100%
   ${formatDetection.hourFormat === "12h" ? "- Convert 12-hour format (1am, 2am... 12pm, 1pm...) to 24-hour" : ""}
   ${formatDetection.layout === "vertical" ? "- Data appears vertical - extract column values as hourly percentages" : ""}
   
   PROFILE PATTERNS BY TYPE:
   - Office hours shops (banks, services): Peak 9am-5pm, low outside hours
   - Restaurants: Peaks at 12-2pm (lunch) and 6-9pm (dinner)
   - Supermarkets: Fairly flat 7am-9pm with slight morning/evening peaks
   - Fashion retail: Peak 10am-6pm, gradual increase to afternoon
   - Cinema: Low morning, peak 2pm-10pm especially weekends
   - Gym: Peaks 6-8am and 5-8pm (before/after work)
   - Nightclub/Bar: Peak 8pm-2am

5. WEEKEND PROFILE:
   ${formatDetection.hasWeekendData ? "- Weekend data detected - extract separate weekend patterns" : "- No weekend data detected - estimate based on shop type"}
   - Restaurants: Often busier on weekends
   - Retail: Weekend afternoon peaks
   - Offices/Banks: Closed or reduced hours

6. TRADING HOURS:
   - Extract operating hours when visible in data
   - Example: { "open": 7, "close": 21 } for 7am-9pm

7. DATA QUALITY FLAGS:
   - Add confidence score (0-100) based on data completeness
   - Flag profiles with missing or estimated data
   - Note any unit conversions performed

=== EXAMPLE PROFILES ===

Restaurant (lunch & dinner peaks):
load_profile_weekday: [1, 1, 1, 1, 1, 2, 3, 5, 7, 8, 9, 11, 10, 8, 5, 4, 4, 6, 10, 11, 9, 6, 3, 2]

Supermarket (extended hours, flat-ish):
load_profile_weekday: [1, 1, 1, 1, 1, 2, 4, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5, 4, 3, 2]

Fashion Retail (10am-8pm peak):
load_profile_weekday: [1, 1, 1, 1, 1, 1, 2, 3, 5, 7, 8, 8, 8, 8, 8, 7, 7, 7, 6, 5, 3, 2, 1, 1]

Gym (morning and evening peaks):
load_profile_weekday: [2, 1, 1, 1, 1, 4, 10, 12, 8, 4, 3, 3, 4, 4, 4, 5, 8, 12, 10, 6, 4, 3, 2, 2]

BE THOROUGH: Extract ALL distinct shop types. Include source_tab to track where each profile came from.`;

      const aiRes = await fetchWithRetry("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            { role: "system", content: `You are an expert in commercial building energy consumption and load profile analysis for South African retail environments.
Extract shop type load profiles from spreadsheet data, intelligently handling various data formats and units.
Always provide complete 24-hour load profiles (arrays of exactly 24 values representing hours 0-23).
Normalize profiles so hourly values represent percentage of daily consumption (sum to ~100).
Be thorough - extract ALL distinct shop types found in the data.
Flag any data quality issues or estimations made.` },
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
                    description: "Overall confidence in the extraction accuracy (0-100)" 
                  },
                  new_categories: {
                    type: "array",
                    items: { type: "string" },
                    description: "New categories to create if existing ones don't fit"
                  },
                  extraction_notes: {
                    type: "string",
                    description: "Notes about the extraction process, unit conversions, or data quality"
                  },
                  profiles: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Specific shop type name (e.g., Fine Dining Restaurant)" },
                        category: { type: "string", description: "Category name (must match existing or new_categories)" },
                        description: { type: "string", description: "Brief description of the shop type" },
                        kwh_per_sqm_month: { type: "number", description: "Consumption in kWh per square meter per month" },
                        load_profile_weekday: { 
                          type: "array", 
                          items: { type: "number" },
                          minItems: 24,
                          maxItems: 24,
                          description: "Exactly 24 values for hourly consumption (% of daily total, hours 0-23)" 
                        },
                        load_profile_weekend: { 
                          type: "array", 
                          items: { type: "number" },
                          minItems: 24,
                          maxItems: 24,
                          description: "Exactly 24 values for weekend hourly consumption" 
                        },
                        trading_hours: {
                          type: "object",
                          properties: {
                            open: { type: "integer", minimum: 0, maximum: 23 },
                            close: { type: "integer", minimum: 1, maximum: 24 }
                          },
                          description: "Operating hours (24-hour format)"
                        },
                        confidence: {
                          type: "integer",
                          minimum: 0,
                          maximum: 100,
                          description: "Confidence score for this specific profile"
                        },
                        source_tab: {
                          type: "string",
                          description: "Which spreadsheet tab this profile came from"
                        },
                        warnings: {
                          type: "array",
                          items: { type: "string" },
                          description: "Any data quality warnings or notes"
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
        // Fallback: try to extract JSON from text response
        console.log("No tool call, attempting text extraction fallback");
        const textContent = aiData.choices?.[0]?.message?.content || "";
        const jsonMatch = textContent.match(/\{[\s\S]*"profiles"[\s\S]*\}/);
        
        if (jsonMatch) {
          try {
            const extracted = JSON.parse(jsonMatch[0]);
            if (extracted.profiles && Array.isArray(extracted.profiles)) {
              console.log(`Fallback extraction found ${extracted.profiles.length} profiles`);
              const validatedProfiles = extracted.profiles.map((p: ExtractedLoadProfile, _: number, arr: ExtractedLoadProfile[]) => 
                validateProfile(p, arr.slice(0, arr.indexOf(p)))
              );
              
              return new Response(
                JSON.stringify({
                  confidence_score: extracted.confidence_score || 60,
                  new_categories: extracted.new_categories || [],
                  extraction_notes: "Extracted via text fallback - review recommended",
                  profiles: validatedProfiles,
                  profiles_count: validatedProfiles.length,
                  format_detected: formatDetection
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          } catch (e) {
            console.error("Fallback JSON parse failed:", e);
          }
        }
        
        return new Response(
          JSON.stringify({ error: "AI failed to extract load profiles", raw: aiData }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const extracted = JSON.parse(toolCall.function.arguments);
      console.log(`Extracted ${extracted.profiles?.length || 0} profiles with ${extracted.confidence_score}% confidence`);
      
      // Validate and normalize all profiles
      const validatedProfiles: ExtractedLoadProfile[] = [];
      for (const profile of (extracted.profiles || [])) {
        const validated = validateProfile(profile, validatedProfiles);
        validatedProfiles.push(validated);
      }

      // Remove duplicates by name (case-insensitive)
      const uniqueProfiles = validatedProfiles.filter((p, i, arr) => 
        arr.findIndex(x => x.name.toLowerCase() === p.name.toLowerCase()) === i
      );

      return new Response(
        JSON.stringify({
          confidence_score: extracted.confidence_score,
          new_categories: extracted.new_categories || [],
          extraction_notes: extracted.extraction_notes || null,
          profiles: uniqueProfiles,
          profiles_count: uniqueProfiles.length,
          duplicates_removed: validatedProfiles.length - uniqueProfiles.length,
          format_detected: formatDetection
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
