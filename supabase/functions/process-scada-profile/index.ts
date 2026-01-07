import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RawDataPoint {
  timestamp: string;
  date: string;
  time: string;
  value: number;
  kva?: number;
  originalLine: number;
}

// Robust Date Parser - handles many common formats
function parseDate(dateStr: string, timeStr: string | null): Date | null {
  if (!dateStr) return null;

  const dateTimeStr = timeStr ? `${dateStr} ${timeStr}` : dateStr;
  
  // Try native parsing first
  let date = new Date(dateTimeStr);
  if (!isNaN(date.getTime())) return date;

  // DD/MM/YYYY HH:mm:ss or DD-MM-YYYY HH:mm:ss
  const ddmmyyyy = dateTimeStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (ddmmyyyy) {
    const [, day, month, year, hour, min, sec] = ddmmyyyy;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day),
      parseInt(hour || '0'), parseInt(min || '0'), parseInt(sec || '0'));
  }

  // YYYY/MM/DD HH:mm:ss or YYYY-MM-DD HH:mm:ss
  const yyyymmdd = dateTimeStr.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (yyyymmdd) {
    const [, year, month, day, hour, min, sec] = yyyymmdd;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day),
      parseInt(hour || '0'), parseInt(min || '0'), parseInt(sec || '0'));
  }

  // DD-MMM-YY HH:mm:ss (01-Jan-24)
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

// Auto-detect separator from content
function detectSeparator(content: string): string {
  const firstLines = content.split('\n').slice(0, 5).join('\n');
  
  // Count occurrences of each separator
  const counts = {
    '\t': (firstLines.match(/\t/g) || []).length,
    ';': (firstLines.match(/;/g) || []).length,
    ',': (firstLines.match(/,/g) || []).length,
  };
  
  // Return the most common separator
  if (counts['\t'] > counts[';'] && counts['\t'] > counts[',']) return '\t';
  if (counts[';'] > counts[',']) return ';';
  return ',';
}

// Check if a string looks like a date/datetime
function looksLikeDateTime(value: string): boolean {
  if (!value) return false;
  const v = value.trim();
  
  // Common datetime patterns
  const patterns = [
    /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/, // DD/MM/YYYY or MM/DD/YYYY
    /^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/, // YYYY-MM-DD
    /^\d{1,2}[\/\-][A-Za-z]{3}[\/\-]\d{2,4}/, // DD-MMM-YY
  ];
  
  return patterns.some(p => p.test(v));
}

// Check if a string looks like a number
function looksLikeNumber(value: string): boolean {
  if (!value) return false;
  const v = value.trim().replace(',', '.');
  return !isNaN(parseFloat(v)) && isFinite(parseFloat(v));
}

// Auto-detect columns from headers and sample data
function autoDetectColumns(headers: string[], sampleRows: string[][]): { dateCol: number; valueCol: number; timeCol: number } {
  let dateCol = -1;
  let timeCol = -1;
  let valueCol = -1;
  
  console.log(`Auto-detecting from ${headers.length} headers: ${JSON.stringify(headers)}`);
  
  // First, try to find by header names
  for (let idx = 0; idx < headers.length; idx++) {
    const lower = (headers[idx] || '').toLowerCase().trim();
    
    // Date column detection
    if (dateCol === -1 && (lower.includes('date') || lower.includes('timestamp') || lower === 'time' || lower === 'datetime')) {
      dateCol = idx;
      console.log(`Found date column by header name: ${idx} (${headers[idx]})`);
    }
    
    // Value column detection
    if (valueCol === -1 && (lower.includes('kwh') || lower.includes('value') || lower.includes('active') || lower.includes('reading') || lower.includes('energy') || lower.includes('power') || lower.includes('consumption'))) {
      valueCol = idx;
      console.log(`Found value column by header name: ${idx} (${headers[idx]})`);
    }
  }
  
  // If value not found by name, look for first numeric column that isn't the date
  if (valueCol === -1 && sampleRows.length > 0) {
    for (let idx = 0; idx < headers.length; idx++) {
      if (idx === dateCol) continue;
      
      const sampleValues = sampleRows.slice(0, 5).map(row => row[idx]).filter(v => v !== undefined && v !== null && v !== '');
      
      if (sampleValues.length > 0 && sampleValues.every(v => looksLikeNumber(v))) {
        valueCol = idx;
        console.log(`Found value column by content analysis: ${idx} (${headers[idx]}), samples: ${sampleValues.slice(0, 3).join(', ')}`);
        break;
      }
    }
  }
  
  // Fallbacks - for simple 2-column CSVs, column 0 is date, column 1 is value
  if (dateCol === -1) {
    dateCol = 0;
    console.log(`Defaulting date column to 0`);
  }
  if (valueCol === -1) {
    valueCol = headers.length > 1 ? 1 : 0;
    console.log(`Defaulting value column to ${valueCol}`);
  }
  
  console.log(`Final auto-detected columns - Date: ${dateCol}, Value: ${valueCol}, Time: ${timeCol}`);
  
  return { dateCol, valueCol, timeCol };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      csvContent,
      action,
      separator: manualSeparator,
      headerRowNumber = 1,
      dateColumn: manualDateColumn,
      timeColumn: manualTimeColumn,
      valueColumn: manualValueColumn,
      kvaColumn,
      autoDetect = true // New flag to enable auto-detection
    } = body;

    if (!csvContent) {
      throw new Error("CSV content is required");
    }

    if (action === "process") {
      // Clean and filter lines
      let lines = csvContent.split('\n')
        .map((l: string) => l.replace(/^\uFEFF/, '').trim())
        .filter((l: string) => {
          if (!l) return false;
          if (l.toLowerCase().startsWith('sep=')) return false;
          return true;
        });

      // Auto-detect or use manual separator
      const delimiter = manualSeparator 
        ? (manualSeparator === 'tab' ? '\t' : manualSeparator === 'semicolon' ? ';' : manualSeparator === 'space' ? ' ' : ',')
        : detectSeparator(lines.join('\n'));

      console.log(`Using delimiter: "${delimiter === '\t' ? 'TAB' : delimiter}"`);
      console.log(`Total lines after filtering: ${lines.length}`);

      const headerIdx = Math.max(0, parseInt(headerRowNumber.toString()) - 1);
      
      // Parse all rows
      const allRows = lines.map((line: string) => {
        if (delimiter === ' ') {
          return line.split(/\s+/);
        }
        return line.split(delimiter).map((c: string) => c.trim().replace(/^["']|["']$/g, ''));
      });
      
      const headers = allRows[headerIdx] || [];
      const dataRows = allRows.slice(headerIdx + 1).filter((row: string[]) => row.some(cell => cell.trim()));

      console.log(`Headers: ${JSON.stringify(headers)}`);
      console.log(`Data rows: ${dataRows.length}`);

      // Determine column indices
      let dateColIdx: number;
      let timeColIdx: number;
      let valColIdx: number;
      
      if (autoDetect && (manualDateColumn === undefined || manualValueColumn === undefined)) {
        const detected = autoDetectColumns(headers, dataRows.slice(0, 10));
        dateColIdx = manualDateColumn !== undefined ? parseInt(manualDateColumn) : detected.dateCol;
        timeColIdx = manualTimeColumn !== undefined ? parseInt(manualTimeColumn) : detected.timeCol;
        valColIdx = manualValueColumn !== undefined ? parseInt(manualValueColumn) : detected.valueCol;
      } else {
        dateColIdx = parseInt(manualDateColumn || '0');
        timeColIdx = parseInt(manualTimeColumn || '-1');
        valColIdx = parseInt(manualValueColumn || '1');
      }
      
      const kvaColIdx = parseInt(kvaColumn || '-1');

      console.log(`Using columns - Date: ${dateColIdx}, Time: ${timeColIdx}, Value: ${valColIdx}`);

      const rawData: RawDataPoint[] = [];
      const dateSet = new Set<string>();
      const hourlyData: { weekday: number[][]; weekend: number[][] } = {
        weekday: Array.from({ length: 24 }, () => []),
        weekend: Array.from({ length: 24 }, () => []),
      };

      let weekdayDays = 0;
      let weekendDays = 0;
      const seenDates: Record<string, boolean> = {};
      let skippedCount = 0;
      let parseErrors: string[] = [];

      for (let i = 0; i < dataRows.length; i++) {
        const cols = dataRows[i];

        if (cols.length <= Math.max(dateColIdx, valColIdx)) {
          skippedCount++;
          continue;
        }

        const dateStr = cols[dateColIdx];
        const timeStr = timeColIdx >= 0 ? cols[timeColIdx] : null;
        const valStr = cols[valColIdx];
        const kvaStr = kvaColIdx >= 0 ? cols[kvaColIdx] : undefined;

        const dateObj = parseDate(dateStr, timeStr);
        const val = parseFloat(valStr?.replace(',', '.') || '0');

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
          if (parseErrors.length < 5) {
            parseErrors.push(`Line ${i + 2}: Could not parse date "${dateStr}" or value "${valStr}"`);
          }
        }
      }

      // Calculate normalized profiles
      const calculateProfile = (buckets: number[][]) => {
        const avgs = buckets.map(b => b.length ? b.reduce((s, v) => s + v, 0) / b.length : 0);
        const total = avgs.reduce((s, v) => s + v, 0);
        return total === 0 ? Array(24).fill(0) : avgs.map(v => (v / total) * 100);
      };

      const weekdayProfile = calculateProfile(hourlyData.weekday);
      const weekendProfile = calculateProfile(hourlyData.weekend);
      const sortedDates = Array.from(dateSet).sort();

      console.log(`Processed ${rawData.length} points, skipped ${skippedCount}`);
      if (parseErrors.length > 0) {
        console.log(`Sample parse errors: ${parseErrors.join('; ')}`);
      }

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
        weekendProfile,
        detectedColumns: {
          dateColumn: dateColIdx,
          valueColumn: valColIdx,
          headers
        },
        skippedRows: skippedCount,
        parseErrors: parseErrors.slice(0, 5)
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