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

function parseMonthName(value: any): number | null {
  if (value == null) return null;
  const key = String(value).trim().toLowerCase();
  return MONTH_MAP[key] ?? null;
}

/**
 * Build date headers from 3-row layout:
 * Row 0: Month names (forward-filled across columns)
 * Row 1: Week labels (ignored)
 * Row 2: Day numbers
 */
function buildDateHeaders(
  rows: any[][],
  startCol: number,
  referenceYear: number
): { colIndex: number; date: Date }[] {
  const row0 = rows[0] || [];
  const row2 = rows[2] || [];
  const maxCol = Math.max(row0.length, row2.length);

  let currentMonth: number | null = null;
  let prevDay = 0;
  let year = referenceYear;
  const headers: { colIndex: number; date: Date }[] = [];

  for (let c = startCol; c < maxCol; c++) {
    // Update month from row 0 (forward-fill)
    const monthParsed = parseMonthName(row0[c]);
    if (monthParsed !== null) {
      // Handle year rollover: if new month < previous month, bump year
      if (currentMonth !== null && monthParsed < currentMonth) {
        year++;
      }
      currentMonth = monthParsed;
      prevDay = 0; // reset day tracking for new month header
    }

    const dayVal = row2[c];
    if (dayVal == null || currentMonth === null) continue;

    const day = Number(dayVal);
    if (isNaN(day) || day < 1 || day > 31) continue;

    // Detect month rollover within same month header (day resets)
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

  return headers;
}

const DATA_START_COL = 6; // Column G (index 6) is where daily data begins

/**
 * Main parser: reads the solar PV project schedule Excel format
 * Layout: 3-row header (months, weeks, days), 3-column hierarchy (category, zone, task)
 */
export async function parseScheduleExcel(
  file: File,
  fallbackStartDate?: Date,
  referenceYear?: number
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

  // Build date headers from rows 0-2, starting at column G (index 6)
  const year = referenceYear ?? (fallbackStartDate?.getFullYear() ?? new Date().getFullYear());
  const dateHeaders = buildDateHeaders(rawData, DATA_START_COL, year);
  const dateColumnsFound = dateHeaders.length > 0;

  // Create a lookup map: colIndex -> Date
  const dateByCol = new Map<number, Date>();
  for (const dh of dateHeaders) {
    dateByCol.set(dh.colIndex, dh.date);
  }

  // Walk data rows (row index 3+)
  let currentCategory = 'General';
  let currentZone = 'Zone 1';
  let zoneIndex = 0;
  const zoneColorMap = new Map<string, string>();

  for (let r = 3; r < rawData.length; r++) {
    const row = rawData[r];
    if (!row) continue;

    // Forward-fill Category (Column A)
    const colA = row[0];
    if (colA != null && String(colA).trim() !== '') {
      currentCategory = String(colA).trim();
      categoriesSet.add(currentCategory);
    }

    // Forward-fill Zone (Column B)
    const colB = row[1];
    if (colB != null && String(colB).trim() !== '') {
      currentZone = String(colB).trim();
      zonesSet.add(currentZone);
      if (!zoneColorMap.has(currentZone)) {
        zoneColorMap.set(currentZone, getZoneColor(zoneIndex));
        zoneIndex++;
      }
    }

    // Task name (Column C) - skip if empty
    const colC = row[2];
    if (colC == null || String(colC).trim() === '') continue;
    const taskName = String(colC).trim();

    // Days Scheduled (Column D)
    const daysScheduled = Math.max(Number(row[3]) || 1, 1);

    // Progress % (Column F, index 5)
    let progress = 0;
    if (row[5] != null) {
      const rawProgress = Number(row[5]);
      if (!isNaN(rawProgress)) {
        progress = rawProgress > 1 ? Math.round(rawProgress) : Math.round(rawProgress * 100);
        progress = Math.max(0, Math.min(100, progress));
      }
    }

    // Find start date from daily columns
    let startDate: Date | null = null;
    if (dateColumnsFound) {
      for (let c = DATA_START_COL; c < row.length; c++) {
        if (row[c] != null && row[c] !== '' && row[c] !== 0) {
          const d = dateByCol.get(c);
          if (d) {
            startDate = d;
            break;
          }
        }
      }
    }

    if (!startDate) {
      startDate = fallbackStartDate || new Date();
    }

    const endDate = addDays(startDate, Math.max(daysScheduled - 1, 0));

    // Ensure zone color registered
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
