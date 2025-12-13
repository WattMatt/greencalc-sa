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
    console.log("Starting external projects sync...");

    // External Supabase connection
    const externalUrl = Deno.env.get("EXTERNAL_SUPABASE_URL");
    const externalKey = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY");

    if (!externalUrl || !externalKey) {
      throw new Error("External Supabase credentials not configured");
    }

    const externalSupabase = createClient(externalUrl, externalKey);

    // Local Supabase connection
    const localUrl = Deno.env.get("SUPABASE_URL")!;
    const localKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const localSupabase = createClient(localUrl, localKey);

    // Fetch projects from external DB
    console.log("Fetching projects from external database...");
    const { data: externalProjects, error: projectsError } = await externalSupabase
      .from("projects")
      .select("*");

    if (projectsError) {
      console.error("Error fetching external projects:", projectsError);
      throw new Error(`Failed to fetch external projects: ${projectsError.message}`);
    }

    console.log(`Found ${externalProjects?.length || 0} projects in external DB`);

    // Fetch project_tenants from external DB
    console.log("Fetching tenants from external database...");
    const { data: externalTenants, error: tenantsError } = await externalSupabase
      .from("project_tenants")
      .select("*");

    if (tenantsError) {
      console.error("Error fetching external tenants:", tenantsError);
      throw new Error(`Failed to fetch external tenants: ${tenantsError.message}`);
    }

    console.log(`Found ${externalTenants?.length || 0} tenants in external DB`);

    let projectsInserted = 0;
    let projectsUpdated = 0;
    let tenantsInserted = 0;
    let tenantsUpdated = 0;

    // Sync projects
    for (const project of externalProjects || []) {
      // Check if project exists locally
      const { data: existingProject } = await localSupabase
        .from("projects")
        .select("id, updated_at")
        .eq("id", project.id)
        .maybeSingle();

      if (existingProject) {
        // Update if external is newer
        if (new Date(project.updated_at) > new Date(existingProject.updated_at)) {
          const { error: updateError } = await localSupabase
            .from("projects")
            .update({
              name: project.name,
              description: project.description,
              location: project.location,
              total_area_sqm: project.total_area_sqm,
              tariff_id: project.tariff_id,
              updated_at: project.updated_at,
            })
            .eq("id", project.id);

          if (updateError) {
            console.error(`Error updating project ${project.id}:`, updateError);
          } else {
            projectsUpdated++;
          }
        }
      } else {
        // Insert new project
        const { error: insertError } = await localSupabase
          .from("projects")
          .insert({
            id: project.id,
            name: project.name,
            description: project.description,
            location: project.location,
            total_area_sqm: project.total_area_sqm,
            tariff_id: project.tariff_id,
            created_at: project.created_at,
            updated_at: project.updated_at,
          });

        if (insertError) {
          console.error(`Error inserting project ${project.id}:`, insertError);
        } else {
          projectsInserted++;
        }
      }
    }

    // Sync tenants
    for (const tenant of externalTenants || []) {
      // Check if tenant exists locally
      const { data: existingTenant } = await localSupabase
        .from("project_tenants")
        .select("id, updated_at")
        .eq("id", tenant.id)
        .maybeSingle();

      if (existingTenant) {
        // Update if external is newer
        if (new Date(tenant.updated_at) > new Date(existingTenant.updated_at)) {
          const { error: updateError } = await localSupabase
            .from("project_tenants")
            .update({
              name: tenant.name,
              project_id: tenant.project_id,
              shop_type_id: tenant.shop_type_id,
              area_sqm: tenant.area_sqm,
              monthly_kwh_override: tenant.monthly_kwh_override,
              updated_at: tenant.updated_at,
            })
            .eq("id", tenant.id);

          if (updateError) {
            console.error(`Error updating tenant ${tenant.id}:`, updateError);
          } else {
            tenantsUpdated++;
          }
        }
      } else {
        // Insert new tenant
        const { error: insertError } = await localSupabase
          .from("project_tenants")
          .insert({
            id: tenant.id,
            name: tenant.name,
            project_id: tenant.project_id,
            shop_type_id: tenant.shop_type_id,
            area_sqm: tenant.area_sqm,
            monthly_kwh_override: tenant.monthly_kwh_override,
            created_at: tenant.created_at,
            updated_at: tenant.updated_at,
          });

        if (insertError) {
          console.error(`Error inserting tenant ${tenant.id}:`, insertError);
        } else {
          tenantsInserted++;
        }
      }
    }

    const result = {
      success: true,
      projects: {
        found: externalProjects?.length || 0,
        inserted: projectsInserted,
        updated: projectsUpdated,
      },
      tenants: {
        found: externalTenants?.length || 0,
        inserted: tenantsInserted,
        updated: tenantsUpdated,
      },
    };

    console.log("Sync completed:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Sync error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
