import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Tables in dependency order
const TABLES_IN_ORDER = [
  "provinces",
  "shop_type_categories",
  "shop_types",
  "checklist_template_groups",
  "checklist_templates",
  "sites",
  "municipalities",
  "tariff_plans",
  "tariff_rates",
  "projects",
  "project_tenants",
  "scada_imports",
  "project_tenant_meters",
  "generation_records",
  "generation_readings",
  "generation_daily_records",
  "generation_source_guarantees",
  "project_simulations",
  "pv_layout_folders",
  "pv_layouts",
  "project_solar_data",
  "gantt_tasks",
  "gantt_milestones",
  "gantt_baselines",
  "gantt_baseline_tasks",
  "gantt_task_dependencies",
  "gantt_task_segments",
  "sandbox_simulations",
  "proposals",
  "stacked_profiles",
  "project_document_folders",
  "project_documents",
  "project_schematics",
  "project_schematic_meter_positions",
  "project_schematic_lines",
  "project_meter_connections",
  "organization_branding",
  "profiles",
  "report_configs",
  "report_versions",
  "report_analytics",
  "handover_checklist_items",
  "checklist_document_links",
  "downtime_slot_overrides",
  "downtime_comments",
  "eskom_batch_status",
  "extraction_runs",
  "simulation_presets",
  "user_roles",
];

async function fetchAllRows(supabase: any, table: string): Promise<any[]> {
  const allRows: any[] = [];
  let from = 0;
  const batchSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(from, from + batchSize - 1);

    if (error) {
      console.error(`Error reading ${table}:`, error.message);
      break;
    }

    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < batchSize) break;
    from += batchSize;
  }

  return allRows;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const localUrl = Deno.env.get("SUPABASE_URL")!;
    const localKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const targetUrl = Deno.env.get("TARGET_SUPABASE_URL")!;
    const targetKey = Deno.env.get("TARGET_SUPABASE_SERVICE_ROLE_KEY")!;

    if (!targetUrl || !targetKey) {
      throw new Error("TARGET_SUPABASE_URL and TARGET_SUPABASE_SERVICE_ROLE_KEY must be set");
    }

    const localSupabase = createClient(localUrl, localKey);
    const targetSupabase = createClient(targetUrl, targetKey);

    const results: Record<string, { read: number; upserted: number; errors: string[] }> = {};

    for (const table of TABLES_IN_ORDER) {
      const tableResult = { read: 0, upserted: 0, errors: [] as string[] };
      
      try {
        const rows = await fetchAllRows(localSupabase, table);
        tableResult.read = rows.length;

        if (rows.length === 0) {
          console.log(`[${table}] No rows to sync`);
          results[table] = tableResult;
          continue;
        }

        // Upsert in batches of 500
        const upsertBatch = 500;
        for (let i = 0; i < rows.length; i += upsertBatch) {
          const batch = rows.slice(i, i + upsertBatch);
          const { error } = await targetSupabase
            .from(table)
            .upsert(batch, { onConflict: "id", ignoreDuplicates: false });

          if (error) {
            const msg = `Batch ${Math.floor(i / upsertBatch)}: ${error.message}`;
            console.error(`[${table}] ${msg}`);
            tableResult.errors.push(msg);
          } else {
            tableResult.upserted += batch.length;
          }
        }

        console.log(`[${table}] Read: ${tableResult.read}, Upserted: ${tableResult.upserted}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error(`[${table}] Fatal: ${msg}`);
        tableResult.errors.push(msg);
      }

      results[table] = tableResult;
    }

    const summary = {
      success: true,
      tables_synced: Object.keys(results).length,
      total_rows_read: Object.values(results).reduce((s, r) => s + r.read, 0),
      total_rows_upserted: Object.values(results).reduce((s, r) => s + r.upserted, 0),
      tables_with_errors: Object.entries(results)
        .filter(([, r]) => r.errors.length > 0)
        .map(([t, r]) => ({ table: t, errors: r.errors })),
      details: results,
    };

    console.log("Replication complete:", JSON.stringify({ 
      rows_read: summary.total_rows_read, 
      rows_upserted: summary.total_rows_upserted,
      errors: summary.tables_with_errors.length 
    }));

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Replication error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
