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

    // External API endpoint
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
    console.log(`Fetched ${externalData.total_projects} projects with ${externalData.total_tenants} tenants from external API`);
    
    // Log the first project's fields to see available logo fields
    if (externalData.projects && externalData.projects.length > 0) {
      const sampleProject = externalData.projects[0];
      console.log("Sample project fields:", JSON.stringify(Object.keys(sampleProject)));
      console.log("Sample project logo fields:", JSON.stringify({
        logo_url: sampleProject.logo_url,
        client_logo_url: sampleProject.client_logo_url,
        logo: sampleProject.logo,
        image_url: sampleProject.image_url,
        image: sampleProject.image,
      }));
    }

    // Local Supabase connection
    const localUrl = Deno.env.get("SUPABASE_URL")!;
    const localKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const localSupabase = createClient(localUrl, localKey);

    let projectsInserted = 0;
    let projectsUpdated = 0;
    let tenantsInserted = 0;
    let tenantsUpdated = 0;

    // Sync projects
    for (const project of externalData.projects || []) {
      // Map external project to local schema
      const projectData = {
        id: project.id,
        name: project.name,
        description: project.client_name || null,
        location: project.city && project.province 
          ? `${project.city}, ${project.province}` 
          : project.city || project.province || null,
        logo_url: project.logo_url || project.client_logo_url || null,
        updated_at: new Date().toISOString(),
      };

      // Check if project exists locally
      const { data: existingProject } = await localSupabase
        .from("projects")
        .select("id, updated_at")
        .eq("id", project.id)
        .maybeSingle();

      if (!existingProject) {
        // Insert new project
        const { error: insertError } = await localSupabase
          .from("projects")
          .insert({
            ...projectData,
            created_at: new Date().toISOString(),
          });

        if (insertError) {
          console.error(`Failed to insert project ${project.id}:`, insertError.message);
        } else {
          projectsInserted++;
          console.log(`Inserted project: ${project.name}`);
        }
      } else {
        // Update existing project
        const { error: updateError } = await localSupabase
          .from("projects")
          .update(projectData)
          .eq("id", project.id);

        if (updateError) {
          console.error(`Failed to update project ${project.id}:`, updateError.message);
        } else {
          projectsUpdated++;
        }
      }

      // Sync tenants for this project
      for (const tenant of project.tenants || []) {
        // Map external tenant to local schema
        const tenantData = {
          id: tenant.id,
          project_id: tenant.project_id,
          name: tenant.shop_name || tenant.shop_number || "Unknown",
          area_sqm: tenant.area || 0,
          updated_at: tenant.updated_at || new Date().toISOString(),
        };

        // Check if tenant exists locally
        const { data: existingTenant } = await localSupabase
          .from("project_tenants")
          .select("id, updated_at")
          .eq("id", tenant.id)
          .maybeSingle();

        if (!existingTenant) {
          // Insert new tenant
          const { error: insertError } = await localSupabase
            .from("project_tenants")
            .insert({
              ...tenantData,
              created_at: tenant.created_at || new Date().toISOString(),
            });

          if (insertError) {
            console.error(`Failed to insert tenant ${tenant.id}:`, insertError.message);
          } else {
            tenantsInserted++;
          }
        } else {
          // Update if external is newer
          const externalUpdated = new Date(tenant.updated_at || 0);
          const localUpdated = new Date(existingTenant.updated_at || 0);

          if (externalUpdated > localUpdated) {
            const { error: updateError } = await localSupabase
              .from("project_tenants")
              .update(tenantData)
              .eq("id", tenant.id);

            if (updateError) {
              console.error(`Failed to update tenant ${tenant.id}:`, updateError.message);
            } else {
              tenantsUpdated++;
            }
          }
        }
      }
    }

    const result = {
      success: true,
      projects: {
        found: externalData.total_projects,
        inserted: projectsInserted,
        updated: projectsUpdated,
      },
      tenants: {
        found: externalData.total_tenants,
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
