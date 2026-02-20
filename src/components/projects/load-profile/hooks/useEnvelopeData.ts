import { useState, useMemo } from "react";
import { Tenant, DisplayUnit, RawDataPoint } from "../types";

export interface EnvelopePoint {
  hour: string;
  min: number;
  max: number;
  avg: number;
}

// Parse raw_data which might be in different formats (same as useSpecificDateData)
// Month name lookup for "DD Mon YYYY HH:MM" format
const MONTH_MAP: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

function parseRawData(rawData: unknown): RawDataPoint[] {
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
        // "09 Nov 2022 12:00" -> parts = ["09", "Nov", "2022", "12:00"]
        if (parts.length >= 4) {
          const day = parts[0].padStart(2, "0");
          const month = MONTH_MAP[parts[1]] || "01";
          const year = parts[2];
          const time = parts[3] + ":00"; // "12:00" -> "12:00:00"
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

interface UseEnvelopeDataProps {
  tenants: Tenant[];
  displayUnit: DisplayUnit;
  powerFactor: number;
}

export function useEnvelopeData({ tenants, displayUnit, powerFactor }: UseEnvelopeDataProps) {
  // Extract available years from all tenants' raw data
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();

    tenants.forEach((tenant) => {
      const rawData = parseRawData(tenant.scada_imports?.raw_data);
      rawData.forEach((point) => {
        if (point.date) {
          const year = parseInt(point.date.split("-")[0], 10);
          if (!isNaN(year)) yearsSet.add(year);
        }
      });
    });

    return Array.from(yearsSet).sort((a, b) => a - b);
  }, [tenants]);

  const [yearFrom, setYearFrom] = useState<number | null>(null);
  const [yearTo, setYearTo] = useState<number | null>(null);

  // Derive effective year range (default to full range)
  const effectiveFrom = yearFrom ?? availableYears[0] ?? 2020;
  const effectiveTo = yearTo ?? availableYears[availableYears.length - 1] ?? 2030;

  const envelopeData = useMemo((): EnvelopePoint[] => {
    if (availableYears.length === 0) return [];

    // Step 1: For each unique date, sum all tenants' kW per hour to get combined load
    // dateKey -> hour -> { sum, count } (count for averaging sub-hourly readings per tenant)
    const dateHourlyTotals: Map<string, number[]> = new Map();

    tenants.forEach((tenant) => {
      const rawData = parseRawData(tenant.scada_imports?.raw_data);
      if (!rawData.length) return;

      const tenantArea = Number(tenant.area_sqm) || 0;
      const scadaArea = tenant.scada_imports?.area_sqm || tenantArea;
      const areaScaleFactor = scadaArea > 0 ? tenantArea / scadaArea : 1;

      // Group this tenant's data by date -> hour -> accumulate values
      const tenantDateHour: Map<string, Map<number, { sum: number; count: number }>> = new Map();

      rawData.forEach((point) => {
        if (!point.date) return;
        const year = parseInt(point.date.split("-")[0], 10);
        if (year < effectiveFrom || year > effectiveTo) return;

        const hour = parseInt(point.time?.split(":")[0] || "0", 10);
        if (hour < 0 || hour >= 24) return;

        const kwValue = (point.value || 0) * areaScaleFactor;

        if (!tenantDateHour.has(point.date)) {
          tenantDateHour.set(point.date, new Map());
        }
        const hourMap = tenantDateHour.get(point.date)!;
        if (!hourMap.has(hour)) {
          hourMap.set(hour, { sum: 0, count: 0 });
        }
        const entry = hourMap.get(hour)!;
        entry.sum += kwValue;
        entry.count += 1;
      });

      // Now add this tenant's average kW per hour to the combined daily totals
      tenantDateHour.forEach((hourMap, dateKey) => {
        if (!dateHourlyTotals.has(dateKey)) {
          dateHourlyTotals.set(dateKey, new Array(24).fill(0));
        }
        const dayArr = dateHourlyTotals.get(dateKey)!;

        hourMap.forEach((entry, hour) => {
          // Average sub-hourly readings (e.g. 2x 30-min readings -> average kW)
          const avgKw = entry.sum / entry.count;
          dayArr[hour] += avgKw;
        });
      });
    });

    if (dateHourlyTotals.size === 0) return [];

    // Step 2: For each hour, compute min/max/avg across all days
    const result: EnvelopePoint[] = [];

    for (let h = 0; h < 24; h++) {
      let min = Infinity;
      let max = -Infinity;
      let sum = 0;
      let count = 0;

      dateHourlyTotals.forEach((dayArr) => {
        const val = dayArr[h];
        // Skip values below 75 kW threshold (power-off / outage days skew the min)
        if (val < 75) return;
        if (val < min) min = val;
        if (val > max) max = val;
        sum += val;
        count += 1;
      });

      if (count === 0) {
        result.push({ hour: `${h.toString().padStart(2, "0")}:00`, min: 0, max: 0, avg: 0 });
        continue;
      }

      const unitMultiplier = displayUnit === "kw" ? 1 : 1 / powerFactor;

      result.push({
        hour: `${h.toString().padStart(2, "0")}:00`,
        min: min * unitMultiplier,
        max: max * unitMultiplier,
        avg: (sum / count) * unitMultiplier,
      });
    }

    return result;
  }, [tenants, availableYears, effectiveFrom, effectiveTo, displayUnit, powerFactor]);

  return {
    envelopeData,
    availableYears,
    yearFrom: effectiveFrom,
    yearTo: effectiveTo,
    setYearFrom,
    setYearTo,
  };
}
