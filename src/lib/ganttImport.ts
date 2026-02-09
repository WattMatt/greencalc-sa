import * as XLSX from 'xlsx';
import { addDays, parse, isValid, format } from 'date-fns';

export interface ParsedScheduleTask {
  zone: string;
  category: string;
  taskName: string;
  daysScheduled: number;
  progress: number;
  startDate: string; // yyyy-MM-dd
  endDate: string;   // yyyy-MM-dd
  color: string;
}

export interface ParsedScheduleResult {
  tasks: ParsedScheduleTask[];
  zones: string[];
  categories: string[];
  dateColumnsFound: boolean;
  errors: string[];
}

// 20-color palette for zones
const ZONE_COLORS = [
  '#3b82f6', '#22c55e', '#eab308', '#f97316', '#ef4444',
  '#a855f7', '#ec4899', '#14b8a6', '#6366f1', '#84cc16',
  '#f43f5e', '#06b6d4', '#8b5cf6', '#d946ef', '#0ea5e9',
  '#10b981', '#f59e0b', '#e11d48', '#7c3aed', '#059669',
];

export function getZoneColor(zoneIndex: number): string {
  return ZONE_COLORS[zoneIndex % ZONE_COLORS.length];
}

/**
 * Detects if a string looks like a Zone header (e.g., "Zone 1", "Zone A", "ZONE 12")
 */
function isZoneRow(value: string): boolean {
  return /^zone\s+\w+/i.test(value.trim());
}

/**
 * Try to parse an Excel serial date number or date string into a JS Date
 */
function parseExcelDate(value: any): Date | null {
  if (value == null) return null;
  
  // Excel serial date number
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      return new Date(date.y, date.m - 1, date.d);
    }
  }
  
  // String date
  if (typeof value === 'string') {
    // Try common formats
    const formats = ['yyyy-MM-dd', 'dd/MM/yyyy', 'MM/dd/yyyy', 'dd-MM-yyyy', 'dd MMM yyyy'];
    for (const fmt of formats) {
      const parsed = parse(value, fmt, new Date());
      if (isValid(parsed)) return parsed;
    }
    // Try native Date parsing
    const nativeParsed = new Date(value);
    if (isValid(nativeParsed)) return nativeParsed;
  }
  
  return null;
}

/**
 * Check if a cell has progress data (non-empty, non-zero numeric or any truthy value)
 */
function hasProgressData(value: any): boolean {
  if (value == null || value === '' || value === 0) return false;
  return true;
}

/**
 * Main parser: reads the solar PV project schedule Excel format
 */
export async function parseScheduleExcel(
  file: File,
  fallbackStartDate?: Date
): Promise<ParsedScheduleResult> {
  const errors: string[] = [];
  const tasks: ParsedScheduleTask[] = [];
  const zonesSet = new Set<string>();
  const categoriesSet = new Set<string>();
  
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { tasks: [], zones: [], categories: [], dateColumnsFound: false, errors: ['No sheets found in workbook'] };
  }
  
  const sheet = workbook.Sheets[sheetName];
  const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  
  if (rawData.length < 2) {
    return { tasks: [], zones: [], categories: [], dateColumnsFound: false, errors: ['Sheet has too few rows'] };
  }
  
  // Step 1: Find the header row
  let headerRowIndex = -1;
  let taskNameColIndex = -1;
  let daysScheduledColIndex = -1;
  let progressColIndex = -1;
  let firstDateColIndex = -1;
  
  for (let r = 0; r < Math.min(20, rawData.length); r++) {
    const row = rawData[r];
    if (!row) continue;
    
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] ?? '').toLowerCase().trim();
      if (cell.includes('task name') || cell === 'task' || cell === 'activity') {
        taskNameColIndex = c;
        headerRowIndex = r;
      }
      if (cell.includes('days scheduled') || cell === 'duration' || cell === 'days') {
        daysScheduledColIndex = c;
      }
      if (cell.includes('progress') || cell === '%' || cell === '% complete') {
        progressColIndex = c;
      }
    }
    if (headerRowIndex >= 0) break;
  }
  
  if (headerRowIndex < 0) {
    // Fallback: assume first row is header, col 0 = name
    headerRowIndex = 0;
    taskNameColIndex = 0;
    errors.push('Could not detect header row. Using first row as header.');
  }
  
  // Step 2: Identify date columns (columns after the fixed columns that parse as dates)
  const headerRow = rawData[headerRowIndex];
  const dateColumns: { colIndex: number; date: Date }[] = [];
  
  if (headerRow) {
    const searchStartCol = Math.max(taskNameColIndex + 1, (progressColIndex ?? daysScheduledColIndex ?? taskNameColIndex) + 1);
    
    for (let c = searchStartCol; c < headerRow.length; c++) {
      const parsed = parseExcelDate(headerRow[c]);
      if (parsed) {
        dateColumns.push({ colIndex: c, date: parsed });
      }
    }
  }
  
  const dateColumnsFound = dateColumns.length > 0;
  
  // Sort date columns by date
  dateColumns.sort((a, b) => a.date.getTime() - b.date.getTime());
  
  // Step 3: Walk rows, detect categories, zones, and tasks
  let currentCategory = 'General';
  let currentZone = 'Zone 1';
  let zoneIndex = 0;
  const zoneColorMap = new Map<string, string>();
  
  for (let r = headerRowIndex + 1; r < rawData.length; r++) {
    const row = rawData[r];
    if (!row) continue;
    
    // Count non-empty cells
    const nonEmptyCells = row.filter((c: any) => c != null && String(c).trim() !== '');
    if (nonEmptyCells.length === 0) continue; // skip blank rows
    
    const firstCellValue = String(row[taskNameColIndex] ?? row[0] ?? '').trim();
    if (!firstCellValue) continue;
    
    // Check if this is a zone row
    if (isZoneRow(firstCellValue)) {
      currentZone = firstCellValue;
      zonesSet.add(currentZone);
      if (!zoneColorMap.has(currentZone)) {
        zoneColorMap.set(currentZone, getZoneColor(zoneIndex));
        zoneIndex++;
      }
      continue;
    }
    
    // Check if this is a category row (only first cell has value, or very few cells filled)
    // Category rows typically have just a label in column A with no duration/progress data
    const hasDuration = daysScheduledColIndex >= 0 && row[daysScheduledColIndex] != null && row[daysScheduledColIndex] !== '';
    const hasProgressVal = progressColIndex >= 0 && row[progressColIndex] != null && row[progressColIndex] !== '';
    
    if (!hasDuration && !hasProgressVal && nonEmptyCells.length <= 2) {
      currentCategory = firstCellValue;
      categoriesSet.add(currentCategory);
      continue;
    }
    
    // It's a task row
    const taskName = firstCellValue;
    const daysScheduled = daysScheduledColIndex >= 0
      ? Number(row[daysScheduledColIndex]) || 1
      : 1;
    
    let progress = 0;
    if (progressColIndex >= 0 && row[progressColIndex] != null) {
      const rawProgress = Number(row[progressColIndex]);
      // Handle both 0-1 and 0-100 formats
      progress = rawProgress > 1 ? Math.round(rawProgress) : Math.round(rawProgress * 100);
      progress = Math.max(0, Math.min(100, progress));
    }
    
    // Determine start date
    let startDate: Date | null = null;
    
    if (dateColumnsFound) {
      // Find first date column with data for this task
      for (const dc of dateColumns) {
        if (hasProgressData(row[dc.colIndex])) {
          startDate = dc.date;
          break;
        }
      }
    }
    
    if (!startDate) {
      startDate = fallbackStartDate || new Date();
    }
    
    const endDate = addDays(startDate, Math.max(daysScheduled - 1, 0));
    
    // Ensure zone is registered
    if (!zoneColorMap.has(currentZone)) {
      zonesSet.add(currentZone);
      zoneColorMap.set(currentZone, getZoneColor(zoneIndex));
      zoneIndex++;
    }
    
    tasks.push({
      zone: currentZone,
      category: currentCategory,
      taskName,
      daysScheduled,
      progress,
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      color: zoneColorMap.get(currentZone) || ZONE_COLORS[0],
    });
  }
  
  if (tasks.length === 0) {
    errors.push('No tasks could be parsed from the file. Please check the format.');
  }
  
  return {
    tasks,
    zones: Array.from(zonesSet),
    categories: Array.from(categoriesSet),
    dateColumnsFound,
    errors,
  };
}
