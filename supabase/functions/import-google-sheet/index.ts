import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SheetRow {
  municipality: string;
  province: string;
  category: string;
  tariff_name: string;
  tariff_type: string;
  phase_type?: string;
  fixed_monthly_charge?: number;
  demand_charge_per_kva?: number;
  is_prepaid?: boolean;
  amperage_limit?: string;
  rate_per_kwh?: number;
  block_start_kwh?: number;
  block_end_kwh?: number;
  season?: string;
  time_of_use?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sheetId, sheetName = "Sheet1" } = await req.json();
    
    if (!sheetId) {
      return new Response(
        JSON.stringify({ error: "Sheet ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("GOOGLE_SHEETS_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Google Sheets API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch data from Google Sheets
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(sheetName)}?key=${apiKey}`;
    console.log("Fetching from Google Sheets:", sheetId, sheetName);
    
    const sheetResponse = await fetch(url);
    if (!sheetResponse.ok) {
      const errorText = await sheetResponse.text();
      console.error("Google Sheets API error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to fetch sheet data. Make sure the sheet is public or shared." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sheetData = await sheetResponse.json();
    const rows = sheetData.values || [];
    
    if (rows.length < 2) {
      return new Response(
        JSON.stringify({ error: "Sheet must have a header row and at least one data row" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse headers (first row)
    const headers = rows[0].map((h: string) => h.toLowerCase().replace(/\s+/g, "_"));
    console.log("Headers found:", headers);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get existing provinces, municipalities, and categories
    const { data: existingProvinces } = await supabase.from("provinces").select("id, name");
    const { data: existingMunicipalities } = await supabase.from("municipalities").select("id, name, province_id");
    const { data: existingCategories } = await supabase.from("tariff_categories").select("id, name");

    const provinceMap = new Map(existingProvinces?.map(p => [p.name.toLowerCase(), p.id]) || []);
    const municipalityMap = new Map(existingMunicipalities?.map(m => [m.name.toLowerCase(), { id: m.id, province_id: m.province_id }]) || []);
    const categoryMap = new Map(existingCategories?.map(c => [c.name.toLowerCase(), c.id]) || []);

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Process each data row
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rowData: Record<string, any> = {};
      
      headers.forEach((header: string, idx: number) => {
        rowData[header] = row[idx] || "";
      });

      try {
        // Get or create province
        const provinceName = rowData.province?.trim();
        let provinceId = provinceMap.get(provinceName?.toLowerCase());
        
        if (!provinceId && provinceName) {
          const { data: newProvince, error: provError } = await supabase
            .from("provinces")
            .insert({ name: provinceName })
            .select("id")
            .single();
          
          if (newProvince) {
            provinceId = newProvince.id;
            provinceMap.set(provinceName.toLowerCase(), provinceId);
          } else if (provError) {
            console.error("Error creating province:", provError);
          }
        }

        // Get or create municipality
        const municipalityName = rowData.municipality?.trim();
        let municipalityInfo = municipalityMap.get(municipalityName?.toLowerCase());
        
        if (!municipalityInfo && municipalityName && provinceId) {
          const { data: newMuni, error: muniError } = await supabase
            .from("municipalities")
            .insert({ name: municipalityName, province_id: provinceId })
            .select("id, province_id")
            .single();
          
          if (newMuni) {
            municipalityInfo = { id: newMuni.id, province_id: newMuni.province_id };
            municipalityMap.set(municipalityName.toLowerCase(), municipalityInfo);
          } else if (muniError) {
            console.error("Error creating municipality:", muniError);
          }
        }

        // Get or create category
        const categoryName = rowData.category?.trim();
        let categoryId = categoryMap.get(categoryName?.toLowerCase());
        
        if (!categoryId && categoryName) {
          const { data: newCat, error: catError } = await supabase
            .from("tariff_categories")
            .insert({ name: categoryName })
            .select("id")
            .single();
          
          if (newCat) {
            categoryId = newCat.id;
            categoryMap.set(categoryName.toLowerCase(), categoryId);
          } else if (catError) {
            console.error("Error creating category:", catError);
          }
        }

        if (!municipalityInfo || !categoryId) {
          errors.push(`Row ${i + 1}: Missing municipality or category`);
          skipped++;
          continue;
        }

        // Parse tariff type
        const tariffType = rowData.tariff_type?.trim().toUpperCase() || "Fixed";
        const validTypes = ["Fixed", "IBT", "TOU"];
        const normalizedType = validTypes.find(t => t.toUpperCase() === tariffType) || "Fixed";

        // Create tariff
        const tariffName = rowData.tariff_name?.trim() || `${municipalityName} - ${categoryName}`;
        
        const { data: newTariff, error: tariffError } = await supabase
          .from("tariffs")
          .insert({
            name: tariffName,
            municipality_id: municipalityInfo.id,
            category_id: categoryId,
            tariff_type: normalizedType,
            phase_type: rowData.phase_type?.trim() || "Single Phase",
            fixed_monthly_charge: parseFloat(rowData.fixed_monthly_charge) || 0,
            demand_charge_per_kva: parseFloat(rowData.demand_charge_per_kva) || 0,
            is_prepaid: rowData.is_prepaid?.toLowerCase() === "true" || rowData.is_prepaid === "1",
            amperage_limit: rowData.amperage_limit?.trim() || null,
          })
          .select("id")
          .single();

        if (tariffError) {
          errors.push(`Row ${i + 1}: ${tariffError.message}`);
          skipped++;
          continue;
        }

        // Create rate if provided
        if (rowData.rate_per_kwh && newTariff) {
          await supabase.from("tariff_rates").insert({
            tariff_id: newTariff.id,
            rate_per_kwh: parseFloat(rowData.rate_per_kwh) || 0,
            block_start_kwh: parseInt(rowData.block_start_kwh) || 0,
            block_end_kwh: rowData.block_end_kwh ? parseInt(rowData.block_end_kwh) : null,
            season: rowData.season?.trim() || "All Year",
            time_of_use: rowData.time_of_use?.trim() || "Any",
          });
        }

        imported++;
      } catch (err) {
        console.error(`Error processing row ${i + 1}:`, err);
        errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : "Unknown error"}`);
        skipped++;
      }
    }

    console.log(`Import complete: ${imported} imported, ${skipped} skipped`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        imported, 
        skipped,
        errors: errors.slice(0, 10), // Only return first 10 errors
        totalRows: rows.length - 1
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
