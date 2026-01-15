import { WizardParseConfig, ColumnConfig } from "../types/csvImportTypes";

// Define the extended unit type
export type ValueUnit = "kW" | "kWh" | "W" | "Wh" | "MW" | "MWh" | "kVA" | "kVAh" | "A" | "auto";

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
  detectedInterval: number; // Detected interval in minutes (15, 30, 60, etc.)
}

interface ParsedRow {
  date: Date;
  hour: number;
  minute: number;
  value: number; // Converted value in kW (for power units) or kWh (for energy units)
}

interface ParsedDateTime {
  date: Date;
  hour: number;
  minute: number;
}

// Unit conversion utilities
function convertToKw(value: number, unit: ValueUnit, voltageV: number = 400, powerFactor: number = 0.9): number {
  switch (unit) {
    case "kW": return value;
    case "W": return value / 1000;
    case "MW": return value * 1000;
    case "kVA": return value * powerFactor;
    case "A": 
      // 3-phase: P = √3 × V × I × PF / 1000 (to get kW)
      return (Math.sqrt(3) * voltageV * value * powerFactor) / 1000;
    default: return value; // For energy units, return as-is (will be handled differently)
  }
}

function convertToKwh(value: number, unit: ValueUnit, powerFactor: number = 0.9): number {
  switch (unit) {
    case "kWh": return value;
    case "Wh": return value / 1000;
    case "MWh": return value * 1000;
    case "kVAh": return value * powerFactor;
    default: return value; // For power units, return as-is
  }
}

function isEnergyUnit(unit: ValueUnit): boolean {
  return ["kWh", "Wh", "MWh", "kVAh"].includes(unit);
}

function isPowerUnit(unit: ValueUnit): boolean {
  return ["kW", "W", "MW", "kVA", "A"].includes(unit);
}

// Detect data interval from timestamps (returns interval in minutes)
function detectDataInterval(parsedRows: ParsedRow[]): number {
  if (parsedRows.length < 2) return 60; // Default to hourly
  
  // Sort by timestamp to analyze consecutive readings
  const sortedRows = [...parsedRows].sort((a, b) => {
    const aTime = a.date.getTime() + a.hour * 3600000 + a.minute * 60000;
    const bTime = b.date.getTime() + b.hour * 3600000 + b.minute * 60000;
    return aTime - bTime;
  });
  
  // Calculate intervals between consecutive readings
  const intervals: number[] = [];
  for (let i = 1; i < Math.min(sortedRows.length, 100); i++) { // Sample first 100 pairs
    const prev = sortedRows[i - 1];
    const curr = sortedRows[i];
    
    const prevTime = prev.date.getTime() + prev.hour * 3600000 + prev.minute * 60000;
    const currTime = curr.date.getTime() + curr.hour * 3600000 + curr.minute * 60000;
    
    const diffMinutes = (currTime - prevTime) / 60000;
    
    // Only consider reasonable intervals (1 min to 4 hours)
    if (diffMinutes > 0 && diffMinutes <= 240) {
      intervals.push(diffMinutes);
    }
  }
  
  if (intervals.length === 0) return 60;
  
  // Find the most common interval (mode)
  const intervalCounts: Record<number, number> = {};
  for (const interval of intervals) {
    // Round to nearest standard interval (5, 10, 15, 30, 60, 120, etc.)
    const rounded = roundToStandardInterval(interval);
    intervalCounts[rounded] = (intervalCounts[rounded] || 0) + 1;
  }
  
  // Find the interval with the highest count
  let mostCommonInterval = 60;
  let maxCount = 0;
  for (const [interval, count] of Object.entries(intervalCounts)) {
    if (count > maxCount) {
      maxCount = count;
      mostCommonInterval = parseInt(interval);
    }
  }
  
  console.log(`[detectDataInterval] Detected interval: ${mostCommonInterval} minutes from ${intervals.length} samples`);
  return mostCommonInterval;
}

// Round to nearest standard interval per spec: 1, 5, 10, 15, 30, 60, 120, 180, 240 minutes
function roundToStandardInterval(minutes: number): number {
  const standardIntervals = [1, 5, 10, 15, 30, 60, 120, 180, 240];
  let closest = standardIntervals[0];
  let minDiff = Math.abs(minutes - closest);
  
  for (const interval of standardIntervals) {
    const diff = Math.abs(minutes - interval);
    if (diff < minDiff) {
      minDiff = diff;
      closest = interval;
    }
  }
  
  return closest;
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
  let valueUnit: ValueUnit = config.valueUnit || "auto";
  const voltageV = config.voltageV || 400;
  const powerFactor = config.powerFactor || 0.9;
  
  // PRIORITY 1: Use explicitly configured column indices from wizard step 4
  if (config.valueColumnIndex !== undefined && config.valueColumnIndex >= 0) {
    kwhColIdx = config.valueColumnIndex;
    console.log(`[processCSV] Using explicit value column: ${kwhColIdx} (${headers[kwhColIdx]})`);
  }
  if (config.dateColumnIndex !== undefined && config.dateColumnIndex >= 0) {
    dateColIdx = config.dateColumnIndex;
    console.log(`[processCSV] Using explicit date column: ${dateColIdx} (${headers[dateColIdx]})`);
  }
  if (config.timeColumnIndex !== undefined && config.timeColumnIndex >= 0) {
    timeColIdx = config.timeColumnIndex;
    console.log(`[processCSV] Using explicit time column: ${timeColIdx} (${headers[timeColIdx]})`);
  }
  
  // PRIORITY 2: Look for configured columns from wizard step 3
  if (config.columns && config.columns.length > 0) {
    for (const col of config.columns) {
      if (col.dataType === "date" && dateColIdx === -1) {
        dateColIdx = col.index;
      } else if (col.dataType === "general" && kwhColIdx === -1) {
        kwhColIdx = col.index;
      }
    }
    // Check for time column
    if (timeColIdx === -1) {
      for (const col of config.columns) {
        const lowerName = col.name.toLowerCase();
        if ((lowerName.includes("time") || lowerName.includes("rtime")) && col.dataType !== "skip") {
          timeColIdx = col.index;
          break;
        }
      }
    }
  }
  
  // PRIORITY 3: Fall back to auto-detection
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
  
  // Auto-detect unit type from column header if not specified or auto
  if (valueUnit === "auto" && kwhColIdx !== -1) {
    const colHeader = headers[kwhColIdx]?.toLowerCase() || "";
    if (colHeader.includes("mwh")) {
      valueUnit = "MWh";
    } else if (colHeader.includes("mw") && !colHeader.includes("mwh")) {
      valueUnit = "MW";
    } else if (colHeader.includes("kvah")) {
      valueUnit = "kVAh";
    } else if (colHeader.includes("kva")) {
      valueUnit = "kVA";
    } else if (colHeader.includes("kwh") || colHeader.includes("energy") || colHeader.includes("consumption")) {
      valueUnit = "kWh";
    } else if (colHeader.includes("kw") && !colHeader.includes("kwh")) {
      valueUnit = "kW";
    } else if (colHeader.includes("wh") && !colHeader.includes("kwh") && !colHeader.includes("mwh")) {
      valueUnit = "Wh";
    } else if (/\bw\b/.test(colHeader) || (colHeader.includes("watt") && !colHeader.includes("kwh") && !colHeader.includes("kw"))) {
      valueUnit = "W";
    } else if (colHeader.includes("amp") || /\ba\b/.test(colHeader) || colHeader.includes("current")) {
      valueUnit = "A";
    } else {
      // Default to kWh for interval meter data
      valueUnit = "kWh";
    }
    console.log(`[processCSV] Auto-detected unit: ${valueUnit} from header "${headers[kwhColIdx]}"`);
  }
  
  console.log(`[processCSV] Final column detection: date=${dateColIdx}, time=${timeColIdx}, value=${kwhColIdx}, unit=${valueUnit}`);
  
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
    
    // Parse raw value
    const rawValue = parseFloat(kwhStr?.replace(/[^\d.-]/g, "") || "0");
    if (isNaN(rawValue)) continue;
    
    // Convert to standard unit (kW for power, kWh for energy)
    let convertedValue: number;
    if (isPowerUnit(valueUnit)) {
      convertedValue = convertToKw(rawValue, valueUnit, voltageV, powerFactor);
    } else {
      convertedValue = convertToKwh(rawValue, valueUnit, powerFactor);
    }
    
    parsedRows.push({ 
      date: parsed.date, 
      hour: parsed.hour, 
      minute: parsed.minute, 
      value: convertedValue
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
      weekendHours[row.hour].push(row.value);
    } else {
      weekdayDates.add(dateKey);
      weekdayHours[row.hour].push(row.value);
    }
  }
  
  // Detect data interval
  const detectedInterval = detectDataInterval(parsedRows);
  
  // Determine if we're working with power or energy units
  const isEnergy = isEnergyUnit(valueUnit);
  
  // Calculate load profile for each hour based on unit type
  // For power units: average the power values to get typical power for this hour
  // For energy units: sum the energy readings for each hour, then average across days
  const weekdayProfile: number[] = [];
  const weekendProfile: number[] = [];
  
  // Detect readings per hour (how many sub-hourly intervals)
  const sampleHourReadings = Object.values(weekdayHours).find(arr => arr.length > 0)?.length || 1;
  const daysInSample = weekdayDates.size || 1;
  const readingsPerHourPerDay = sampleHourReadings / daysInSample;
  
  console.log(`[processCSV] Unit type: ${valueUnit} (${isEnergy ? 'energy' : 'power'}), readings per hour per day: ~${readingsPerHourPerDay.toFixed(1)}`);
  
  for (let h = 0; h < 24; h++) {
    const wdValues = weekdayHours[h];
    const wdDayCount = weekdayDates.size || 1;
    
    let wdHourlyValue: number;
    if (!isEnergy) {
      // For power readings: average the power values to get typical power for this hour
      wdHourlyValue = wdValues.length > 0 
        ? wdValues.reduce((sum, v) => sum + v, 0) / wdValues.length 
        : 0;
    } else {
      // For energy readings: sum all readings and divide by days to get avg kWh per hour
      const totalEnergy = wdValues.reduce((sum, v) => sum + v, 0);
      wdHourlyValue = totalEnergy / wdDayCount;
    }
    weekdayProfile.push(Math.round(wdHourlyValue * 100) / 100);
    
    const weValues = weekendHours[h];
    const weDayCount = weekendDates.size || 1;
    
    let weHourlyValue: number;
    if (!isEnergy) {
      weHourlyValue = weValues.length > 0 
        ? weValues.reduce((sum, v) => sum + v, 0) / weValues.length 
        : 0;
    } else {
      const totalEnergy = weValues.reduce((sum, v) => sum + v, 0);
      weHourlyValue = totalEnergy / weDayCount;
    }
    weekendProfile.push(Math.round(weHourlyValue * 100) / 100);
  }
  
  // Calculate totals based on unit type and detected interval
  let totalKwh: number;
  if (!isEnergy) {
    // For power readings: integrate power over time
    // Use detected interval for more accurate calculation
    const intervalHours = detectedInterval / 60;
    totalKwh = parsedRows.reduce((sum, row) => sum + row.value * intervalHours, 0);
    console.log(`[processCSV] Using detected interval of ${detectedInterval} min (${intervalHours} hours) for power-to-energy conversion`);
  } else {
    // For energy readings: sum directly (already converted to kWh)
    totalKwh = parsedRows.reduce((sum, row) => sum + row.value, 0);
  }
  
  const allValues = [...weekdayProfile, ...weekendProfile].filter(v => v > 0);
  const peakKw = Math.max(...allValues, 0);
  const avgKw = allValues.length > 0 
    ? allValues.reduce((sum, v) => sum + v, 0) / allValues.length 
    : 0;
  
  // Get date range
  const sortedDates = Array.from(uniqueDates).sort();
  const dateRangeStart = sortedDates[0] || null;
  const dateRangeEnd = sortedDates[sortedDates.length - 1] || null;
  
  console.log(`[processCSV] Result: ${parsedRows.length} points, ${totalKwh.toFixed(1)} kWh, peak ${peakKw.toFixed(1)} kW (unit: ${valueUnit}, interval: ${detectedInterval}min)`);
  
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
    detectedInterval,
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
    detectedInterval: 60,
  };
}

/**
 * Validates a processed load profile per CSV_EXTRACTION_SPECIFICATION.md
 * Rejects profiles where all values are identical (indicates extraction failure)
 * @returns true if profile is valid, false if extraction likely failed
 */
export function validateLoadProfile(profile: ProcessedLoadProfile): { 
  isValid: boolean; 
  reason?: string;
} {
  // Check for no data points
  if (profile.dataPoints === 0) {
    return { isValid: false, reason: "No data points parsed from file" };
  }
  
  // Check for all-zero profiles
  const weekdayAllZero = profile.weekdayProfile.every(v => v === 0);
  const weekendAllZero = profile.weekendProfile.every(v => v === 0);
  
  if (weekdayAllZero && weekendAllZero) {
    return { isValid: false, reason: "All profile values are zero" };
  }
  
  // Check for all-identical profiles (non-zero) - strong indicator of extraction failure
  // This catches the 4.17, 4.17, 4.17... pattern or any other flat profile
  const allWeekdaySame = profile.weekdayProfile.every(v => v === profile.weekdayProfile[0]);
  const allWeekendSame = profile.weekendProfile.every(v => v === profile.weekendProfile[0]);
  
  // Only flag if BOTH profiles are identical (flat) - some meters legitimately have flat weekend profiles
  if (allWeekdaySame && allWeekendSame && profile.weekdayProfile[0] === profile.weekendProfile[0]) {
    // Allow if it's all zeros (already handled above) or if there's natural variation
    if (profile.weekdayProfile[0] !== 0) {
      return { 
        isValid: false, 
        reason: `All profile values are identical (${profile.weekdayProfile[0].toFixed(2)}) - possible extraction failure` 
      };
    }
  }
  
  // Check for unrealistic peak values (likely unit conversion error)
  if (profile.peakKw > 100000) {
    return { 
      isValid: false, 
      reason: `Unrealistic peak value (${profile.peakKw.toFixed(0)} kW) - check unit settings` 
    };
  }
  
  return { isValid: true };
}