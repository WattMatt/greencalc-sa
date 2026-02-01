import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting external sites sync...");

    // External API endpoint (same as sync-external-projects)
    const externalApiUrl = "https://rsdisaisxdglmdmzmkyw.supabase.co/functions/v1/fetch-tenant-schedule";

    // Fetch data from external API
    console.log("Fetching from external API:", externalApiUrl);
    const externalResponse = await fetch(externalApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!externalResponse.ok) {
      const errorText = await externalResponse.text();
      console.error("External API error response:", errorText);
      throw new Error(`External API error: ${externalResponse.status} ${externalResponse.statusText}`);
    }

    const externalData = await externalResponse.json();
    console.log(`Fetched ${externalData.total_projects} projects from external API`);

    // Local Supabase connection
    const localUrl = Deno.env.get("SUPABASE_URL")!;
    const localKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const localSupabase = createClient(localUrl, localKey);

    // Fetch all local sites
    const { data: localSites, error: sitesError } = await localSupabase
      .from("sites")
      .select("id, name, latitude, longitude");

    if (sitesError) {
      throw new Error(`Failed to fetch local sites: ${sitesError.message}`);
    }

    console.log(`Found ${localSites?.length || 0} local sites`);

    // Build mapping of external projects by normalized name
    const externalProjectsByName = new Map<string, { latitude: number | null; longitude: number | null; name: string }>();
    
    for (const project of externalData.projects || []) {
      const normalizedName = project.name?.toLowerCase().replace(/[^a-z0-9]/g, "") || "";
      const lat = project.latitude || project.lat || null;
      const lng = project.longitude || project.lng || null;
      
      if (normalizedName && (lat !== null || lng !== null)) {
        externalProjectsByName.set(normalizedName, {
          latitude: lat,
          longitude: lng,
          name: project.name,
        });
      }
    }

    console.log(`External projects with coordinates: ${externalProjectsByName.size}`);

    let matched = 0;
    let updated = 0;
    let notFound = 0;
    const details: Array<{ siteId: string; siteName: string; status: string; coordinates?: { lat: number; lng: number } }> = [];

    // Match sites to external projects
    for (const site of localSites || []) {
      const normalizedSiteName = site.name?.toLowerCase().replace(/[^a-z0-9]/g, "") || "";
      
      const externalMatch = externalProjectsByName.get(normalizedSiteName);
      
      if (externalMatch && externalMatch.latitude && externalMatch.longitude) {
        matched++;
        
        // Check if site already has coordinates
        if (site.latitude && site.longitude) {
          details.push({
            siteId: site.id,
            siteName: site.name,
            status: "already_has_coordinates",
          });
          continue;
        }
        
        // Update site with coordinates
        const { error: updateError } = await localSupabase
          .from("sites")
          .update({
            latitude: externalMatch.latitude,
            longitude: externalMatch.longitude,
            updated_at: new Date().toISOString(),
          })
          .eq("id", site.id);

        if (updateError) {
          console.error(`Failed to update site ${site.name}:`, updateError.message);
          details.push({
            siteId: site.id,
            siteName: site.name,
            status: `failed - ${updateError.message}`,
          });
        } else {
          updated++;
          console.log(`✓ Updated site "${site.name}" with coordinates from "${externalMatch.name}"`);
          details.push({
            siteId: site.id,
            siteName: site.name,
            status: "updated",
            coordinates: { lat: externalMatch.latitude, lng: externalMatch.longitude },
          });
        }
      } else {
        notFound++;
        details.push({
          siteId: site.id,
          siteName: site.name,
          status: "not_found_in_external",
        });
      }
    }

    const result = {
      success: true,
      total_sites: localSites?.length || 0,
      matched,
      updated,
      not_found: notFound,
      external_projects_with_coords: externalProjectsByName.size,
      details,
    };

    console.log("Site sync completed:", { matched, updated, notFound });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Site sync error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
