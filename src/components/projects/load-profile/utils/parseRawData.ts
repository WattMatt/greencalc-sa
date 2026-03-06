import { RawDataPoint } from "../types";
import { normaliseRawData, NormalisedDataPoint } from "@/components/loadprofiles/utils/normaliseRawData";

/**
 * Parse raw_data from scada_imports.
 * 
 * After normalisation migration, data is already in { date, time, value } format.
 * This function provides backward-compat: if data is already normalised it does
 * a direct cast; otherwise it falls back to the normaliser.
 */
export function parseRawData(rawData: unknown): RawDataPoint[] {
  if (!rawData) return [];

  if (Array.isArray(rawData) && rawData.length > 0) {
    const firstItem = rawData[0];

    // Fast path: already normalised { date, time, value }
    if (firstItem.date && firstItem.time && "value" in firstItem) {
      return rawData as RawDataPoint[];
    }
  }

  // Fallback: normalise legacy formats
  const normalised = normaliseRawData(rawData);
  return normalised.map(p => ({
    date: p.date,
    time: p.time,
    value: p.value,
    timestamp: `${p.date}T${p.time}`,
  }));
}
