import { useMemo } from "react";
import { DisplayUnit } from "../types";
import { ValidatedSiteData } from "./useValidatedSiteData";

const METER_COLORS = [
  "#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#3b82f6", "#84cc16",
  "#a855f7", "#06b6d4", "#d946ef", "#eab308", "#22d3ee",
  "#f43f5e", "#0ea5e9", "#65a30d", "#e11d48", "#7c3aed",
];

export interface StackedMeterPoint {
  hour: string;
  [tenantId: string]: number | string;
}

export interface StackedMeterResult {
  data: StackedMeterPoint[];
  tenantKeys: { id: string; label: string; color: string }[];
}

interface UseStackedMeterDataProps {
  validatedSiteData: ValidatedSiteData;
  selectedDays: Set<number>;
  selectedMonths: Set<number>;
  displayUnit: DisplayUnit;
  powerFactor: number;
  diversityFactor: number;
  yearFrom: number;
  yearTo: number;
}

export function useStackedMeterData({
  validatedSiteData,
  selectedDays,
  selectedMonths,
  displayUnit,
  powerFactor,
  diversityFactor,
  yearFrom,
  yearTo,
}: UseStackedMeterDataProps): StackedMeterResult {
  return useMemo(() => {
    const { tenantDateMaps, tenantKeyMap, tenantsWithRawData } = validatedSiteData;

    if (tenantsWithRawData.length === 0) {
      return { data: [], tenantKeys: [] };
    }

    const unitMultiplier = displayUnit === "kw" ? 1 : 1 / powerFactor;

    // Build per-tenant max hourly profiles
    const tenantMaxProfiles = new Map<string, number[]>();

    for (const tenantId of tenantsWithRawData) {
      const dateMap = tenantDateMaps.get(tenantId);
      if (!dateMap) continue;

      const maxHourly = Array(24).fill(0);

      dateMap.forEach((hourlyArr, dateKey) => {
        const [yearStr, monthStr, dayStr] = dateKey.split("-");
        const year = parseInt(yearStr, 10);
        if (year < yearFrom || year > yearTo) return;

        const monthIndex = parseInt(monthStr, 10) - 1;
        if (!selectedMonths.has(monthIndex)) return;

        const jsDate = new Date(year, monthIndex, parseInt(dayStr, 10));
        if (!selectedDays.has(jsDate.getDay())) return;

        for (let h = 0; h < 24; h++) {
          const val = hourlyArr[h] * diversityFactor * unitMultiplier;
          if (val > maxHourly[h]) maxHourly[h] = val;
        }
      });

      tenantMaxProfiles.set(tenantId, maxHourly);
    }

    // Build tenant keys with colours
    const tenantKeys = tenantsWithRawData
      .filter(id => tenantMaxProfiles.has(id))
      .map((id, i) => ({
        id,
        label: tenantKeyMap.get(id) || id.slice(0, 8),
        color: METER_COLORS[i % METER_COLORS.length],
      }));

    // Build chart data
    const data: StackedMeterPoint[] = [];
    for (let h = 0; h < 24; h++) {
      const point: StackedMeterPoint = {
        hour: `${h.toString().padStart(2, "0")}:00`,
      };
      for (const tk of tenantKeys) {
        const profile = tenantMaxProfiles.get(tk.id)!;
        point[tk.id] = profile[h];
      }
      data.push(point);
    }

    return { data, tenantKeys };
  }, [validatedSiteData, selectedDays, selectedMonths, displayUnit, powerFactor, diversityFactor, yearFrom, yearTo]);
}
