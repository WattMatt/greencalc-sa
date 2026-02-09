import * as XLSX from 'xlsx';
import { addDays, format } from 'date-fns';

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

const MONTH_MAP: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function parseMonthHeader(value: any): { month: number; year: number | null } | null {
  if (value == null) return null;

  if (typeof value === 'number' && value > 1 && value < 100000) {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + value * 86400000);
    if (!isNaN(date.getTime())) {
      return { month: date.getMonth(), year: date.getFullYear() };
    }
  }

  if (value instanceof Date && !isNaN(value.getTime())) {
    return { month: value.getMonth(), year: value.getFullYear() };
  }

  const str = String(value).trim();
  if (!str) return null;

  const dashMatch = str.match(/^([a-zA-Z]+)\s*[-/]\s*(\d{2,4})$/);
  if (dashMatch) {
    const month = MONTH_MAP[dashMatch[1].toLowerCase()];
    if (month !== undefined) {
      let yr = parseInt(dashMatch[2], 10);
      if (yr < 100) yr += 2000;
      return { month, year: yr };
    }
  }

  const month = MONTH_MAP[str.toLowerCase()];
  if (month !== undefined) return { month, year: null };

  return null;
}

function getRowFormattedValues(
  sheet: XLSX.WorkSheet,
  row: number,
  startCol: number,
  maxCol: number
): (string | null)[] {
  const values: (string | null)[] = [];
  for (let c = 0; c < maxCol; c++) {
    if (c < startCol) {
      values.push(null);
      continue;
    }
    const cellAddress = XLSX.utils.encode_cell({ r: row, c });
    const cell = sheet[cellAddress];
    if (!cell) {
      values.push(null);
    } else {
      values.push(cell.w != null ? String(cell.w) : (cell.v != null ? String(cell.v) : null));
    }
  }
  return values;
}

/**
 * Build date headers from 3-row layout.
 * No fallback year — if a month header has no year info, an error is pushed.
 */
function buildDateHeaders(
  rows: any[][],
  startCol: number,
  row0Formatted: (string | null)[],
  errors: string[]
): { colIndex: number; date: Date }[] {
  const row2 = rows[2] || [];
  const maxCol = Math.max(row0Formatted.length, row2.length);

  let currentMonth: number | null = null;
  let year: number | null = null;
  let prevDay = 0;
  const headers: { colIndex: number; date: Date }[] = [];
  let yearErrorReported = false;

  for (let c = startCol; c < maxCol; c++) {
    const rawVal = row0Formatted[c];
    const parsed = parseMonthHeader(rawVal);
    if (parsed !== null) {
      if (parsed.year !== null) {
        year = parsed.year;
      } else if (year === null && !yearErrorReported) {
        errors.push(`Month header '${rawVal}' has no year. Expected format like 'August-25'.`);
        yearErrorReported = true;
      }

      if (year !== null && currentMonth !== null && parsed.month < currentMonth && parsed.year === null) {
        year++;
      }
      currentMonth = parsed.month;
      prevDay = 0;
    }

    if (year === null || currentMonth === null) continue;

    const dayVal = row2[c];
    if (dayVal == null) continue;

    const day = Number(dayVal);
    if (isNaN(day) || day < 1 || day > 31) continue;

    if (day < prevDay && prevDay > 0) {
      currentMonth++;
      if (currentMonth > 11) {
        currentMonth = 0;
        year++;
      }
    }
    prevDay = day;

    headers.push({ colIndex: c, date: new Date(year, currentMonth, day) });
  }

  if (year === null && !yearErrorReported) {
    errors.push('No year information found in any month header. Expected format like "August-25" or "September-2025".');
  }

  return headers;
}

const DATA_START_COL = 6;

/**
 * Main parser: reads the solar PV project schedule Excel format.
 * No fallback dates — missing date info results in errors.
 */
export async function parseScheduleExcel(
  file: File
): Promise<ParsedScheduleResult> {
  const errors: string[] = [];
  const tasks: ParsedScheduleTask[] = [];
  const zonesSet = new Set<string>();
  const categoriesSet = new Set<string>();

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { tasks: [], zones: [], categories: [], dateColumnsFound: false, errors: ['No sheets found in workbook'] };
  }

  const sheet = workbook.Sheets[sheetName];
  const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

  if (rawData.length < 4) {
    return { tasks: [], zones: [], categories: [], dateColumnsFound: false, errors: ['Sheet has too few rows (need at least 4)'] };
  }

  const maxCol = (rawData[0]?.length || 0);
  const row0Formatted = getRowFormattedValues(sheet, 0, DATA_START_COL, Math.max(maxCol, 200));

  const dateHeaders = buildDateHeaders(rawData, DATA_START_COL, row0Formatted, errors);
  const dateColumnsFound = dateHeaders.length > 0;

  const dateByCol = new Map<number, Date>();
  for (const dh of dateHeaders) {
    dateByCol.set(dh.colIndex, dh.date);
  }

  let currentCategory = 'General';
  let currentZone = 'Zone 1';
  let zoneIndex = 0;
  const zoneColorMap = new Map<string, string>();
  let skippedCount = 0;

  for (let r = 3; r < rawData.length; r++) {
    const row = rawData[r];
    if (!row) continue;

    const colA = row[0];
    if (colA != null && String(colA).trim() !== '') {
      currentCategory = String(colA).trim();
      categoriesSet.add(currentCategory);
    }

    const colB = row[1];
    if (colB != null && String(colB).trim() !== '') {
      currentZone = String(colB).trim();
      zonesSet.add(currentZone);
      if (!zoneColorMap.has(currentZone)) {
        zoneColorMap.set(currentZone, getZoneColor(zoneIndex));
        zoneIndex++;
      }
    }

    const colC = row[2];
    if (colC == null || String(colC).trim() === '') continue;
    const taskName = String(colC).trim();

    const daysScheduled = Math.max(Number(row[3]) || 1, 1);

    let progress = 0;
    if (row[5] != null) {
      const rawProgress = Number(row[5]);
      if (!isNaN(rawProgress)) {
        progress = rawProgress > 1 ? Math.round(rawProgress) : Math.round(rawProgress * 100);
        progress = Math.max(0, Math.min(100, progress));
      }
    }

    // Find start and end dates from daily columns — no fallback
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    if (dateColumnsFound) {
      for (let c = DATA_START_COL; c < row.length; c++) {
        if (row[c] != null && row[c] !== '') {
          const d = dateByCol.get(c);
          if (d) {
            if (!startDate) startDate = d;
            endDate = d;
          }
        }
      }
    }

    if (!startDate || !endDate) {
      skippedCount++;
      continue; // skip task — no start date found
    }

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

  if (skippedCount > 0) {
    errors.push(`${skippedCount} task(s) skipped — no start date found in the schedule columns.`);
  }

  if (tasks.length === 0 && errors.length === 0) {
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
