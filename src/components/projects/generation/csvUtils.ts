/**
 * Parses one or more CSV files and sums kWh values per month across all files.
 * Supports two formats:
 *   1. PnP SCADA: Row 1 = metadata with "pnpscada.com", Row 2 = headers, Row 3+ = data (kW readings)
 *   2. Simple: Row 1 = headers with "month" + kWh column
 *
 * @param files - FileList from an <input type="file" multiple> element
 * @param valueColumnPattern - regex to identify the kWh/value column header
 * @returns Map<month (1-12), total kWh summed across all files>
 */
export async function parseCSVFiles(
  files: FileList,
  valueColumnPattern: RegExp
): Promise<Map<number, number>> {
  const totals = new Map<number, number>();

  for (let f = 0; f < files.length; f++) {
    const text = await files[f].text();
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length < 2) continue;

    const firstLine = lines[0].toLowerCase();
    const isScada = firstLine.includes("pnpscada");

    if (isScada) {
      parseScadaFormat(lines, valueColumnPattern, totals);
    } else {
      parseSimpleFormat(lines, valueColumnPattern, totals);
    }
  }

  return totals;
}

function parseScadaFormat(
  lines: string[],
  valueColumnPattern: RegExp,
  totals: Map<number, number>
) {
  if (lines.length < 3) return;

  const headers = lines[1].split(",").map((h) => h.trim().toLowerCase());
  const dateCol = headers.findIndex((h) => /^date$/i.test(h));
  const timeCol = headers.findIndex((h) => /^time$/i.test(h));
  let valueCol = headers.findIndex((h) => valueColumnPattern.test(h));
  if (valueCol === -1) {
    valueCol = headers.findIndex((h) => /p\s*\(per\s*kw\)/i.test(h) || /^p\s*\(kw\)$/i.test(h));
  }

  if (dateCol === -1 || valueCol === -1) return;

  // Detect interval from first two data rows
  let intervalHours = 0.5; // default 30-min
  if (timeCol !== -1 && lines.length >= 4) {
    const time1 = lines[2].split(",")[timeCol]?.trim();
    const time2 = lines[3].split(",")[timeCol]?.trim();
    if (time1 && time2) {
      const mins = timeDiffMinutes(time1, time2);
      if (mins > 0) intervalHours = mins / 60;
    }
  }

  for (let i = 2; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const dateStr = cols[dateCol]?.trim();
    const kwVal = parseFloat(cols[valueCol]?.trim());

    if (!dateStr || isNaN(kwVal)) continue;

    const month = extractMonth(dateStr);
    if (month < 1 || month > 12) continue;

    const kwh = kwVal * intervalHours;
    totals.set(month, (totals.get(month) ?? 0) + kwh);
  }
}

function parseSimpleFormat(
  lines: string[],
  valueColumnPattern: RegExp,
  totals: Map<number, number>
) {
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const monthCol = headers.findIndex((h) => /month/i.test(h));
  const valueCol = headers.findIndex((h) => valueColumnPattern.test(h));

  if (monthCol === -1 || valueCol === -1) return;

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const monthVal = parseInt(cols[monthCol]?.trim());
    const kwhVal = parseFloat(cols[valueCol]?.trim());
    if (monthVal >= 1 && monthVal <= 12 && !isNaN(kwhVal)) {
      totals.set(monthVal, (totals.get(monthVal) ?? 0) + kwhVal);
    }
  }
}

/** Extract month (1-12) from a date string like "2026-01-15" or "15/01/2026" */
function extractMonth(dateStr: string): number {
  // Try YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = dateStr.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) return parseInt(isoMatch[2]);

  // Try DD-MM-YYYY or DD/MM/YYYY
  const ddmmMatch = dateStr.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (ddmmMatch) return parseInt(ddmmMatch[2]);

  return 0;
}

/** Calculate minutes between two time strings like "00:00" and "00:30" */
function timeDiffMinutes(t1: string, t2: string): number {
  const [h1, m1] = t1.split(":").map(Number);
  const [h2, m2] = t2.split(":").map(Number);
  if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return 0;
  return (h2 * 60 + m2) - (h1 * 60 + m1);
}
