import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/* ── CSV helpers (ported from CSVPreviewDialog.tsx) ── */

function strip(s: string): string {
  return s.trim().replace(/^"|"$/g, "").trim();
}

function extractDateInfo(dateStr: string): { month: number; dateKey: string; year: number } {
  const iso = dateStr.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) {
    const y = iso[1], m = iso[2].padStart(2, "0"), d = iso[3].padStart(2, "0");
    return { month: parseInt(iso[2]), dateKey: `${y}-${m}-${d}`, year: parseInt(y) };
  }
  const ddmm = dateStr.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (ddmm) {
    const d = ddmm[1].padStart(2, "0"), m = ddmm[2].padStart(2, "0"), y = ddmm[3];
    return { month: parseInt(ddmm[2]), dateKey: `${y}-${m}-${d}`, year: parseInt(y) };
  }
  return { month: 0, dateKey: "", year: 0 };
}

function extractTimestamp(dateStr: string, timeStr?: string): string {
  const { dateKey } = extractDateInfo(dateStr);
  if (!dateKey) return "";
  const timeMatch = (timeStr || dateStr).match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  const h = timeMatch ? timeMatch[1].padStart(2, "0") : "00";
  const m = timeMatch ? timeMatch[2] : "00";
  const s = timeMatch?.[3] || "00";
  return `${dateKey}T${h}:${m}:${s}`;
}

function timeDiffMinutes(t1: string, t2: string): number {
  const [h1, m1] = t1.split(":").map(Number);
  const [h2, m2] = t2.split(":").map(Number);
  if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return 0;
  return h2 * 60 + m2 - (h1 * 60 + m1);
}

/* ── Main handler ── */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check — accept service_role key or authenticated user JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller with anon client
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await anonClient.auth.getClaims(token);

    // Allow service_role key, dedicated API key, OR authenticated user
    const uploadApiKey = Deno.env.get("Monthly_Generation_Upload");
    const isServiceRole = token === serviceRoleKey;
    const isApiKey = uploadApiKey && token === uploadApiKey;
    if (!isServiceRole && !isApiKey && (claimsErr || !claimsData?.claims?.sub)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role client for all DB writes (bypasses RLS)
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const {
      project_id,
      year,
      type,
      source_label,
      csv_content,
      date_col,
      value_col,
      time_col = -1,
      is_kw = true,
      mode = "accumulate",
    } = body;

    // Validate required fields
    if (!project_id || !csv_content || date_col === undefined || value_col === undefined) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: project_id, csv_content, date_col, value_col" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!["solar", "council"].includes(type)) {
      return new Response(
        JSON.stringify({ error: "type must be 'solar' or 'council'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify project exists
    const { data: project, error: projErr } = await supabase
      .from("projects")
      .select("id")
      .eq("id", project_id)
      .maybeSingle();
    if (projErr || !project) {
      return new Response(
        JSON.stringify({ error: "Project not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse CSV
    const lines = csv_content.split("\n").filter((l: string) => l.trim());
    if (lines.length < 2) {
      return new Response(
        JSON.stringify({ error: "CSV must have at least a header row and one data row" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Detect SCADA header row
    const firstLine = lines[0].toLowerCase();
    const isScada = firstLine.includes("pnpscada") || firstLine.includes("scada");
    const dataStartRow = isScada ? 2 : 1;
    const dataLines = lines.slice(dataStartRow).filter((l: string) => l.trim());

    if (dataLines.length === 0) {
      return new Response(
        JSON.stringify({ error: "No data rows found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Detect interval for kW→kWh conversion
    let intervalHours = 0.5;
    if (is_kw && time_col >= 0 && dataLines.length >= 2) {
      const t1 = strip(dataLines[0].split(",")[time_col] ?? "");
      const t2 = strip(dataLines[1].split(",")[time_col] ?? "");
      if (t1 && t2) {
        const mins = timeDiffMinutes(t1, t2);
        if (mins > 0) intervalHours = mins / 60;
      }
    }

    // Aggregate
    const monthlyTotals = new Map<number, number>();
    const dailyTotals = new Map<string, { kwh: number; month: number; year: number }>();

    interface Reading {
      project_id: string;
      timestamp: string;
      actual_kwh?: number;
      building_load_kwh?: number;
      source: string;
    }
    const readings: Reading[] = [];

    const effectiveYear = year || 0;

    for (const line of dataLines) {
      const cols = line.split(",").map(strip);
      const dateStr = cols[date_col] ?? "";
      const rawVal = parseFloat(cols[value_col] ?? "");
      if (!dateStr || isNaN(rawVal)) continue;

      const info = extractDateInfo(dateStr);
      if (info.month < 1 || info.month > 12 || !info.dateKey) continue;

      const kwh = is_kw ? rawVal * intervalHours : rawVal;
      const rowYear = effectiveYear || info.year;

      monthlyTotals.set(info.month, (monthlyTotals.get(info.month) ?? 0) + kwh);

      const existing = dailyTotals.get(info.dateKey);
      if (existing) {
        existing.kwh += kwh;
      } else {
        dailyTotals.set(info.dateKey, { kwh, month: info.month, year: rowYear });
      }

      const timeStr = time_col >= 0 ? (cols[time_col] ?? "") : "";
      const ts = extractTimestamp(dateStr, timeStr);
      if (ts) {
        const reading: Reading = {
          project_id,
          timestamp: ts,
          source: source_label || "csv-api",
        };
        if (type === "solar") {
          reading.actual_kwh = kwh;
        } else {
          reading.building_load_kwh = kwh;
        }
        readings.push(reading);
      }
    }

    const monthsAffected = [...monthlyTotals.keys()].sort((a, b) => a - b);
    let totalKwh = 0;
    for (const v of monthlyTotals.values()) totalKwh += v;

    // ── Upsert generation_records (monthly) ──
    for (const [month, kwh] of monthlyTotals) {
      const recordYear = effectiveYear || new Date().getFullYear();
      if (mode === "replace") {
        // Delete existing for this month/year then insert
        await supabase
          .from("generation_records")
          .delete()
          .eq("project_id", project_id)
          .eq("year", recordYear)
          .eq("month", month);
      }

      if (mode === "replace") {
        const record: Record<string, unknown> = {
          project_id,
          year: recordYear,
          month,
          source: source_label || "csv-api",
        };
        if (type === "solar") record.actual_kwh = kwh;
        else record.building_load_kwh = kwh;
        await supabase.from("generation_records").insert(record);
      } else {
        // Accumulate: fetch existing and add
        const { data: existing } = await supabase
          .from("generation_records")
          .select("*")
          .eq("project_id", project_id)
          .eq("year", recordYear)
          .eq("month", month)
          .maybeSingle();

        if (existing) {
          const update: Record<string, unknown> = {};
          if (type === "solar") {
            update.actual_kwh = (existing.actual_kwh ?? 0) + kwh;
          } else {
            update.building_load_kwh = (existing.building_load_kwh ?? 0) + kwh;
          }
          update.source = source_label || "csv-api";
          await supabase.from("generation_records").update(update).eq("id", existing.id);
        } else {
          const record: Record<string, unknown> = {
            project_id,
            year: recordYear,
            month,
            source: source_label || "csv-api",
          };
          if (type === "solar") record.actual_kwh = kwh;
          else record.building_load_kwh = kwh;
          await supabase.from("generation_records").insert(record);
        }
      }
    }

    // ── Upsert generation_daily_records ──
    for (const [dateKey, info] of dailyTotals) {
      const recordYear = info.year || effectiveYear || new Date().getFullYear();
      const dailyRecord: Record<string, unknown> = {
        project_id,
        date: dateKey,
        year: recordYear,
        month: info.month,
        source: source_label || "csv-api",
      };
      if (type === "solar") dailyRecord.actual_kwh = info.kwh;
      else dailyRecord.building_load_kwh = info.kwh;

      if (mode === "replace") {
        await supabase
          .from("generation_daily_records")
          .delete()
          .eq("project_id", project_id)
          .eq("date", dateKey);
      }

      // Check if exists for accumulate
      if (mode === "accumulate") {
        const { data: existing } = await supabase
          .from("generation_daily_records")
          .select("*")
          .eq("project_id", project_id)
          .eq("date", dateKey)
          .maybeSingle();

        if (existing) {
          const update: Record<string, unknown> = {};
          if (type === "solar") {
            update.actual_kwh = (existing.actual_kwh ?? 0) + info.kwh;
          } else {
            update.building_load_kwh = (existing.building_load_kwh ?? 0) + info.kwh;
          }
          await supabase.from("generation_daily_records").update(update).eq("id", existing.id);
          continue;
        }
      }

      await supabase.from("generation_daily_records").insert(dailyRecord);
    }

    // ── Batch insert generation_readings ──
    const BATCH_SIZE = 500;
    for (let i = 0; i < readings.length; i += BATCH_SIZE) {
      const batch = readings.slice(i, i + BATCH_SIZE);
      await supabase.from("generation_readings").insert(batch);
    }

    // ── Upsert generation_source_guarantees ──
    for (const month of monthsAffected) {
      const recordYear = effectiveYear || new Date().getFullYear();
      const { data: existing } = await supabase
        .from("generation_source_guarantees")
        .select("id")
        .eq("project_id", project_id)
        .eq("year", recordYear)
        .eq("month", month)
        .eq("source_label", source_label || "csv-api")
        .maybeSingle();

      if (!existing) {
        await supabase.from("generation_source_guarantees").insert({
          project_id,
          year: recordYear,
          month,
          source_label: source_label || "csv-api",
          meter_type: type === "solar" ? "solar" : "council",
          guaranteed_kwh: 0,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        months_affected: monthsAffected,
        total_kwh_added: Math.round(totalKwh * 100) / 100,
        readings_count: readings.length,
        daily_records: dailyTotals.size,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("upload-generation-csv error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
