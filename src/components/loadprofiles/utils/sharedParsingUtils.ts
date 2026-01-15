/**
 * Shared CSV Parsing Utilities
 * 
 * This module provides shared parsing logic used by:
 * 1. Client-side: Quick parsing for preview and small files
 * 2. Server-side: Edge functions for heavy processing
 * 
 * Design Philosophy:
 * - Client handles: Format detection, delimiter detection, column mapping UI
 * - Server handles: Large file processing, complex aggregation, validation
 */

// ============= SHARED TYPES =============

export interface ParsedDataPoint {
  timestamp: string;
  date: string;
  time: string;
  value: number;
  kva?: number;
  meterId?: string;
  originalLine: number;
}

export interface FormatDetectionResult {
  format: "pnp-scada" | "standard" | "multi-meter" | "cumulative" | "unknown";
  delimiter: string;
  headerRow: number;
  dateColumn: number;
  timeColumn: number;
  valueColumn: number;
  meterIdColumn: number;
  hasNegativeValues: boolean;
  isCumulative: boolean;
  estimatedInterval: number;
  confidence: number;
  metadata?: {
    meterName?: string;
    dateRange?: { start: string; end: string };
    meterIds?: string[];
  };
}

export interface ProcessingConfig {
  delimiter: string;
  headerRow: number;
  dateColumn: number;
  timeColumn: number;
  valueColumn: number;
  meterIdColumn?: number;
  valueUnit: string;
  handleNegatives: "filter" | "absolute" | "keep";
  handleCumulative: boolean;
  dateFormat: string;
}

// ============= DELIMITER DETECTION =============

export function detectDelimiter(content: string): string {
  const sampleLines = content.split('\n').slice(0, 10).join('\n');
  
  const counts = {
    '\t': (sampleLines.match(/\t/g) || []).length,
    ';': (sampleLines.match(/;/g) || []).length,
    ',': (sampleLines.match(/,/g) || []).length,
    '|': (sampleLines.match(/\|/g) || []).length,
  };
  
  // Return the most common delimiter
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (sorted[0][1] > 0) return sorted[0][0];
  return ',';
}

// ============= DATE PARSING =============

const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
};

export function parseDate(dateStr: string, timeStr: string | null, format: string = "DMY"): Date | null {
  if (!dateStr) return null;
  
  // Clean input
  const cleanDate = dateStr.trim().replace(/^["']|["']$/g, '');
  const cleanTime = timeStr ? timeStr.trim().replace(/^["']|["']$/g, '') : null;
  const combined = cleanTime ? `${cleanDate} ${cleanTime}` : cleanDate;
  
  // Try native parsing first (supports ISO and some others)
  const nativeDate = new Date(combined);
  if (!isNaN(nativeDate.getTime()) && combined.length >= 10) {
    // Basic check for ISO-like formats (YYYY-MM-DD or YYYY/MM/DD)
    if (/^\d{4}[-\/]\d{2}[-\/]\d{2}/.test(combined)) {
      return nativeDate;
    }
  }
  
  // Flexible regex-based parsing
  
  // 1. DD/MM/YYYY or MM/DD/YYYY or DD-MM-YYYY (with optional time)
  // Pattern: [1-2 digits] [separator] [1-2 digits] [separator] [4 digits] [optional time]
  const dmyMatch = combined.match(/^(\d{1,2})[\/\-\. ](\d{1,2})[\/\-\. ](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (dmyMatch) {
    const [, p1, p2, year, hour, min, sec] = dmyMatch;
    let day: number, month: number;
    
    if (format === "MDY") {
      month = parseInt(p1) - 1;
      day = parseInt(p2);
    } else {
      day = parseInt(p1);
      month = parseInt(p2) - 1;
    }
    
    // Validate date components
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      return new Date(parseInt(year), month, day,
        parseInt(hour || '0'), parseInt(min || '0'), parseInt(sec || '0'));
    }
  }
  
  // 2. YYYY/MM/DD or YYYY-MM-DD (with optional time)
  const ymdMatch = combined.match(/^(\d{4})[\/\-\. ](\d{1,2})[\/\-\. ](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (ymdMatch) {
    const [, year, month, day, hour, min, sec] = ymdMatch;
    const m = parseInt(month) - 1;
    const d = parseInt(day);
    if (m >= 0 && m <= 11 && d >= 1 && d <= 31) {
      return new Date(parseInt(year), m, d,
        parseInt(hour || '0'), parseInt(min || '0'), parseInt(sec || '0'));
    }
  }
  
  // 3. DD-MMM-YYYY or DD-MMM-YY (e.g., 01-Jan-24)
  const mmmMatch = combined.match(/^(\d{1,2})[\/\-\. ]([A-Za-z]{3,9})[\/\-\. ](\d{2,4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (mmmMatch) {
    const [, day, monthStr, year, hour, min, sec] = mmmMatch;
    const monthNum = MONTH_MAP[monthStr.toLowerCase().substring(0, 3)];
    if (monthNum !== undefined) {
      let fullYear = parseInt(year);
      if (year.length === 2) {
        fullYear += (fullYear > 50) ? 1900 : 2000;
      }
      return new Date(fullYear, monthNum, parseInt(day),
        parseInt(hour || '0'), parseInt(min || '0'), parseInt(sec || '0'));
    }
  }

  // Fallback: try Native again if nothing else matched but it actually worked (e.g. "January 1, 2024")
  if (!isNaN(nativeDate.getTime())) return nativeDate;
  
  return null;
}

// ============= COLUMN DETECTION =============

// Column detection patterns per spec - includes German patterns (datum, zeit)
const DATE_PATTERNS = ["rdate", "date", "datetime", "timestamp", "day", "datum"];
const TIME_PATTERNS = ["rtime", "time", "hour", "zeit"];
const VALUE_PATTERNS = ["kwh+", "kwh-", "kwh", "kw", "energy", "consumption", "reading", "value", "power", "load", "demand", "active"];
const METER_PATTERNS = ["meter", "meter_id", "meterid", "device", "channel", "point", "site"];

export function detectColumns(headers: string[], sampleRows: string[][]): {
  dateCol: number;
  timeCol: number;
  valueCol: number;
  meterIdCol: number;
} {
  const lowerHeaders = headers.map(h => h.toLowerCase().trim());
  
  let dateCol = -1;
  let timeCol = -1;
  let valueCol = -1;
  let meterIdCol = -1;
  
  // First pass: exact header matching
  for (let i = 0; i < lowerHeaders.length; i++) {
    const h = lowerHeaders[i];
    
    if (dateCol === -1 && DATE_PATTERNS.some(p => h.includes(p))) {
      dateCol = i;
    }
    if (timeCol === -1 && TIME_PATTERNS.some(p => h === p || (h.includes(p) && !h.includes("date")))) {
      timeCol = i;
    }
    if (valueCol === -1 && VALUE_PATTERNS.some(p => h.includes(p))) {
      valueCol = i;
    }
    if (meterIdCol === -1 && METER_PATTERNS.some(p => h.includes(p))) {
      meterIdCol = i;
    }
  }
  
  // Second pass: analyze sample data for undetected columns
  if ((dateCol === -1 || valueCol === -1) && sampleRows.length > 0) {
    const candidates = analyzeColumnData(sampleRows, headers.length);
    
    if (dateCol === -1 && candidates.dateColumn !== -1) {
      dateCol = candidates.dateColumn;
    }
    if (valueCol === -1 && candidates.valueColumn !== -1) {
      valueCol = candidates.valueColumn;
    }
  }
  
  // Fallbacks
  if (dateCol === -1) dateCol = 0;
  if (valueCol === -1) valueCol = headers.length > 1 ? 1 : 0;
  
  return { dateCol, timeCol, valueCol, meterIdCol };
}

function analyzeColumnData(rows: string[][], colCount: number): {
  dateColumn: number;
  valueColumn: number;
} {
  let dateColumn = -1;
  let valueColumn = -1;
  let bestValueScore = 0;
  
  for (let col = 0; col < colCount; col++) {
    let dateCount = 0;
    let numericCount = 0;
    let sum = 0;
    let hasVariation = false;
    let prevVal: number | null = null;
    
    for (let row = 0; row < Math.min(rows.length, 20); row++) {
      const val = rows[row]?.[col] || "";
      
      // Check for date pattern
      if (/\d{1,4}[-\/]\d{1,2}[-\/]\d{1,4}/.test(val)) {
        dateCount++;
      }
      
      // Check for numeric
      const numVal = parseFloat(val.replace(/[^\d.-]/g, ""));
      if (!isNaN(numVal) && isFinite(numVal)) {
        numericCount++;
        sum += Math.abs(numVal);
        if (prevVal !== null && numVal !== prevVal) {
          hasVariation = true;
        }
        prevVal = numVal;
      }
    }
    
    const sampleSize = Math.min(rows.length, 20);
    
    // Date column detection
    if (dateCount >= sampleSize * 0.8 && dateColumn === -1) {
      dateColumn = col;
    }
    
    // Value column detection - score based on numeric ratio, variation, and sum
    if (numericCount >= sampleSize * 0.5 && col !== dateColumn) {
      const score = numericCount + (hasVariation ? 10 : 0) + (sum > 0 ? 5 : 0);
      if (score > bestValueScore) {
        bestValueScore = score;
        valueColumn = col;
      }
    }
  }
  
  return { dateColumn, valueColumn };
}

// ============= FORMAT DETECTION =============

export function detectFormat(content: string): FormatDetectionResult {
  const lines = content.split('\n').slice(0, 50).filter(l => l.trim());
  
  const result: FormatDetectionResult = {
    format: "unknown",
    delimiter: detectDelimiter(content),
    headerRow: 1,
    dateColumn: 0,
    timeColumn: -1,
    valueColumn: 1,
    meterIdColumn: -1,
    hasNegativeValues: false,
    isCumulative: false,
    estimatedInterval: 60,
    confidence: 0,
  };
  
  // Check for PnP SCADA format
  const pnpResult = detectPnPScadaFormat(lines);
  if (pnpResult.isPnPScada) {
    result.format = "pnp-scada";
    result.headerRow = 2;
    result.confidence = 0.95;
    result.metadata = {
      meterName: pnpResult.meterName,
      dateRange: pnpResult.dateRange,
    };
    return result;
  }
  
  // Parse with detected delimiter
  const rows = lines.map(l => l.split(result.delimiter).map(c => c.trim().replace(/^["']|["']$/g, '')));
  
  // Find header row (first row with non-numeric first cell)
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const firstCell = rows[i]?.[0] || "";
    if (firstCell && !/^\d/.test(firstCell)) {
      result.headerRow = i + 1;
      break;
    }
  }
  
  const headers = rows[result.headerRow - 1] || [];
  const dataRows = rows.slice(result.headerRow);
  
  // Detect columns
  const detected = detectColumns(headers, dataRows);
  result.dateColumn = detected.dateCol;
  result.timeColumn = detected.timeCol;
  result.valueColumn = detected.valueCol;
  result.meterIdColumn = detected.meterIdCol;
  
  // Check for multi-meter format
  if (detected.meterIdCol !== -1) {
    const meterIds = new Set<string>();
    for (const row of dataRows.slice(0, 100)) {
      if (row[detected.meterIdCol]) {
        meterIds.add(row[detected.meterIdCol]);
      }
    }
    if (meterIds.size > 1) {
      result.format = "multi-meter";
      result.metadata = { meterIds: Array.from(meterIds) };
    }
  }
  
  // Check for negative values and cumulative readings
  let prevValue: number | null = null;
  let negativeCount = 0;
  let increasingCount = 0;
  
  for (const row of dataRows.slice(0, 100)) {
    const val = parseFloat(row[result.valueColumn]?.replace(/[^\d.-]/g, "") || "0");
    if (!isNaN(val)) {
      if (val < 0) negativeCount++;
      if (prevValue !== null && val > prevValue) increasingCount++;
      prevValue = val;
    }
  }
  
  result.hasNegativeValues = negativeCount > 0;
  result.isCumulative = increasingCount > dataRows.length * 0.9;
  
  // Estimate interval
  result.estimatedInterval = estimateDataInterval(dataRows, result.dateColumn, result.timeColumn);
  
  // Set format and confidence
  if (result.format === "unknown") {
    result.format = result.isCumulative ? "cumulative" : "standard";
  }
  result.confidence = headers.length > 0 && detected.valueCol !== -1 ? 0.8 : 0.5;
  
  return result;
}

function detectPnPScadaFormat(lines: string[]): {
  isPnPScada: boolean;
  meterName?: string;
  dateRange?: { start: string; end: string };
} {
  if (lines.length < 2) return { isPnPScada: false };
  
  const firstLine = lines[0];
  const meterMatch = firstLine.match(/^,?"([^"]+)"?,(\d{4}-\d{2}-\d{2}),(\d{4}-\d{2}-\d{2})/);
  
  const secondLine = lines[1]?.toLowerCase() || "";
  const hasScadaHeaders = secondLine.includes('rdate') && 
                          secondLine.includes('rtime') && 
                          secondLine.includes('kwh');
  
  if (meterMatch && hasScadaHeaders) {
    return {
      isPnPScada: true,
      meterName: meterMatch[1],
      dateRange: { start: meterMatch[2], end: meterMatch[3] }
    };
  }
  
  return { isPnPScada: false };
}

function estimateDataInterval(rows: string[][], dateCol: number, timeCol: number): number {
  const timestamps: number[] = [];
  
  for (let i = 0; i < Math.min(rows.length, 50); i++) {
    const dateStr = rows[i]?.[dateCol] || "";
    const timeStr = timeCol >= 0 ? rows[i]?.[timeCol] : null;
    const date = parseDate(dateStr, timeStr);
    if (date) {
      timestamps.push(date.getTime());
    }
  }
  
  if (timestamps.length < 2) return 60;
  
  timestamps.sort((a, b) => a - b);
  
  const intervals: number[] = [];
  for (let i = 1; i < timestamps.length; i++) {
    const diff = (timestamps[i] - timestamps[i - 1]) / 60000; // minutes
    if (diff > 0 && diff <= 240) {
      intervals.push(diff);
    }
  }
  
  if (intervals.length === 0) return 60;
  
  // Find mode (most common interval)
  const counts: Record<number, number> = {};
  for (const interval of intervals) {
    const rounded = roundToStandardInterval(interval);
    counts[rounded] = (counts[rounded] || 0) + 1;
  }
  
  let mode = 60;
  let maxCount = 0;
  for (const [interval, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      mode = parseInt(interval);
    }
  }
  
  return mode;
}

// Standard intervals per spec: 1, 5, 10, 15, 30, 60, 120, 180, 240 minutes
function roundToStandardInterval(minutes: number): number {
  const standards = [1, 5, 10, 15, 30, 60, 120, 180, 240];
  let closest = standards[0];
  let minDiff = Math.abs(minutes - closest);
  
  for (const s of standards) {
    const diff = Math.abs(minutes - s);
    if (diff < minDiff) {
      minDiff = diff;
      closest = s;
    }
  }
  
  return closest;
}

// ============= DATA PROCESSING HELPERS =============

export function calculateDelta(currentValue: number, previousValue: number): number {
  // Handle meter rollover (e.g., 999999 -> 0)
  if (currentValue < previousValue) {
    return currentValue; // Assume rollover, return current as delta
  }
  return currentValue - previousValue;
}

export function handleNegativeValue(value: number, strategy: "filter" | "absolute" | "keep"): number | null {
  if (value >= 0) return value;
  
  switch (strategy) {
    case "filter":
      return null;
    case "absolute":
      return Math.abs(value);
    case "keep":
      return value;
    default:
      return null;
  }
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

// ============= UNIT CONVERSION =============

export type ValueUnit = "kW" | "kWh" | "W" | "Wh" | "MW" | "MWh" | "kVA" | "kVAh" | "A" | "auto";

export function convertToKw(value: number, unit: ValueUnit, voltageV: number = 400, powerFactor: number = 0.9): number {
  switch (unit) {
    case "kW": return value;
    case "W": return value / 1000;
    case "MW": return value * 1000;
    case "kVA": return value * powerFactor;
    case "A": 
      return (Math.sqrt(3) * voltageV * value * powerFactor) / 1000;
    default: return value;
  }
}

export function convertToKwh(value: number, unit: ValueUnit, powerFactor: number = 0.9): number {
  switch (unit) {
    case "kWh": return value;
    case "Wh": return value / 1000;
    case "MWh": return value * 1000;
    case "kVAh": return value * powerFactor;
    default: return value;
  }
}

export function detectUnitFromHeader(header: string): ValueUnit {
  const h = header.toLowerCase();
  
  if (h.includes("mwh")) return "MWh";
  if (h.includes("mw") && !h.includes("mwh")) return "MW";
  if (h.includes("kvah")) return "kVAh";
  if (h.includes("kva") && !h.includes("kvah")) return "kVA";
  if (h.includes("kwh") || h.includes("energy") || h.includes("consumption")) return "kWh";
  if (h.includes("kw") && !h.includes("kwh")) return "kW";
  if (h.includes("wh") && !h.includes("kwh") && !h.includes("mwh")) return "Wh";
  if (/\bw\b/.test(h) || (h.includes("watt") && !h.includes("kw"))) return "W";
  if (h.includes("amp") || /\ba\b/.test(h) || h.includes("current")) return "A";
  
  return "kWh"; // Default for interval meter data
}

// ============= PROFILE VALIDATION =============

export interface ValidationIssues {
  allZeros: boolean;
  flatLine: boolean;
  extremeOutliers: boolean;
  tooFewPoints: boolean;
  emptyProfile: boolean;
  isInvalid: boolean;
  warnings: string[];
}

export function validateProfile(weekdayProfile: number[], weekendProfile: number[], dataPoints: number): ValidationIssues {
  const allValues = [...weekdayProfile, ...weekendProfile];
  const issues: ValidationIssues = {
    allZeros: false,
    flatLine: false,
    extremeOutliers: false,
    tooFewPoints: dataPoints < 48, // Less than 2 days of 1-hour data
    emptyProfile: allValues.every(v => v === 0),
    isInvalid: false,
    warnings: [],
  };

  if (issues.emptyProfile) {
    issues.isInvalid = true;
    issues.warnings.push("Extracted profile is empty (all zeros).");
    return issues;
  }

  // Check for flat line (all non-zero values are identical)
  const nonZeroValues = allValues.filter(v => v !== 0);
  if (nonZeroValues.length > 0) {
    const firstVal = nonZeroValues[0];
    issues.flatLine = nonZeroValues.every(v => Math.abs(v - firstVal) < 0.0001);
  }

  // Check for outliers (values > 1,000,000 kW usually indicate unit error)
  issues.extremeOutliers = allValues.some(v => v > 1000000);

  if (issues.flatLine) {
    issues.warnings.push("Profile is a 'flat line' (all consumption values are identical). Check column mapping.");
  }
  if (issues.extremeOutliers) {
    issues.warnings.push("Extremely high values detected. Check if units (e.g., Watts vs kW) are correct.");
  }
  if (issues.tooFewPoints) {
    issues.warnings.push(`Only ${dataPoints} data points processed. Profile may not be representative.`);
  }

  // Consider profile invalid if empty or has severe unit error (extremely huge values that aren't possible)
  // We don't mark flat line as "invalid" because some stable loads might actually look like that, but we warn.
  issues.isInvalid = issues.emptyProfile || (allValues.some(v => v > 10000000));

  return issues;
}
