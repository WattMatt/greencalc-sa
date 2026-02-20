import { useState, useMemo } from "react";
import { Tenant, DisplayUnit, RawDataPoint } from "../types";
import { parseRawData } from "../utils/parseRawData";

export interface EnvelopePoint {
  hour: string;
  min: number;
  max: number;
  avg: number;
}

interface UseEnvelopeDataProps {
  tenants: Tenant[];
  displayUnit: DisplayUnit;
  powerFactor: number;
  /** Map of scada_import_id -> raw_data, fetched on demand by useRawScadaData */
  rawDataMap?: Record<string, unknown>;
}

export function useEnvelopeData({ tenants, displayUnit, powerFactor, rawDataMap }: UseEnvelopeDataProps) {
  // Helper: get raw data for a tenant from on-demand map or inline field
  const getRawData = (tenant: Tenant): unknown =>
    (rawDataMap && tenant.scada_import_id ? rawDataMap[tenant.scada_import_id] : undefined)
    || tenant.scada_imports?.raw_data;
  // Extract available years from all tenants' raw data
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();

    tenants.forEach((tenant) => {
      const rawData = parseRawData(getRawData(tenant));
      rawData.forEach((point) => {
        if (point.date) {
          const year = parseInt(point.date.split("-")[0], 10);
          if (!isNaN(year)) yearsSet.add(year);
        }
      });
    });

    return Array.from(yearsSet).sort((a, b) => a - b);
  }, [tenants, rawDataMap]);

  const [yearFrom, setYearFrom] = useState<number | null>(null);
  const [yearTo, setYearTo] = useState<number | null>(null);

  const effectiveFrom = yearFrom ?? availableYears[0] ?? 2020;
  const effectiveTo = yearTo ?? availableYears[availableYears.length - 1] ?? 2030;

  const envelopeData = useMemo((): EnvelopePoint[] => {
    if (availableYears.length === 0) return [];

    const dateHourlyTotals: Map<string, number[]> = new Map();

    tenants.forEach((tenant) => {
      const rawData = parseRawData(getRawData(tenant));
      if (!rawData.length) return;

      const tenantArea = Number(tenant.area_sqm) || 0;
      const scadaArea = tenant.scada_imports?.area_sqm || tenantArea;
      const areaScaleFactor = scadaArea > 0 ? tenantArea / scadaArea : 1;

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

      tenantDateHour.forEach((hourMap, dateKey) => {
        if (!dateHourlyTotals.has(dateKey)) {
          dateHourlyTotals.set(dateKey, new Array(24).fill(0));
        }
        const dayArr = dateHourlyTotals.get(dateKey)!;

        hourMap.forEach((entry, hour) => {
          const avgKw = entry.sum / entry.count;
          dayArr[hour] += avgKw;
        });
      });
    });

    if (dateHourlyTotals.size === 0) return [];

    const result: EnvelopePoint[] = [];

    for (let h = 0; h < 24; h++) {
      let min = Infinity;
      let max = -Infinity;
      let sum = 0;
      let count = 0;

      dateHourlyTotals.forEach((dayArr) => {
        const val = dayArr[h];
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
  }, [tenants, availableYears, effectiveFrom, effectiveTo, displayUnit, powerFactor, rawDataMap]);

  return {
    envelopeData,
    availableYears,
    yearFrom: effectiveFrom,
    yearTo: effectiveTo,
    setYearFrom,
    setYearTo,
  };
}
