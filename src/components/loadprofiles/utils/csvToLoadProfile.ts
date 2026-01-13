import { WizardParseConfig, ColumnConfig } from "../types/csvImportTypes";

export interface ProcessedLoadProfile {
  weekdayProfile: number[]; // 24 hourly values in kW
  weekendProfile: number[]; // 24 hourly values in kW
  weekdayDays: number;
  weekendDays: number;
  totalKwh: number;
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  dataPoints: number;
  peakKw: number;
  avgKw: number;
}

interface ParsedRow {
  date: Date;
  hour: number;
  minute: number;
  kWh: number;
}

interface ParsedDateTime {
  date: Date;
  hour: number;
  minute: number;
}

// Parse date (and optionally time) from string - handles combined datetime fields
function parseDateTime(dateStr: string, timeStr: string | null, format: string = "YMD"): ParsedDateTime | null {
  if (!dateStr) return null;
  dateStr = dateStr.trim();
  
  // Try combined datetime format: "31/12/2024 23:30:00" or "2024-12-31 23:30:00"
  const dtMatch = dateStr.match(/^(\d{1,4})[-\/](\d{1,2})[-\/](\d{1,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (dtMatch) {
    const p1 = parseInt(dtMatch[1]);
    const p2 = parseInt(dtMatch[2]);
    const p3 = parseInt(dtMatch[3]);
    const { year, month, day } = parseYMD(p1, p2, p3, format);
    
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) {
      return { date, hour: parseInt(dtMatch[4]), minute: parseInt(dtMatch[5]) };
    }
  }
  
  // Try date-only format
  const dateOnlyMatch = dateStr.match(/^(\d{1,4})[-\/](\d{1,2})[-\/](\d{1,4})/);
  if (dateOnlyMatch) {
    const p1 = parseInt(dateOnlyMatch[1]);
    const p2 = parseInt(dateOnlyMatch[2]);
    const p3 = parseInt(dateOnlyMatch[3]);
    const { year, month, day } = parseYMD(p1, p2, p3, format);
    
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) {
      // Parse separate time column if provided
      let hour = 0, minute = 0;
      if (timeStr) {
        const timeMatch = timeStr.trim().match(/^(\d{1,2}):(\d{2})/);
        if (timeMatch) {
          hour = parseInt(timeMatch[1]);
          minute = parseInt(timeMatch[2]);
        }
      }
      return { date, hour, minute };
    }
  }
  
  return null;
}

// Helper to parse year/month/day from 3 parts with format hint
function parseYMD(p1: number, p2: number, p3: number, format: string): { year: number; month: number; day: number } {
  let year: number, month: number, day: number;
  
  // Auto-detect based on value ranges
  if (p1 > 31) {
    // YYYY-MM-DD (ISO)
    year = p1; month = p2 - 1; day = p3;
  } else if (p3 > 31) {
    // DD/MM/YYYY or MM/DD/YYYY
    if (format === "MDY") {
      month = p1 - 1; day = p2; year = p3;
    } else {
      day = p1; month = p2 - 1; year = p3;
    }
  } else {
    // Ambiguous, use format hint
    switch (format) {
      case "DMY": day = p1; month = p2 - 1; year = p3; break;
      case "MDY": month = p1 - 1; day = p2; year = p3; break;
      default: year = p1; month = p2 - 1; day = p3;
    }
  }
  
  // Handle 2-digit years
  if (year < 100) year += year > 50 ? 1900 : 2000;
  
  return { year, month, day };
}

// Find column index by name pattern
function findColumnIndex(headers: string[], patterns: string[]): number {
  const lowerHeaders = headers.map(h => h.toLowerCase().trim());
  for (const pattern of patterns) {
    const idx = lowerHeaders.findIndex(h => h.includes(pattern.toLowerCase()));
    if (idx !== -1) return idx;
  }
  return -1;
}

// Detect if a column contains numeric values
function isNumericColumn(rows: string[][], colIdx: number): boolean {
  if (colIdx < 0 || rows.length === 0) return false;
  
  let numericCount = 0;
  const sampleSize = Math.min(rows.length, 20);
  
  for (let i = 0; i < sampleSize; i++) {
    const val = rows[i]?.[colIdx]?.replace(/[^\d.-]/g, "");
    if (val && !isNaN(parseFloat(val))) {
      numericCount++;
    }
  }
  
  return numericCount >= sampleSize * 0.5; // 50% threshold - be lenient
}

// Detect if a column contains date/time values
function isDateTimeColumn(rows: string[][], colIdx: number): boolean {
  if (colIdx < 0 || rows.length === 0) return false;
  
  let dateCount = 0;
  const sampleSize = Math.min(rows.length, 10);
  
  for (let i = 0; i < sampleSize; i++) {
    const val = rows[i]?.[colIdx] || "";
    if (/\d{1,4}[-\/]\d{1,2}[-\/]\d{1,4}/.test(val)) {
      dateCount++;
    }
  }
  
  return dateCount >= sampleSize * 0.8;
}

// Find the best kWh/value column by analyzing data - SMART DETECTION
function findValueColumn(headers: string[], rows: string[][]): number {
  const lowerHeaders = headers.map(h => h.toLowerCase().trim());
  
  // First try common energy column patterns
  const energyPatterns = ["kwh+", "kwh-", "kwh", "energy", "consumption", "reading", "value", "amount", "usage", "total", "active", "power", "load"];
  
  for (const pattern of energyPatterns) {
    const idx = lowerHeaders.findIndex(h => h.includes(pattern));
    if (idx !== -1 && isNumericColumn(rows, idx)) {
      return idx;
    }
  }
  
  // Look for columns that are NOT date/time and ARE numeric
  // This handles columns like "p14", "meter1", etc.
  for (let i = 0; i < headers.length; i++) {
    const header = lowerHeaders[i];
    if (header.includes("date") || header.includes("time") || header.includes("timestamp")) {
      continue;
    }
    if (isNumericColumn(rows, i) && !isDateTimeColumn(rows, i)) {
      console.log(`[findValueColumn] Found numeric column at index ${i}: "${headers[i]}"`);
      return i;
    }
  }
  
  return -1;
}

// Get date format from column config
function getDateFormat(columns: ColumnConfig[], index: number): string {
  const col = columns.find(c => c.index === index);
  return col?.dateFormat || "YMD";
}

// Check if a date is a weekend
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function processCSVToLoadProfile(
  headers: string[],
  rows: string[][],
  config: WizardParseConfig
): ProcessedLoadProfile {
  console.log(`[processCSV] Starting with ${headers.length} headers, ${rows.length} rows`);
  console.log(`[processCSV] Headers:`, headers);
  
  let dateColIdx = -1;
  let timeColIdx = -1;
  let kwhColIdx = -1;
  
  // Look for configured columns first (from wizard step 3)
  if (config.columns && config.columns.length > 0) {
    for (const col of config.columns) {
      if (col.dataType === "date" && dateColIdx === -1) {
        dateColIdx = col.index;
      } else if (col.dataType === "general" && kwhColIdx === -1) {
        kwhColIdx = col.index;
      }
    }
    // Check for time column
    for (const col of config.columns) {
      const lowerName = col.name.toLowerCase();
      if ((lowerName.includes("time") || lowerName.includes("rtime")) && col.dataType !== "skip") {
        timeColIdx = col.index;
        break;
      }
    }
  }
  
  // Fall back to auto-detection
  if (dateColIdx === -1) {
    dateColIdx = findColumnIndex(headers, ["rdate", "date", "datetime", "timestamp"]);
  }
  if (timeColIdx === -1) {
    timeColIdx = findColumnIndex(headers, ["rtime", "time"]);
  }
  if (kwhColIdx === -1) {
    kwhColIdx = findColumnIndex(headers, ["kwh+", "kwh-", "kwh", "energy", "consumption", "reading", "value", "amount", "usage"]);
    if (kwhColIdx === -1) {
      kwhColIdx = findValueColumn(headers, rows);
    }
  }
  
  console.log(`[processCSV] Column detection: date=${dateColIdx}, time=${timeColIdx}, kwh=${kwhColIdx}`);
  
  if (dateColIdx === -1 || kwhColIdx === -1) {
    console.warn(`[processCSV] Missing required columns. Date: ${dateColIdx}, kWh: ${kwhColIdx}`);
    console.warn(`[processCSV] Headers:`, headers);
    console.warn(`[processCSV] Sample row:`, rows[0]);
    return createEmptyProfile();
  }
  
  console.log(`[processCSV] Using: Date="${headers[dateColIdx]}", Time="${headers[timeColIdx] || 'N/A'}", kWh="${headers[kwhColIdx]}"`);
  
  const dateFormat = getDateFormat(config.columns, dateColIdx);
  
  // Parse all rows
  const parsedRows: ParsedRow[] = [];
  const uniqueDates = new Set<string>();
  let parseErrors = 0;
  
  for (const row of rows) {
    const dateStr = row[dateColIdx];
    const timeStr = timeColIdx !== -1 ? row[timeColIdx] : null;
    const kwhStr = row[kwhColIdx];
    
    const parsed = parseDateTime(dateStr, timeStr, dateFormat);
    if (!parsed) {
      parseErrors++;
      continue;
    }
    
    const dateKey = parsed.date.toISOString().split('T')[0];
    uniqueDates.add(dateKey);
    
    // Parse kWh value
    const kWh = parseFloat(kwhStr?.replace(/[^\d.-]/g, "") || "0");
    if (isNaN(kWh)) continue;
    
    parsedRows.push({ 
      date: parsed.date, 
      hour: parsed.hour, 
      minute: parsed.minute, 
      kWh 
    });
  }
  
  console.log(`[processCSV] Parsed ${parsedRows.length} rows, ${parseErrors} errors, ${uniqueDates.size} unique dates`);
  
  if (parsedRows.length === 0) {
    console.warn(`[processCSV] No valid rows parsed!`);
    return createEmptyProfile();
  }
  
  // Aggregate by hour for weekdays and weekends
  const weekdayHours: { [hour: number]: number[] } = {};
  const weekendHours: { [hour: number]: number[] } = {};
  
  for (let h = 0; h < 24; h++) {
    weekdayHours[h] = [];
    weekendHours[h] = [];
  }
  
  const weekdayDates = new Set<string>();
  const weekendDates = new Set<string>();
  
  for (const row of parsedRows) {
    const dateKey = row.date.toISOString().split('T')[0];
    const isWeekendDay = isWeekend(row.date);
    
    if (isWeekendDay) {
      weekendDates.add(dateKey);
      weekendHours[row.hour].push(row.kWh);
    } else {
      weekdayDates.add(dateKey);
      weekdayHours[row.hour].push(row.kWh);
    }
  }
  
  // Calculate average kW for each hour
  const weekdayProfile: number[] = [];
  const weekendProfile: number[] = [];
  
  for (let h = 0; h < 24; h++) {
    const wdValues = weekdayHours[h];
    const wdDayCount = weekdayDates.size || 1;
    const wdHourlySum = wdValues.reduce((sum, v) => sum + v, 0);
    weekdayProfile.push(Math.round((wdHourlySum / wdDayCount) * 100) / 100);
    
    const weValues = weekendHours[h];
    const weDayCount = weekendDates.size || 1;
    const weHourlySum = weValues.reduce((sum, v) => sum + v, 0);
    weekendProfile.push(Math.round((weHourlySum / weDayCount) * 100) / 100);
  }
  
  // Calculate totals
  const totalKwh = parsedRows.reduce((sum, row) => sum + row.kWh, 0);
  const allValues = [...weekdayProfile, ...weekendProfile].filter(v => v > 0);
  const peakKw = Math.max(...allValues, 0);
  const avgKw = allValues.length > 0 
    ? allValues.reduce((sum, v) => sum + v, 0) / allValues.length 
    : 0;
  
  // Get date range
  const sortedDates = Array.from(uniqueDates).sort();
  const dateRangeStart = sortedDates[0] || null;
  const dateRangeEnd = sortedDates[sortedDates.length - 1] || null;
  
  console.log(`[processCSV] Result: ${parsedRows.length} points, ${totalKwh.toFixed(1)} kWh, peak ${peakKw.toFixed(1)} kW`);
  
  return {
    weekdayProfile,
    weekendProfile,
    weekdayDays: weekdayDates.size,
    weekendDays: weekendDates.size,
    totalKwh: Math.round(totalKwh * 100) / 100,
    dateRangeStart,
    dateRangeEnd,
    dataPoints: parsedRows.length,
    peakKw: Math.round(peakKw * 100) / 100,
    avgKw: Math.round(avgKw * 100) / 100,
  };
}

function createEmptyProfile(): ProcessedLoadProfile {
  return {
    weekdayProfile: Array(24).fill(0),
    weekendProfile: Array(24).fill(0),
    weekdayDays: 0,
    weekendDays: 0,
    totalKwh: 0,
    dateRangeStart: null,
    dateRangeEnd: null,
    dataPoints: 0,
    peakKw: 0,
    avgKw: 0,
  };
}