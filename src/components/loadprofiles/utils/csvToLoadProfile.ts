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
  date: Date | null;
  hour: number;
  minute: number;
  kWh: number;
}

// Parse date based on format configuration
function parseDate(dateStr: string, format: string = "YMD"): Date | null {
  if (!dateStr) return null;
  
  // Clean the string
  dateStr = dateStr.trim();
  
  // Try ISO format first (YYYY-MM-DD)
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
  }
  
  // Try other formats based on config
  const parts = dateStr.split(/[-\/\.]/);
  if (parts.length >= 3) {
    let year: number, month: number, day: number;
    
    switch (format) {
      case "DMY":
        day = parseInt(parts[0]);
        month = parseInt(parts[1]) - 1;
        year = parseInt(parts[2]);
        break;
      case "MDY":
        month = parseInt(parts[0]) - 1;
        day = parseInt(parts[1]);
        year = parseInt(parts[2]);
        break;
      case "YMD":
      default:
        year = parseInt(parts[0]);
        month = parseInt(parts[1]) - 1;
        day = parseInt(parts[2]);
        break;
    }
    
    // Handle 2-digit years
    if (year < 100) {
      year += year > 50 ? 1900 : 2000;
    }
    
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  
  return null;
}

// Parse time string to hour and minute
function parseTime(timeStr: string): { hour: number; minute: number } | null {
  if (!timeStr) return null;
  
  timeStr = timeStr.trim();
  
  // Match HH:MM or HH:MM:SS format
  const match = timeStr.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (match) {
    return {
      hour: parseInt(match[1]),
      minute: parseInt(match[2])
    };
  }
  
  return null;
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

// Get date format from column config
function getDateFormat(columns: ColumnConfig[], index: number): string {
  const col = columns.find(c => c.index === index);
  return col?.dateFormat || "YMD";
}

// Check if a date is a weekend
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
}

export function processCSVToLoadProfile(
  headers: string[],
  rows: string[][],
  config: WizardParseConfig
): ProcessedLoadProfile {
  // First, check if user has configured column types explicitly
  let dateColIdx = -1;
  let timeColIdx = -1;
  let kwhColIdx = -1;
  
  // Look for configured columns first (from wizard step 3)
  if (config.columns && config.columns.length > 0) {
    for (const col of config.columns) {
      if (col.dataType === "date") {
        // First date column found is the date column
        if (dateColIdx === -1) {
          dateColIdx = col.index;
        }
      } else if (col.dataType === "general") {
        // First "general" (numeric) column is the kWh column
        if (kwhColIdx === -1) {
          kwhColIdx = col.index;
        }
      }
    }
  }
  
  // Check for time column by name pattern in configured columns
  if (config.columns && config.columns.length > 0) {
    for (const col of config.columns) {
      const lowerName = col.name.toLowerCase();
      if ((lowerName.includes("time") || lowerName.includes("rtime")) && col.dataType !== "skip") {
        timeColIdx = col.index;
        break;
      }
    }
  }
  
  // Fall back to auto-detection if columns not found in config
  if (dateColIdx === -1) {
    dateColIdx = findColumnIndex(headers, ["rdate", "date", "datetime", "timestamp"]);
  }
  if (timeColIdx === -1) {
    timeColIdx = findColumnIndex(headers, ["rtime", "time"]);
  }
  if (kwhColIdx === -1) {
    kwhColIdx = findColumnIndex(headers, ["kwh+", "kwh", "energy", "consumption", "reading", "value", "amount"]);
  }
  
  if (dateColIdx === -1 || kwhColIdx === -1) {
    console.warn("Could not find required columns. Date:", dateColIdx, "kWh:", kwhColIdx, "Headers:", headers, "Config columns:", config.columns);
    return createEmptyProfile();
  }
  
  console.log(`Processing CSV: Date col=${dateColIdx} (${headers[dateColIdx]}), Time col=${timeColIdx} (${headers[timeColIdx] || 'N/A'}), kWh col=${kwhColIdx} (${headers[kwhColIdx]})`);
  
  const dateFormat = getDateFormat(config.columns, dateColIdx);
  
  // Parse all rows
  const parsedRows: ParsedRow[] = [];
  const uniqueDates = new Set<string>();
  
  for (const row of rows) {
    const dateStr = row[dateColIdx];
    const timeStr = timeColIdx !== -1 ? row[timeColIdx] : null;
    const kwhStr = row[kwhColIdx];
    
    const date = parseDate(dateStr, dateFormat);
    if (!date) continue;
    
    const dateKey = date.toISOString().split('T')[0];
    uniqueDates.add(dateKey);
    
    // Parse time
    let hour = 0;
    let minute = 0;
    
    if (timeStr) {
      const time = parseTime(timeStr);
      if (time) {
        hour = time.hour;
        minute = time.minute;
      }
    }
    
    // Parse kWh value
    const kWh = parseFloat(kwhStr?.replace(/[^\d.-]/g, "") || "0");
    if (isNaN(kWh)) continue;
    
    parsedRows.push({ date, hour, minute, kWh });
  }
  
  if (parsedRows.length === 0) {
    return createEmptyProfile();
  }
  
  // Determine interval (usually 30 min for SCADA)
  const intervalMinutes = detectInterval(parsedRows);
  const intervalsPerHour = 60 / intervalMinutes;
  
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
    if (!row.date) continue;
    
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
  // Note: If data is in kWh per interval, convert to kW
  const weekdayProfile: number[] = [];
  const weekendProfile: number[] = [];
  
  for (let h = 0; h < 24; h++) {
    // Weekday: sum all readings for this hour across all days, divide by number of days
    const wdValues = weekdayHours[h];
    const wdDayCount = weekdayDates.size || 1;
    // Sum readings for the hour, then average per day
    // If readings are in kWh per 30-min interval, sum them per hour = kWh/hour
    // Average across days gives average kWh consumed in that hour
    const wdHourlySum = wdValues.reduce((sum, v) => sum + v, 0);
    const wdAvgKwhPerHour = wdHourlySum / wdDayCount;
    // Convert kWh per hour to average kW: kWh/hour = kW (for that hour's average power)
    weekdayProfile.push(Math.round(wdAvgKwhPerHour * intervalsPerHour * 100) / 100);
    
    // Weekend
    const weValues = weekendHours[h];
    const weDayCount = weekendDates.size || 1;
    const weHourlySum = weValues.reduce((sum, v) => sum + v, 0);
    const weAvgKwhPerHour = weHourlySum / weDayCount;
    weekendProfile.push(Math.round(weAvgKwhPerHour * intervalsPerHour * 100) / 100);
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

function detectInterval(rows: ParsedRow[]): number {
  // Sample first few rows to detect interval
  if (rows.length < 2) return 30;
  
  const intervals: number[] = [];
  
  for (let i = 1; i < Math.min(rows.length, 10); i++) {
    const prev = rows[i - 1];
    const curr = rows[i];
    
    if (!prev.date || !curr.date) continue;
    
    const prevMinutes = prev.hour * 60 + prev.minute;
    const currMinutes = curr.hour * 60 + curr.minute;
    
    let diff = currMinutes - prevMinutes;
    if (diff < 0) diff += 24 * 60; // Handle day boundary
    
    if (diff > 0 && diff <= 60) {
      intervals.push(diff);
    }
  }
  
  if (intervals.length === 0) return 30;
  
  // Return most common interval
  const counts: { [key: number]: number } = {};
  for (const interval of intervals) {
    counts[interval] = (counts[interval] || 0) + 1;
  }
  
  let maxCount = 0;
  let mostCommon = 30;
  for (const [interval, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      mostCommon = parseInt(interval);
    }
  }
  
  return mostCommon;
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
