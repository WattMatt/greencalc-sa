import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============= TYPES =============

interface RawDataPoint {
  timestamp: string;
  date: string;
  time: string;
  value: number;
  kva?: number;
  meterId?: string;
  originalLine: number;
}

interface FormatDetection {
  format: "pnp-scada" | "standard" | "multi-meter" | "cumulative" | "unknown";
  delimiter: string;
  headerRow: number;
  hasNegatives: boolean;
  isCumulative: boolean;
  meterIds?: string[];
  confidence: number;
}

interface ProcessingStats {
  totalRows: number;
  processedRows: number;
  skippedRows: number;
  negativeValues: number;
  parseErrors: string[];
}

// ============= DATE PARSING =============

const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
};

function parseDate(dateStr: string, timeStr: string | null, format: string = "DMY"): Date | null {
  if (!dateStr) return null;

  const combined = timeStr ? `${dateStr.trim()} ${timeStr.trim()}` : dateStr.trim();
  
  // Try native parsing first (ISO format)
  const nativeDate = new Date(combined);
  if (!isNaN(nativeDate.getTime()) && combined.includes('-') && combined.length >= 10) {
    return nativeDate;
  }

  // DD/MM/YYYY HH:mm:ss or DD-MM-YYYY HH:mm:ss
  const ddmmyyyy = combined.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (ddmmyyyy) {
    const [, p1, p2, year, hour, min, sec] = ddmmyyyy;
    let day: number, month: number;
    
    if (format === "MDY") {
      month = parseInt(p1) - 1;
      day = parseInt(p2);
    } else {
      day = parseInt(p1);
      month = parseInt(p2) - 1;
    }
    
    return new Date(parseInt(year), month, day,
      parseInt(hour || '0'), parseInt(min || '0'), parseInt(sec || '0'));
  }

  // YYYY/MM/DD HH:mm:ss or YYYY-MM-DD HH:mm:ss
  const yyyymmdd = combined.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (yyyymmdd) {
    const [, year, month, day, hour, min, sec] = yyyymmdd;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day),
      parseInt(hour || '0'), parseInt(min || '0'), parseInt(sec || '0'));
  }

  // DD-MMM-YY HH:mm:ss (01-Jan-24)
  const ddmmmyy = combined.match(/(\d{1,2})[\/\-]([A-Za-z]{3})[\/\-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (ddmmmyy) {
    const [, day, monthStr, year, hour, min, sec] = ddmmmyy;
    const monthNum = MONTH_MAP[monthStr.toLowerCase()];
    if (monthNum !== undefined) {
      const fullYear = year.length === 2 ? 2000 + parseInt(year) : parseInt(year);
      return new Date(fullYear, monthNum, parseInt(day),
        parseInt(hour || '0'), parseInt(min || '0'), parseInt(sec || '0'));
    }
  }

  return null;
}

// ============= DELIMITER & FORMAT DETECTION =============

function detectDelimiter(content: string): string {
  const sampleLines = content.split('\n').slice(0, 10).join('\n');
  
  const counts = {
    '\t': (sampleLines.match(/\t/g) || []).length,
    ';': (sampleLines.match(/;/g) || []).length,
    ',': (sampleLines.match(/,/g) || []).length,
    '|': (sampleLines.match(/\|/g) || []).length,
  };
  
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (sorted[0][1] > 0) return sorted[0][0];
  return ',';
}

function detectFormat(lines: string[], delimiter: string): FormatDetection {
  const result: FormatDetection = {
    format: "unknown",
    delimiter,
    headerRow: 1,
    hasNegatives: false,
    isCumulative: false,
    confidence: 0,
  };
  
  // Check for PnP SCADA format
  if (lines.length >= 2) {
    const firstLine = lines[0];
    const meterMatch = firstLine.match(/^,?"([^"]+)"?,(\d{4}-\d{2}-\d{2}),(\d{4}-\d{2}-\d{2})/);
    const secondLine = lines[1]?.toLowerCase() || "";
    const hasScadaHeaders = secondLine.includes('rdate') && 
                            secondLine.includes('rtime') && 
                            secondLine.includes('kwh');
    
    if (meterMatch && hasScadaHeaders) {
      result.format = "pnp-scada";
      result.headerRow = 2;
      result.confidence = 0.95;
      return result;
    }
  }
  
  // Parse rows to analyze
  const rows = lines.map(l => l.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, '')));
  
  // Find header row
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const firstCell = rows[i]?.[0] || "";
    if (firstCell && !/^\d/.test(firstCell)) {
      result.headerRow = i + 1;
      break;
    }
  }
  
  const dataRows = rows.slice(result.headerRow);
  
  // Check for meter ID column (multi-meter detection)
  const headers = rows[result.headerRow - 1] || [];
  const lowerHeaders = headers.map(h => h.toLowerCase());
  const meterColIdx = lowerHeaders.findIndex(h => 
    h.includes('meter') || h.includes('device') || h.includes('channel') || h.includes('point')
  );
  
  if (meterColIdx !== -1) {
    const meterIds = new Set<string>();
    for (const row of dataRows.slice(0, 200)) {
      if (row[meterColIdx]) meterIds.add(row[meterColIdx]);
    }
    if (meterIds.size > 1) {
      result.format = "multi-meter";
      result.meterIds = Array.from(meterIds);
    }
  }
  
  // Find value column and analyze data
  let valueColIdx = lowerHeaders.findIndex(h => 
    h.includes('kwh') || h.includes('energy') || h.includes('value') || h.includes('reading')
  );
  if (valueColIdx === -1) valueColIdx = 1;
  
  let negativeCount = 0;
  let prevValue: number | null = null;
  let increasingCount = 0;
  
  for (const row of dataRows.slice(0, 200)) {
    const val = parseFloat(row[valueColIdx]?.replace(/[^\d.-]/g, "") || "0");
    if (!isNaN(val)) {
      if (val < 0) negativeCount++;
      if (prevValue !== null && val > prevValue) increasingCount++;
      prevValue = val;
    }
  }
  
  result.hasNegatives = negativeCount > 0;
  result.isCumulative = increasingCount > dataRows.length * 0.9;
  
  if (result.format === "unknown") {
    result.format = result.isCumulative ? "cumulative" : "standard";
  }
  
  result.confidence = headers.length > 0 ? 0.8 : 0.5;
  
  return result;
}

// ============= COLUMN DETECTION =============

const DATE_PATTERNS = ["rdate", "date", "datetime", "timestamp", "day"];
const TIME_PATTERNS = ["rtime", "time"];
const VALUE_PATTERNS = ["kwh+", "kwh-", "kwh", "kw", "energy", "consumption", "reading", "value", "power", "active"];

function autoDetectColumns(headers: string[], sampleRows: string[][]): { 
  dateCol: number; 
  valueCol: number; 
  timeCol: number;
  meterIdCol: number;
} {
  const lowerHeaders = headers.map(h => h.toLowerCase().trim());
  
  let dateCol = -1;
  let timeCol = -1;
  let valueCol = -1;
  let meterIdCol = -1;
  
  console.log(`[autoDetect] Headers: ${JSON.stringify(headers)}`);
  
  // Header-based detection
  for (let i = 0; i < lowerHeaders.length; i++) {
    const h = lowerHeaders[i];
    
    if (dateCol === -1 && DATE_PATTERNS.some(p => h.includes(p))) {
      dateCol = i;
      console.log(`[autoDetect] Date column: ${i} (${headers[i]})`);
    }
    if (timeCol === -1 && TIME_PATTERNS.some(p => h === p || (h.includes(p) && !h.includes("date")))) {
      timeCol = i;
      console.log(`[autoDetect] Time column: ${i} (${headers[i]})`);
    }
    if (valueCol === -1 && VALUE_PATTERNS.some(p => h.includes(p))) {
      valueCol = i;
      console.log(`[autoDetect] Value column: ${i} (${headers[i]})`);
    }
    if (meterIdCol === -1 && (h.includes('meter') || h.includes('device') || h.includes('channel'))) {
      meterIdCol = i;
      console.log(`[autoDetect] Meter ID column: ${i} (${headers[i]})`);
    }
  }
  
  // Data-based detection for value column
  if (valueCol === -1 && sampleRows.length > 0) {
    const candidates: Array<{ idx: number; score: number }> = [];
    
    for (let idx = 0; idx < headers.length; idx++) {
      if (idx === dateCol || idx === timeCol) continue;
      
      let numericCount = 0;
      let hasVariation = false;
      let sum = 0;
      let prevVal: number | null = null;
      
      for (const row of sampleRows.slice(0, 20)) {
        const valStr = row[idx]?.replace(/[^\d.-]/g, "") || "";
        const val = parseFloat(valStr);
        
        if (!isNaN(val) && isFinite(val)) {
          numericCount++;
          sum += Math.abs(val);
          if (prevVal !== null && val !== prevVal) hasVariation = true;
          prevVal = val;
        }
      }
      
      if (numericCount >= 10) {
        const score = numericCount + (hasVariation ? 10 : 0) + (sum > 0 ? 5 : 0);
        candidates.push({ idx, score });
      }
    }
    
    candidates.sort((a, b) => b.score - a.score);
    if (candidates.length > 0) {
      valueCol = candidates[0].idx;
      console.log(`[autoDetect] Value column (data-based): ${valueCol} (${headers[valueCol]})`);
    }
  }
  
  // Fallbacks
  if (dateCol === -1) dateCol = 0;
  if (valueCol === -1) valueCol = headers.length > 1 ? 1 : 0;
  
  console.log(`[autoDetect] Final: date=${dateCol}, time=${timeCol}, value=${valueCol}, meter=${meterIdCol}`);
  
  return { dateCol, valueCol, timeCol, meterIdCol };
}

// ============= DATA PROCESSING =============

function calculateDelta(current: number, previous: number): number {
  if (current < previous) {
    // Meter rollover
    return current;
  }
  return current - previous;
}

function processMultiMeterData(
  rawData: RawDataPoint[],
  meterIds: string[]
): Record<string, { weekdayProfile: number[]; weekendProfile: number[]; dataPoints: number }> {
  const result: Record<string, { weekday: number[][]; weekend: number[][]; count: number }> = {};
  
  // Initialize for each meter
  for (const meterId of meterIds) {
    result[meterId] = {
      weekday: Array.from({ length: 24 }, () => []),
      weekend: Array.from({ length: 24 }, () => []),
      count: 0,
    };
  }
  
  // Aggregate data per meter
  for (const point of rawData) {
    if (!point.meterId || !result[point.meterId]) continue;
    
    const date = new Date(point.timestamp);
    const hour = date.getHours();
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    
    if (isWeekend) {
      result[point.meterId].weekend[hour].push(point.value);
    } else {
      result[point.meterId].weekday[hour].push(point.value);
    }
    result[point.meterId].count++;
  }
  
  // Calculate averages
  const output: Record<string, { weekdayProfile: number[]; weekendProfile: number[]; dataPoints: number }> = {};
  
  for (const [meterId, data] of Object.entries(result)) {
    output[meterId] = {
      weekdayProfile: data.weekday.map(arr => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0),
      weekendProfile: data.weekend.map(arr => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0),
      dataPoints: data.count,
    };
  }
  
  return output;
}

// ============= MAIN HANDLER =============

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
      headerRowNumber,
      dateColumn: manualDateColumn,
      timeColumn: manualTimeColumn,
      valueColumn: manualValueColumn,
      meterIdColumn: manualMeterIdColumn,
      kvaColumn,
      autoDetect = true,
      handleNegatives = "filter", // "filter" | "absolute" | "keep"
      handleCumulative = false,
      dateFormat = "DMY",
    } = body;

    if (!csvContent) {
      throw new Error("CSV content is required");
    }

    // Action: detect - just return format detection
    if (action === "detect") {
      const lines = csvContent.split('\n')
        .map((l: string) => l.replace(/^\uFEFF/, '').trim())
        .filter((l: string) => l && !l.toLowerCase().startsWith('sep='));
      
      const delimiter = manualSeparator 
        ? (manualSeparator === 'tab' ? '\t' : manualSeparator === 'semicolon' ? ';' : manualSeparator)
        : detectDelimiter(csvContent);
      
      const formatResult = detectFormat(lines, delimiter);
      
      // Also detect columns
      const headerIdx = formatResult.headerRow - 1;
      const rows = lines.map((l: string) => l.split(delimiter).map((c: string) => c.trim().replace(/^["']|["']$/g, '')));
      const headers = rows[headerIdx] || [];
      const dataRows = rows.slice(headerIdx + 1);
      
      const columns = autoDetectColumns(headers, dataRows.slice(0, 20));
      
      return new Response(JSON.stringify({
        success: true,
        ...formatResult,
        columns,
        headers,
        sampleRows: dataRows.slice(0, 5),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === "process") {
      const stats: ProcessingStats = {
        totalRows: 0,
        processedRows: 0,
        skippedRows: 0,
        negativeValues: 0,
        parseErrors: [],
      };
      
      // Clean and filter lines
      let lines = csvContent.split('\n')
        .map((l: string) => l.replace(/^\uFEFF/, '').trim())
        .filter((l: string) => l && !l.toLowerCase().startsWith('sep='));

      // Auto-detect or use manual settings
      const delimiter = manualSeparator 
        ? (manualSeparator === 'tab' ? '\t' : manualSeparator === 'semicolon' ? ';' : manualSeparator === 'space' ? ' ' : manualSeparator)
        : detectDelimiter(lines.join('\n'));

      // Detect format
      const formatResult = detectFormat(lines, delimiter);
      
      console.log(`[process] Delimiter: "${delimiter === '\t' ? 'TAB' : delimiter}", Format: ${formatResult.format}`);
      console.log(`[process] Lines: ${lines.length}, Has negatives: ${formatResult.hasNegatives}, Is cumulative: ${formatResult.isCumulative}`);

      const headerIdx = headerRowNumber !== undefined 
        ? Math.max(0, parseInt(headerRowNumber.toString()) - 1)
        : formatResult.headerRow - 1;
      
      // Parse all rows
      const allRows = lines.map((line: string) => {
        if (delimiter === ' ') {
          return line.split(/\s+/);
        }
        return line.split(delimiter).map((c: string) => c.trim().replace(/^["']|["']$/g, ''));
      });
      
      const headers = allRows[headerIdx] || [];
      const dataRows = allRows.slice(headerIdx + 1).filter((row: string[]) => row.some(cell => cell.trim()));
      
      stats.totalRows = dataRows.length;

      console.log(`[process] Headers: ${JSON.stringify(headers)}`);
      console.log(`[process] Data rows: ${dataRows.length}`);

      // Determine column indices
      let dateColIdx: number;
      let timeColIdx: number;
      let valColIdx: number;
      let meterColIdx: number;
      
      if (autoDetect && (manualDateColumn === undefined || manualValueColumn === undefined)) {
        const detected = autoDetectColumns(headers, dataRows.slice(0, 20));
        dateColIdx = manualDateColumn !== undefined ? parseInt(manualDateColumn) : detected.dateCol;
        timeColIdx = manualTimeColumn !== undefined ? parseInt(manualTimeColumn) : detected.timeCol;
        valColIdx = manualValueColumn !== undefined ? parseInt(manualValueColumn) : detected.valueCol;
        meterColIdx = manualMeterIdColumn !== undefined ? parseInt(manualMeterIdColumn) : detected.meterIdCol;
      } else {
        dateColIdx = parseInt(manualDateColumn || '0');
        timeColIdx = parseInt(manualTimeColumn || '-1');
        valColIdx = parseInt(manualValueColumn || '1');
        meterColIdx = parseInt(manualMeterIdColumn || '-1');
      }
      
      const kvaColIdx = parseInt(kvaColumn || '-1');

      console.log(`[process] Columns - Date: ${dateColIdx}, Time: ${timeColIdx}, Value: ${valColIdx}, Meter: ${meterColIdx}`);

      const rawData: RawDataPoint[] = [];
      const dateSet = new Set<string>();
      const hourlyData: { weekday: number[][]; weekend: number[][] } = {
        weekday: Array.from({ length: 24 }, () => []),
        weekend: Array.from({ length: 24 }, () => []),
      };

      let weekdayDays = 0;
      let weekendDays = 0;
      const seenDates: Record<string, boolean> = {};
      
      // For cumulative readings
      let previousValue: number | null = null;
      const shouldHandleCumulative = handleCumulative || formatResult.isCumulative;

      for (let i = 0; i < dataRows.length; i++) {
        const cols = dataRows[i];

        if (cols.length <= Math.max(dateColIdx, valColIdx)) {
          stats.skippedRows++;
          continue;
        }

        const dateStr = cols[dateColIdx];
        const timeStr = timeColIdx >= 0 ? cols[timeColIdx] : null;
        let valStr = cols[valColIdx];
        const kvaStr = kvaColIdx >= 0 ? cols[kvaColIdx] : undefined;
        const meterId = meterColIdx >= 0 ? cols[meterColIdx] : undefined;

        const dateObj = parseDate(dateStr, timeStr, dateFormat);
        let val = parseFloat(valStr?.replace(/[^\d.-]/g, '') || '0');

        if (!dateObj || isNaN(dateObj.getTime())) {
          stats.skippedRows++;
          if (stats.parseErrors.length < 5) {
            stats.parseErrors.push(`Line ${i + headerIdx + 2}: Invalid date "${dateStr}"`);
          }
          continue;
        }

        if (isNaN(val)) {
          stats.skippedRows++;
          continue;
        }

        // Handle cumulative readings
        if (shouldHandleCumulative && previousValue !== null) {
          val = calculateDelta(val, previousValue);
        }
        if (shouldHandleCumulative) {
          previousValue = parseFloat(valStr?.replace(/[^\d.-]/g, '') || '0');
        }

        // Handle negative values
        if (val < 0) {
          stats.negativeValues++;
          if (handleNegatives === "filter") {
            stats.skippedRows++;
            continue;
          } else if (handleNegatives === "absolute") {
            val = Math.abs(val);
          }
          // "keep" leaves it as-is
        }

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
          kva: kvaStr ? parseFloat(kvaStr.replace(/[^\d.-]/g, '')) : undefined,
          meterId,
          originalLine: i + headerIdx + 2
        });
        
        stats.processedRows++;
      }

      // Calculate average kW profiles
      const calculateProfile = (buckets: number[][]) => {
        return buckets.map(b => b.length ? b.reduce((s, v) => s + v, 0) / b.length : 0);
      };

      const weekdayProfile = calculateProfile(hourlyData.weekday);
      const weekendProfile = calculateProfile(hourlyData.weekend);
      const sortedDates = Array.from(dateSet).sort();

      console.log(`[process] Processed ${stats.processedRows}/${stats.totalRows} rows, skipped ${stats.skippedRows}, negatives ${stats.negativeValues}`);

      // Process multi-meter data if applicable
      let meterData: Record<string, { weekdayProfile: number[]; weekendProfile: number[]; dataPoints: number }> | undefined;
      
      if (formatResult.format === "multi-meter" && formatResult.meterIds && formatResult.meterIds.length > 1) {
        meterData = processMultiMeterData(rawData, formatResult.meterIds);
        console.log(`[process] Multi-meter: ${Object.keys(meterData).length} meters`);
      }

      return new Response(JSON.stringify({
        success: true,
        dataPoints: stats.processedRows,
        dateRange: {
          start: sortedDates[0] || null,
          end: sortedDates[sortedDates.length - 1] || null
        },
        weekdayDays,
        weekendDays,
        rawData: rawData.slice(0, 5000), // Limit raw data size
        weekdayProfile,
        weekendProfile,
        detectedColumns: {
          dateColumn: dateColIdx,
          timeColumn: timeColIdx,
          valueColumn: valColIdx,
          meterIdColumn: meterColIdx,
          headers
        },
        format: formatResult,
        stats,
        meterData, // Multi-meter breakdown if applicable
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: false, error: "Invalid action. Use 'detect' or 'process'" }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("[process-scada-profile] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});