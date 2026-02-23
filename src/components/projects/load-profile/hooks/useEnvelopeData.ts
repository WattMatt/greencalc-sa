import { useState, useMemo } from "react";
import { DisplayUnit } from "../types";
import { ValidatedSiteData } from "./useValidatedSiteData";

export interface EnvelopePoint {
  hour: string;
  min: number;
  max: number;
  avg: number;
}

interface UseEnvelopeDataProps {
  displayUnit: DisplayUnit;
  powerFactor: number;
  /** Shared validated site data from useValidatedSiteData */
  validatedSiteData: ValidatedSiteData;
  /** Day-of-week filter to match load profile (JS day: 0=Sun … 6=Sat) */
  selectedDays: Set<number>;
  /** Month filter (0=Jan … 11=Dec) */
  selectedMonths?: Set<number>;
}

export function useEnvelopeData({ displayUnit, powerFactor, validatedSiteData, selectedDays, selectedMonths }: UseEnvelopeDataProps) {
  const { siteDataByDate, availableYears } = validatedSiteData;

  const [yearFrom, setYearFrom] = useState<number | null>(null);
  const [yearTo, setYearTo] = useState<number | null>(null);

  const effectiveFrom = yearFrom ?? availableYears[0] ?? 2020;
  const effectiveTo = yearTo ?? availableYears[availableYears.length - 1] ?? 2030;

  const envelopeData = useMemo(() => {
    if (siteDataByDate.size === 0) return [];

    const filteredEntries: number[][] = [];

    siteDataByDate.forEach((hourlyArr, dateKey) => {
      const [yearStr, monthStr, dayStr] = dateKey.split("-");
      const year = parseInt(yearStr, 10);
      if (year < effectiveFrom || year > effectiveTo) return;

      // Month filter (0-indexed: 0=Jan … 11=Dec)
      const monthIndex = parseInt(monthStr, 10) - 1;
      if (selectedMonths && !selectedMonths.has(monthIndex)) return;

      // Day-of-week filter to match load profile
      const jsDate = new Date(year, monthIndex, parseInt(dayStr, 10));
      if (!selectedDays.has(jsDate.getDay())) return;

      filteredEntries.push(hourlyArr);
    });

    if (filteredEntries.length === 0) return [];

    const result: EnvelopePoint[] = [];
    const unitMultiplier = displayUnit === "kw" ? 1 : 1 / powerFactor;

    for (let h = 0; h < 24; h++) {
      let min = Infinity;
      let max = -Infinity;
      let sum = 0;
      let count = 0;

      for (const dayArr of filteredEntries) {
        const val = dayArr[h];
        if (val < min) min = val;
        if (val > max) max = val;
        sum += val;
        count += 1;
      }

      if (count === 0) {
        result.push({ hour: `${h.toString().padStart(2, "0")}:00`, min: 0, max: 0, avg: 0 });
        continue;
      }

      result.push({
        hour: `${h.toString().padStart(2, "0")}:00`,
        min: min * unitMultiplier,
        max: max * unitMultiplier,
        avg: (sum / count) * unitMultiplier,
      });
    }

    return result;
  }, [siteDataByDate, effectiveFrom, effectiveTo, displayUnit, powerFactor, selectedDays, selectedMonths]);

  return {
    envelopeData,
    isComputing: false,
    availableYears,
    yearFrom: effectiveFrom,
    yearTo: effectiveTo,
    setYearFrom,
    setYearTo,
  };
}
