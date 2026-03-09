/**
 * Canonical normaliser for scada_imports.raw_data.
 * 
 * Accepts any of the 3 legacy formats and returns the standard
 * Array<{ date: string; time: string; value: number }>.
 * 
 * Call this BEFORE writing raw_data to the database so that
 * read-side consumers can typecast directly without re-parsing.
 */

const MONTH_MAP: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

export interface NormalisedDataPoint {
  date: string;  // YYYY-MM-DD
  time: string;  // HH:MM:SS
  value: number;
  [key: string]: string | number; // JSON compatibility
}

/**
 * Normalise any raw_data shape into the canonical format.
 */
export function normaliseRawData(rawData: unknown): NormalisedDataPoint[] {
  if (!rawData) return [];
  if (!Array.isArray(rawData) || rawData.length === 0) return [];

  const firstItem = rawData[0];

  // Format 1: Already normalised { date, time, value }
  if (firstItem.date && firstItem.time && "value" in firstItem && !firstItem.timestamp && !firstItem.csvContent) {
    // Validate and clean
    return rawData
      .filter((item: Record<string, unknown>) => item.date && item.time && typeof item.value === "number")
      .map((item: Record<string, unknown>) => ({
        date: String(item.date),
        time: String(item.time),
        value: Number(item.value) || 0,
      }));
  }

  // Format 2: Auto-process output { date, time, value, timestamp?, ... }
  // (has date+time but may also have timestamp and extra fields)
  if (firstItem.date && firstItem.time && "value" in firstItem) {
    return rawData
      .filter((item: Record<string, unknown>) => item.date && item.time)
      .map((item: Record<string, unknown>) => ({
        date: String(item.date),
        time: String(item.time),
        value: Number(item.value) || 0,
      }));
  }

  // Format 3: Wizard format { timestamp, value }
  if (firstItem.timestamp && "value" in firstItem && !firstItem.date) {
    const normaliseTime = (t: string) => (t.length === 5 ? t + ":00" : t);

    return rawData
      .map((item: Record<string, unknown>) => {
        const ts = String(item.timestamp || "").trim();
        const val = Number(item.value) || 0;

        // ISO-like: "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DDTHH:MM:SS"
        const isoMatch = ts.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2}(?::\d{2})?)/);
        if (isoMatch) {
          return { date: isoMatch[1], time: normaliseTime(isoMatch[2]), value: val };
        }

        // SA format: "DD/MM/YYYY HH:MM:SS" or "DD-MM-YYYY HH:MM:SS"
        const saMatch = ts.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s+(\d{2}:\d{2}(?::\d{2})?)$/);
        if (saMatch) {
          const date = `${saMatch[3]}-${saMatch[2].padStart(2, "0")}-${saMatch[1].padStart(2, "0")}`;
          return { date, time: normaliseTime(saMatch[4]), value: val };
        }

        // Legacy: "DD Mon YYYY HH:MM"
        const parts = ts.split(" ");
        if (parts.length >= 4) {
          const day = parts[0].padStart(2, "0");
          const month = MONTH_MAP[parts[1]] || "01";
          const year = parts[2];
          const time = parts[3].length === 5 ? parts[3] + ":00" : parts[3];
          return { date: `${year}-${month}-${day}`, time, value: val };
        }

        // Date-only: "YYYY-MM-DD" with no time component
        const dateOnlyMatch = ts.match(/^(\d{4}-\d{2}-\d{2})$/);
        if (dateOnlyMatch) {
          return { date: dateOnlyMatch[1], time: "00:00:00", value: val };
        }

        // Date-only SA: "DD/MM/YYYY" or "DD-MM-YYYY" with no time
        const saDateOnly = ts.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (saDateOnly) {
          const date = `${saDateOnly[3]}-${saDateOnly[2].padStart(2, "0")}-${saDateOnly[1].padStart(2, "0")}`;
          return { date, time: "00:00:00", value: val };
        }

        return null;
      })
      .filter((p): p is NormalisedDataPoint => p !== null && p.date !== "");
  }

  // Format 4: csvContent embedded { csvContent: "..." }
  if (firstItem.csvContent && typeof firstItem.csvContent === "string") {
    const parsed: NormalisedDataPoint[] = [];
    const lines = firstItem.csvContent.split("\n");

    let headerIndex = -1;
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const lower = lines[i].toLowerCase();
      if (lower.includes("rdate") || lower.includes("date") || lower.includes("time")) {
        headerIndex = i;
        break;
      }
    }
    if (headerIndex === -1) return [];

    const headers = lines[headerIndex].split(",").map((h: string) => h.trim().toLowerCase());
    const dateCol = headers.findIndex((h: string) => h.includes("date") || h === "rdate");
    const timeCol = headers.findIndex((h: string) => h.includes("time") || h === "rtime");
    const valCol = headers.findIndex((h: string) => h.includes("kwh") || h.includes("value") || h.includes("active") || h.includes("p1"));
    const valueIdx = valCol === -1 ? 2 : valCol;

    for (let i = headerIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(",");
      let date = parts[dateCol >= 0 ? dateCol : 0]?.trim();
      let time = timeCol >= 0 ? parts[timeCol]?.trim() : "";
      const value = parseFloat(parts[valueIdx]?.replace(/[^\d.-]/g, "") || "0") || 0;

      if (!date) continue;

      // If no separate time column, check if date cell contains combined datetime
      if (!time && date.includes(" ")) {
        const spaceIdx = date.indexOf(" ");
        time = date.substring(spaceIdx + 1).trim();
        date = date.substring(0, spaceIdx).trim();
      }

      // Already ISO: YYYY-MM-DD
      if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        parsed.push({ date, time: time || "00:00:00", value });
        continue;
      }

      // SA format: DD/MM/YYYY or DD-MM-YYYY
      const saMatch = date.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (saMatch) {
        const isoDate = `${saMatch[3]}-${saMatch[2].padStart(2, "0")}-${saMatch[1].padStart(2, "0")}`;
        parsed.push({ date: isoDate, time: time || "00:00:00", value });
        continue;
      }

      // YYYY/MM/DD
      const altIso = date.match(/^(\d{4})[\/](\d{1,2})[\/](\d{1,2})$/);
      if (altIso) {
        const isoDate = `${altIso[1]}-${altIso[2].padStart(2, "0")}-${altIso[3].padStart(2, "0")}`;
        parsed.push({ date: isoDate, time: time || "00:00:00", value });
      }
    }

    return parsed;
  }

  // Format 5: Summary-only objects (no interval data) - return empty
  // These are wizard metadata like { totalKwh, peakKw, ... }
  if (rawData.length === 1 && firstItem.totalKwh !== undefined && !firstItem.date && !firstItem.timestamp && !firstItem.csvContent) {
    return [];
  }

  return [];
}
