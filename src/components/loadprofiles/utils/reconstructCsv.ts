/**
 * Reconstruct a CSV string from parsed interval data stored in raw_data.
 * Handles formats: [{timestamp, value}], [{date, time, value}]
 * Returns null if the data cannot be reconstructed.
 */
export function reconstructCsvFromRawData(rawData: unknown): string | null {
  if (!rawData || !Array.isArray(rawData) || rawData.length === 0) return null;

  const first = rawData[0] as Record<string, unknown>;

  // Skip if it's the csvContent wrapper format
  if ("csvContent" in first) return null;

  // Format: [{timestamp, value}] or [{date, time, value}]
  if ("timestamp" in first && "value" in first) {
    const lines = ["timestamp,value"];
    for (const item of rawData as Array<{ timestamp: string; value: number }>) {
      if (item.timestamp) {
        lines.push(`${item.timestamp},${item.value ?? 0}`);
      }
    }
    return lines.length > 1 ? lines.join("\n") : null;
  }

  if ("date" in first && "time" in first && "value" in first) {
    const lines = ["date,time,value"];
    for (const item of rawData as Array<{ date: string; time: string; value: number }>) {
      if (item.date) {
        lines.push(`${item.date},${item.time || ""},${item.value ?? 0}`);
      }
    }
    return lines.length > 1 ? lines.join("\n") : null;
  }

  return null;
}
