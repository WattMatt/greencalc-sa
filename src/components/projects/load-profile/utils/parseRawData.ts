import { RawDataPoint } from "../types";

// Month name lookup for "DD Mon YYYY HH:MM" format
export const MONTH_MAP: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

/**
 * Parse raw_data which might be in different formats.
 * Supports:
 * - { date, time, value } arrays
 * - { timestamp: "DD Mon YYYY HH:MM", value } arrays
 * - { csvContent: "..." } arrays (PnP SCADA format)
 */
export function parseRawData(rawData: unknown): RawDataPoint[] {
  if (!rawData) return [];

  if (Array.isArray(rawData) && rawData.length > 0) {
    const firstItem = rawData[0];

    // Format: { date, time, value }
    if (firstItem.date && firstItem.time && "value" in firstItem) {
      return rawData as RawDataPoint[];
    }

    // Format: { timestamp: "DD Mon YYYY HH:MM", value }
    if (firstItem.timestamp && "value" in firstItem && !firstItem.date) {
      return rawData.map((item: { timestamp: string; value: number }) => {
        const parts = item.timestamp.split(" ");
        if (parts.length >= 4) {
          const day = parts[0].padStart(2, "0");
          const month = MONTH_MAP[parts[1]] || "01";
          const year = parts[2];
          const time = parts[3] + ":00";
          const date = `${year}-${month}-${day}`;
          return { date, time, timestamp: `${date}T${time}`, value: item.value || 0 };
        }
        return { date: "", time: "", timestamp: "", value: 0 };
      }).filter((p) => p.date !== "");
    }

    // Format: { csvContent: "..." }
    if (firstItem.csvContent && typeof firstItem.csvContent === "string") {
      const parsed: RawDataPoint[] = [];
      const lines = firstItem.csvContent.split("\n");

      let headerIndex = -1;
      for (let i = 0; i < Math.min(10, lines.length); i++) {
        if (lines[i].toLowerCase().includes("rdate") || lines[i].toLowerCase().includes("date")) {
          headerIndex = i;
          break;
        }
      }

      if (headerIndex === -1) return [];

      for (let i = headerIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(",");
        if (parts.length >= 3) {
          const date = parts[0];
          const time = parts[1];
          const kwhValue = parseFloat(parts[2]) || 0;

          if (date && time && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
            parsed.push({ date, time, timestamp: `${date}T${time}`, value: kwhValue });
          }
        }
      }

      return parsed;
    }
  }

  return [];
}
