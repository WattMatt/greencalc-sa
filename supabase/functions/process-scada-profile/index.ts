import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ColumnMapping {
  dateColumn: string; // Index as string
  timeColumn: string; // Index as string, or "-1"
  valueColumn: string; // Index as string
  kvaColumn: string; // Index as string, or "-1"
  dateFormat: string;
  timeFormat: string;
  dateTimeFormat?: string;
  renamedHeaders?: Record<string, string>;
  columnDataTypes?: Record<string, 'datetime' | 'float' | 'int' | 'string' | 'boolean'>;
}

interface RawDataPoint {
  timestamp: string;
  date: string;
  time: string;
  value: number;
  kva?: number;
  originalLine: number;
}

interface ProcessedProfile {
  weekdayProfile: number[];
  weekendProfile: number[];
  dataPoints: number;
  dateRange: { start: string; end: string };
  weekdayDays: number;
  weekendDays: number;
  rawData: RawDataPoint[];
}

// Robust Date Parser
function parseDate(dateStr: string, timeStr: string | null): Date | null {
  if (!dateStr) return null;

  const dateTimeStr = timeStr ? `${dateStr} ${timeStr}` : dateStr;
  let date = new Date(dateTimeStr);

  if (!isNaN(date.getTime())) return date;

  // Manual Parsing for common formats that Date() misses
  // DD/MM/YYYY
  const ddmmyyyy = dateTimeStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (ddmmyyyy) {
    const [, day, month, year, hour, min, sec] = ddmmyyyy;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day),
      parseInt(hour || '0'), parseInt(min || '0'), parseInt(sec || '0'));
  }

  // YYYY/MM/DD
  const yyyymmdd = dateTimeStr.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (yyyymmdd) {
    const [, year, month, day, hour, min, sec] = yyyymmdd;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day),
      parseInt(hour || '0'), parseInt(min || '0'), parseInt(sec || '0'));
  }

  // DD-MMM-YY (01-Jan-24)
  const ddmmmyy = dateTimeStr.match(/(\d{1,2})[\/\-]([A-Za-z]{3})[\/\-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (ddmmmyy) {
    const months: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };
    const [, day, monthStr, year, hour, min, sec] = ddmmmyy;
    const monthValid = months[monthStr.toLowerCase()];
    if (monthValid !== undefined) {
      const fullYear = year.length === 2 ? 2000 + parseInt(year) : parseInt(year);
      return new Date(fullYear, monthValid, parseInt(day),
        parseInt(hour || '0'), parseInt(min || '0'), parseInt(sec || '0'));
    }
  }

  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      csvContent,
      action,
      separator = 'comma',
      headerRowNumber = 1,
      dateColumn,
      timeColumn,
      valueColumn,
      kvaColumn
    } = await req.json();

    if (!csvContent) {
      throw new Error("CSV content is required");
    }

    if (action === "process") {
      const delimiter = separator === 'tab' ? '\t' :
        separator === 'semicolon' ? ';' :
          separator === 'space' ? ' ' : ',';

      // Split and filter lines, removing BOM, sep= declarations, and empty lines
      let lines = csvContent.split('\n')
        .map((l: string) => l.replace(/^\uFEFF/, '').trim()) // Remove BOM
        .filter((l: string) => {
          if (!l) return false;
          // Skip separator declarations like "sep=," or "sep=;"
          if (l.toLowerCase().startsWith('sep=')) return false;
          return true;
        });

      console.log(`Total lines after filtering: ${lines.length}`);
      console.log(`First 3 lines:`, lines.slice(0, 3));

      const headerIdx = Math.max(0, parseInt(headerRowNumber.toString()) - 1);
      const dataLines = lines.slice(headerIdx + 1).filter((l: string) => l.trim().length > 0);

      console.log(`Header index: ${headerIdx}, Data lines: ${dataLines.length}`);
      console.log(`First data line:`, dataLines[0]);

      const rawData: RawDataPoint[] = [];
      const dateSet = new Set<string>();

      const hourlyData: { weekday: number[][]; weekend: number[][] } = {
        weekday: Array.from({ length: 24 }, () => []),
        weekend: Array.from({ length: 24 }, () => []),
      };

      let weekdayDays = 0;
      let weekendDays = 0;
      const seenDates: Record<string, boolean> = {};

      // Column Indices
      const dateColIdx = parseInt(dateColumn);
      const timeColIdx = parseInt(timeColumn);
      const valColIdx = parseInt(valueColumn);
      const kvaColIdx = parseInt(kvaColumn || "-1");

      let skippedCount = 0;

      for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i];
        // Handle CSV parsing considering quotes
        let cols: string[];
        if (delimiter === ' ') {
          cols = line.trim().split(/\s+/);
        } else {
          // Simple split for now, robust CSV splitting handles quotes better but is heavier
          cols = line.split(delimiter).map((c: string) => c.trim().replace(/^["']|["']$/g, ''));
        }

        if (cols.length <= Math.max(dateColIdx, valColIdx)) {
          skippedCount++;
          continue;
        }

        const dateStr = cols[dateColIdx];
        const timeStr = timeColIdx >= 0 ? cols[timeColIdx] : null;
        const valStr = cols[valColIdx];
        const kvaStr = kvaColIdx >= 0 ? cols[kvaColIdx] : undefined;

        const dateObj = parseDate(dateStr, timeStr);
        const val = parseFloat(valStr?.replace(',', '.') || '0'); // Handle comma decimals

        if (dateObj && !isNaN(dateObj.getTime()) && !isNaN(val)) {
          const dayKey = dateObj.toISOString().split('T')[0];
          const hour = dateObj.getHours();
          const dayOfWeek = dateObj.getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

          if (!seenDates[dayKey]) {
            seenDates[dayKey] = true;
            if (isWeekend) weekendDays++; else weekdayDays++;
            dateSet.add(dayKey);
          }

          if (isWeekend) hourlyData.weekend[hour].push(val);
          else hourlyData.weekday[hour].push(val);

          rawData.push({
            timestamp: dateObj.toISOString(),
            date: dayKey,
            time: dateObj.toTimeString().split(' ')[0],
            value: val,
            kva: kvaStr ? parseFloat(kvaStr.replace(',', '.')) : undefined,
            originalLine: i + headerRowNumber + 1
          });
        } else {
          skippedCount++;
        }
      }

      // Normalize Profiles (Percentages)
      const calculateProfile = (buckets: number[][]) => {
        const avgs = buckets.map(b => b.length ? b.reduce((s, v) => s + v, 0) / b.length : 0);
        const total = avgs.reduce((s, v) => s + v, 0);
        return total === 0 ? Array(24).fill(0) : avgs.map(v => (v / total) * 100);
      };

      const weekdayProfile = calculateProfile(hourlyData.weekday);
      const weekendProfile = calculateProfile(hourlyData.weekend);

      const sortedDates = Array.from(dateSet).sort();

      console.log(`Processed ${rawData.length} points, skipped ${skippedCount}`);

      return new Response(JSON.stringify({
        success: true,
        dataPoints: rawData.length,
        dateRange: {
          start: sortedDates[0] || null,
          end: sortedDates[sortedDates.length - 1] || null
        },
        weekdayDays,
        weekendDays,
        rawData,
        weekdayProfile,
        weekendProfile
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: false, error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Error processing SCADA:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});