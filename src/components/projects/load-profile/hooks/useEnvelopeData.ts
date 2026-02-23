import { useState, useMemo, useEffect, useCallback } from "react";
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
}

export function useEnvelopeData({ displayUnit, powerFactor, validatedSiteData }: UseEnvelopeDataProps) {
  const { siteDataByDate, availableYears } = validatedSiteData;

  const [yearFrom, setYearFrom] = useState<number | null>(null);
  const [yearTo, setYearTo] = useState<number | null>(null);

  const effectiveFrom = yearFrom ?? availableYears[0] ?? 2020;
  const effectiveTo = yearTo ?? availableYears[availableYears.length - 1] ?? 2030;

  const [envelopeData, setEnvelopeData] = useState<EnvelopePoint[]>([]);
  const [isComputing, setIsComputing] = useState(false);

  // Stable computation function using shared siteDataByDate
  const computeEnvelope = useCallback(() => {
    if (siteDataByDate.size === 0) return [];

    // Filter siteDataByDate by year range
    const filteredEntries: number[][] = [];

    siteDataByDate.forEach((hourlyArr, dateKey) => {
      const year = parseInt(dateKey.split("-")[0], 10);
      if (year < effectiveFrom || year > effectiveTo) return;
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
        // Keep the 75 kW filter for individual hour values consistency
        if (val < 75) continue;
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
  }, [siteDataByDate, effectiveFrom, effectiveTo, displayUnit, powerFactor]);

  // Defer heavy computation to avoid blocking the main thread
  useEffect(() => {
    setIsComputing(true);
    const timeoutId = setTimeout(() => {
      const result = computeEnvelope();
      setEnvelopeData(result);
      setIsComputing(false);
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [computeEnvelope]);

  return {
    envelopeData,
    isComputing,
    availableYears,
    yearFrom: effectiveFrom,
    yearTo: effectiveTo,
    setYearFrom,
    setYearTo,
  };
}
