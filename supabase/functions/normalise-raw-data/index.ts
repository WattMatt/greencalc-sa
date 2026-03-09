import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MONTH_MAP: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

interface NormalisedPoint {
  date: string;
  time: string;
  value: number;
}

function normaliseRawData(rawData: unknown): NormalisedPoint[] | null {
  if (!rawData || !Array.isArray(rawData) || rawData.length === 0) return null;

  const firstItem = rawData[0];

  // Already normalised (date+time+value, no extra fields like timestamp/csvContent)
  if (firstItem.date && firstItem.time && "value" in firstItem && !firstItem.timestamp && !firstItem.csvContent && !firstItem.totalKwh) {
    // Check if it has ONLY date, time, value keys
    const keys = Object.keys(firstItem);
    if (keys.length === 3 && keys.every(k => ["date", "time", "value"].includes(k))) {
      return null; // Already normalised, skip
    }
    // Has extra keys, strip them
    return rawData
      .filter((item: Record<string, unknown>) => item.date && item.time)
      .map((item: Record<string, unknown>) => ({
        date: String(item.date),
        time: String(item.time),
        value: Number(item.value) || 0,
      }));
  }

  // Auto-process format with extra fields (timestamp, kva, etc.)
  if (firstItem.date && firstItem.time && "value" in firstItem) {
    return rawData
      .filter((item: Record<string, unknown>) => item.date && item.time)
      .map((item: Record<string, unknown>) => ({
        date: String(item.date),
        time: String(item.time),
        value: Number(item.value) || 0,
      }));
  }

  // Wizard format { timestamp, value }
  if (firstItem.timestamp && "value" in firstItem && !firstItem.date) {
    const normaliseTime = (t: string) => (t.length === 5 ? t + ":00" : t);

    const result = rawData
      .map((item: Record<string, unknown>) => {
        const ts = String(item.timestamp || "").trim();
        const val = Number(item.value) || 0;

        const isoMatch = ts.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2}(?::\d{2})?)/);
        if (isoMatch) return { date: isoMatch[1], time: normaliseTime(isoMatch[2]), value: val };

        const saMatch = ts.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s+(\d{2}:\d{2}(?::\d{2})?)$/);
        if (saMatch) {
          const date = `${saMatch[3]}-${saMatch[2].padStart(2, "0")}-${saMatch[1].padStart(2, "0")}`;
          return { date, time: normaliseTime(saMatch[4]), value: val };
        }

        const parts = ts.split(" ");
        if (parts.length >= 4) {
          const day = parts[0].padStart(2, "0");
          const month = MONTH_MAP[parts[1]] || "01";
          const year = parts[2];
          const time = parts[3].length === 5 ? parts[3] + ":00" : parts[3];
          return { date: `${year}-${month}-${day}`, time, value: val };
        }
        // Date-only: "YYYY-MM-DD"
        const dateOnlyMatch = ts.match(/^(\d{4}-\d{2}-\d{2})$/);
        if (dateOnlyMatch) return { date: dateOnlyMatch[1], time: "00:00:00", value: val };

        // Date-only SA: "DD/MM/YYYY" or "DD-MM-YYYY"
        const saDateOnly = ts.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (saDateOnly) {
          const date = `${saDateOnly[3]}-${saDateOnly[2].padStart(2, "0")}-${saDateOnly[1].padStart(2, "0")}`;
          return { date, time: "00:00:00", value: val };
        }

        return null;
      })
      .filter((p: NormalisedPoint | null): p is NormalisedPoint => p !== null && p.date !== "");

    return result.length > 0 ? result : null;
  }

  // csvContent embedded
  if (firstItem.csvContent && typeof firstItem.csvContent === "string") {
    const parsed: NormalisedPoint[] = [];
    const lines = firstItem.csvContent.split("\n");

    let headerIndex = -1;
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const lower = lines[i].toLowerCase();
      if (lower.includes("rdate") || lower.includes("date") || lower.includes("time")) {
        headerIndex = i;
        break;
      }
    }
    if (headerIndex === -1) return null;

    const headers = lines[headerIndex].split(",").map((h: string) => h.trim().toLowerCase());
    const dateCol = headers.findIndex((h: string) => h.includes("date") || h === "rdate");
    const timeCol = headers.findIndex((h: string) => h.includes("time") || h === "rtime");
    const valCol = headers.findIndex((h: string) => h.includes("kwh") || h.includes("value") || h.includes("active"));
    const valueIdx = valCol === -1 ? 2 : valCol;

    for (let i = headerIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split(",");
      const date = parts[dateCol >= 0 ? dateCol : 0]?.trim();
      const time = timeCol >= 0 ? parts[timeCol]?.trim() : "00:00:00";
      const value = parseFloat(parts[valueIdx]?.replace(/[^\d.-]/g, "") || "0") || 0;
      if (date && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        parsed.push({ date, time: time || "00:00:00", value });
      }
    }
    return parsed.length > 0 ? parsed : null;
  }

  // Summary-only objects (no interval data) - nothing to normalise
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch all rows with raw_data
    const { data: rows, error: fetchError } = await supabase
      .from("scada_imports")
      .select("id, raw_data")
      .not("raw_data", "is", null);

    if (fetchError) throw fetchError;

    let normalised = 0;
    let skipped = 0;
    let errors = 0;

    for (const row of rows || []) {
      try {
        const result = normaliseRawData(row.raw_data);
        if (result === null) {
          skipped++;
          continue;
        }

        const { error: updateError } = await supabase
          .from("scada_imports")
          .update({ raw_data: result })
          .eq("id", row.id);

        if (updateError) {
          console.error(`Failed to update ${row.id}:`, updateError);
          errors++;
        } else {
          normalised++;
        }
      } catch (e) {
        console.error(`Error processing ${row.id}:`, e);
        errors++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      total: (rows || []).length,
      normalised,
      skipped,
      errors,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[normalise-raw-data] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
