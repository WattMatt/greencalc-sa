import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import { create } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const { sheetId, province = "South Africa" } = await req.json();
    
    if (!sheetId) {
      return new Response(
        JSON.stringify({ error: "Sheet ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // Get sheet metadata to find all tabs
    console.log("Fetching sheet metadata for:", sheetId);
    const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`;
    const metadataRes = await fetch(metadataUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (!metadataRes.ok) {
      const errorText = await metadataRes.text();
      console.error("Sheet metadata error:", metadataRes.status, errorText);
      return new Response(
        JSON.stringify({ error: "Cannot access sheet. Make sure the sheet is shared with the service account email." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const metadata = await metadataRes.json();
    const allTabs = metadata.sheets?.map((s: any) => s.properties.title) || [];
    console.log("Found tabs (municipalities):", allTabs);

    if (allTabs.length === 0) {
      return new Response(
        JSON.stringify({ error: "No tabs found in the spreadsheet" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get existing data
    const { data: existingProvinces } = await supabase.from("provinces").select("id, name");
    const { data: existingMunicipalities } = await supabase.from("municipalities").select("id, name, province_id");
    const { data: existingCategories } = await supabase.from("tariff_categories").select("id, name");

    const provinceMap = new Map(existingProvinces?.map(p => [p.name.toLowerCase(), p.id]) || []);
    const municipalityMap = new Map(existingMunicipalities?.map(m => [m.name.toLowerCase(), { id: m.id, province_id: m.province_id }]) || []);
    const categoryMap = new Map(existingCategories?.map(c => [c.name.toLowerCase(), c.id]) || []);

    // Get or create province
    let provinceId = provinceMap.get(province.toLowerCase());
    if (!provinceId) {
      const { data: newProvince } = await supabase
        .from("provinces")
        .insert({ name: province })
        .select("id")
        .single();
      if (newProvince) {
        provinceId = newProvince.id;
        provinceMap.set(province.toLowerCase(), provinceId);
      }
    }

    if (!provinceId) {
      return new Response(
        JSON.stringify({ error: "Failed to create province" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalImported = 0;
    let totalSkipped = 0;
    const errors: string[] = [];
    const processedTabs: string[] = [];

    // Process each tab as a municipality
    for (const tabName of allTabs) {
      console.log(`Processing tab: ${tabName}`);
      
      // Fetch data from this tab
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(tabName)}`;
      const sheetResponse = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      if (!sheetResponse.ok) {
        errors.push(`Tab "${tabName}": Failed to fetch data`);
        continue;
      }

      const sheetData = await sheetResponse.json();
      const rows = sheetData.values || [];
      
      if (rows.length < 2) {
        errors.push(`Tab "${tabName}": No data rows found`);
        continue;
      }

      // Parse headers
      const headers = rows[0].map((h: string) => h.toLowerCase().replace(/\s+/g, "_"));
      console.log(`Tab "${tabName}" headers:`, headers);

      // Get or create municipality from tab name
      const municipalityName = tabName.trim();
      let municipalityInfo = municipalityMap.get(municipalityName.toLowerCase());
      
      if (!municipalityInfo) {
        const { data: newMuni, error: muniError } = await supabase
          .from("municipalities")
          .insert({ name: municipalityName, province_id: provinceId })
          .select("id, province_id")
          .single();
        
        if (newMuni) {
          municipalityInfo = { id: newMuni.id, province_id: newMuni.province_id };
          municipalityMap.set(municipalityName.toLowerCase(), municipalityInfo);
          console.log(`Created municipality: ${municipalityName}`);
        } else if (muniError) {
          errors.push(`Tab "${tabName}": Failed to create municipality - ${muniError.message}`);
          continue;
        }
      }

      if (!municipalityInfo) {
        errors.push(`Tab "${tabName}": Could not get or create municipality`);
        continue;
      }

      // Process each data row in this tab
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const rowData: Record<string, any> = {};
        
        headers.forEach((header: string, idx: number) => {
          rowData[header] = row[idx] || "";
        });

        try {
          // Get or create category
          const categoryName = rowData.category?.trim() || "General";
          let categoryId = categoryMap.get(categoryName.toLowerCase());
          
          if (!categoryId) {
            const { data: newCat } = await supabase
              .from("tariff_categories")
              .insert({ name: categoryName })
              .select("id")
              .single();
            
            if (newCat) {
              categoryId = newCat.id;
              categoryMap.set(categoryName.toLowerCase(), categoryId);
            }
          }

          if (!categoryId) {
            errors.push(`Tab "${tabName}" Row ${i + 1}: Missing category`);
            totalSkipped++;
            continue;
          }

          // Parse tariff type
          const tariffType = rowData.tariff_type?.trim().toUpperCase() || "FIXED";
          const validTypes = ["Fixed", "IBT", "TOU"];
          const normalizedType = validTypes.find(t => t.toUpperCase() === tariffType) || "Fixed";

          // Create tariff
          const tariffName = rowData.tariff_name?.trim() || rowData.name?.trim() || `${municipalityName} - ${categoryName}`;
          
          const { data: newTariff, error: tariffError } = await supabase
            .from("tariffs")
            .insert({
              name: tariffName,
              municipality_id: municipalityInfo.id,
              category_id: categoryId,
              tariff_type: normalizedType,
              phase_type: rowData.phase_type?.trim() || "Single Phase",
              fixed_monthly_charge: parseFloat(rowData.fixed_monthly_charge || rowData.basic_charge || rowData.service_charge) || 0,
              demand_charge_per_kva: parseFloat(rowData.demand_charge_per_kva || rowData.demand_charge) || 0,
              is_prepaid: rowData.is_prepaid?.toLowerCase() === "true" || rowData.is_prepaid === "1" || rowData.prepaid?.toLowerCase() === "yes",
              amperage_limit: rowData.amperage_limit?.trim() || rowData.amp_limit?.trim() || null,
            })
            .select("id")
            .single();

          if (tariffError) {
            errors.push(`Tab "${tabName}" Row ${i + 1}: ${tariffError.message}`);
            totalSkipped++;
            continue;
          }

          // Create rate if provided
          const rateValue = parseFloat(rowData.rate_per_kwh || rowData.rate || rowData.energy_charge || rowData.c_kwh);
          if (rateValue && newTariff) {
            await supabase.from("tariff_rates").insert({
              tariff_id: newTariff.id,
              rate_per_kwh: rateValue,
              block_start_kwh: parseInt(rowData.block_start_kwh || rowData.block_start) || 0,
              block_end_kwh: rowData.block_end_kwh || rowData.block_end ? parseInt(rowData.block_end_kwh || rowData.block_end) : null,
              season: rowData.season?.trim() || "All Year",
              time_of_use: rowData.time_of_use?.trim() || "Any",
            });
          }

          totalImported++;
        } catch (err) {
          console.error(`Error processing Tab "${tabName}" Row ${i + 1}:`, err);
          errors.push(`Tab "${tabName}" Row ${i + 1}: ${err instanceof Error ? err.message : "Unknown error"}`);
          totalSkipped++;
        }
      }

      processedTabs.push(tabName);
    }

    console.log(`Import complete: ${totalImported} imported, ${totalSkipped} skipped from ${processedTabs.length} tabs`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        imported: totalImported, 
        skipped: totalSkipped,
        tabsProcessed: processedTabs.length,
        tabs: processedTabs,
        errors: errors.slice(0, 20),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Import error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Import failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
