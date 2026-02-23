import { useState, useMemo } from "react";
import { DisplayUnit, Tenant, ShopType, DAYS_OF_WEEK, DAY_MULTIPLIERS, DEFAULT_PROFILE_PERCENT } from "../types";
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
  validatedSiteData: ValidatedSiteData;
  selectedDays: Set<number>;
  selectedMonths?: Set<number>;
  /** Non-SCADA tenants + shopTypes needed to add fallback estimates (same as load profile) */
  shopTypes?: ShopType[];
  diversityFactor?: number;
}

// Correct profile for interval (same as useLoadProfileData)
function correctProfileForInterval(profile: number[], detectedIntervalMinutes?: number | null): number[] {
  if (profile.length === 48) {
    const hourly: number[] = Array(24).fill(0);
    for (let h = 0; h < 24; h++) { const idx = h * 2; hourly[h] = (profile[idx] + profile[idx + 1]) / 2; }
    return hourly;
  } else if (profile.length === 96) {
    const hourly: number[] = Array(24).fill(0);
    for (let h = 0; h < 24; h++) { const idx = h * 4; hourly[h] = (profile[idx] + profile[idx + 1] + profile[idx + 2] + profile[idx + 3]) / 4; }
    return hourly;
  } else if (profile.length === 24) {
    if (detectedIntervalMinutes === 30) return profile.map(v => v / 2);
    if (detectedIntervalMinutes === 15) return profile.map(v => v / 4);
    return profile;
  }
  return profile;
}

function getAveragedProfileKw(
  tenantMeters: any[] | undefined,
  profileKey: string
): { avgKwPerSqm: number[] | null } {
  if (!tenantMeters?.length) return { avgKwPerSqm: null };
  const validMeters = tenantMeters.filter(m => {
    const p = m.scada_imports?.[profileKey];
    return p && [24, 48, 96].includes(p.length);
  });
  if (validMeters.length === 0) return { avgKwPerSqm: null };

  const totalWeight = validMeters.reduce((s, m) => s + (m.weight || 1), 0);
  const result = Array(24).fill(0);
  for (const m of validMeters) {
    const raw = m.scada_imports[profileKey];
    const corrected = correctProfileForInterval(raw, m.scada_imports?.detected_interval_minutes);
    const area = m.scada_imports?.area_sqm || 1;
    const w = (m.weight || 1) / totalWeight;
    for (let h = 0; h < 24; h++) result[h] += (corrected[h] / area) * w;
  }
  return { avgKwPerSqm: result };
}

export function useEnvelopeData({
  displayUnit,
  powerFactor,
  validatedSiteData,
  selectedDays,
  selectedMonths,
  shopTypes = [],
  diversityFactor = 1.0,
}: UseEnvelopeDataProps) {
  const { siteDataByDate, nonScadaTenants, availableYears } = validatedSiteData;

  const [yearFrom, setYearFrom] = useState<number | null>(null);
  const [yearTo, setYearTo] = useState<number | null>(null);

  const effectiveFrom = yearFrom ?? availableYears[0] ?? 2020;
  const effectiveTo = yearTo ?? availableYears[availableYears.length - 1] ?? 2030;

  const daysArray = useMemo(() => Array.from(selectedDays), [selectedDays]);

  // Pre-compute constant fallback hourly kW for non-SCADA tenants (same logic as load profile)
  const fallbackHourlyTotal = useMemo(() => {
    const total = Array(24).fill(0);
    const allWeekend = daysArray.every(d => d === 0 || d === 6);
    const avgDayMultiplier = daysArray.reduce((sum, dayIndex) => {
      const dayOfWeek = DAYS_OF_WEEK[(dayIndex + 6) % 7];
      return sum + DAY_MULTIPLIERS[dayOfWeek];
    }, 0) / daysArray.length;

    for (const tenant of nonScadaTenants) {
      const tenantArea = Number(tenant.area_sqm) || 0;
      let profile: number[] | null = null;

      // Multi-meter averaged profile
      if (tenantArea > 0) {
        const profileKey = allWeekend ? 'load_profile_weekend' : 'load_profile_weekday';
        const profileData = getAveragedProfileKw(tenant.tenant_meters, profileKey);
        const fallbackProfile = allWeekend && !profileData.avgKwPerSqm
          ? getAveragedProfileKw(tenant.tenant_meters, 'load_profile_weekday')
          : profileData;
        if (fallbackProfile.avgKwPerSqm) {
          profile = fallbackProfile.avgKwPerSqm.map(v => tenantArea * v * avgDayMultiplier);
        }
      }

      // Single SCADA pre-computed profile
      if (!profile) {
        const scadaWeekdayRaw = tenant.scada_imports?.load_profile_weekday;
        const scadaWeekendRaw = tenant.scada_imports?.load_profile_weekend;
        const scadaProfileRaw = allWeekend ? scadaWeekendRaw || scadaWeekdayRaw : scadaWeekdayRaw;
        const detectedInterval = tenant.scada_imports?.detected_interval_minutes;
        if (scadaProfileRaw && [24, 48, 96].includes(scadaProfileRaw.length)) {
          const corrected = correctProfileForInterval(scadaProfileRaw, detectedInterval);
          if (tenantArea > 0) {
            const scadaArea = tenant.scada_imports?.area_sqm || tenantArea;
            const areaScale = scadaArea > 0 ? tenantArea / scadaArea : 1;
            profile = corrected.map(v => v * areaScale * avgDayMultiplier);
          } else {
            profile = corrected.map(v => v * avgDayMultiplier);
          }
        }
      }

      // Shop type estimate
      if (!profile && tenantArea > 0) {
        const shopType = tenant.shop_type_id ? shopTypes.find(st => st.id === tenant.shop_type_id) : null;
        const monthlyKwh = tenant.monthly_kwh_override || (shopType?.kwh_per_sqm_month || 50) * tenantArea;
        const dailyKwh = monthlyKwh / 30;
        const shopTypeProfile = allWeekend
          ? shopType?.load_profile_weekend || shopType?.load_profile_weekday
          : shopType?.load_profile_weekday;
        const pProfile = shopTypeProfile?.length === 24 ? shopTypeProfile.map(Number) : DEFAULT_PROFILE_PERCENT;
        profile = pProfile.map(p => dailyKwh * (p / 100) * avgDayMultiplier);
      }

      if (profile) {
        for (let h = 0; h < 24; h++) total[h] += profile[h];
      }
    }
    return total;
  }, [nonScadaTenants, daysArray, shopTypes]);

  const envelopeData = useMemo(() => {
    if (siteDataByDate.size === 0) return [];

    const filteredEntries: number[][] = [];

    siteDataByDate.forEach((hourlyArr, dateKey) => {
      const [yearStr, monthStr, dayStr] = dateKey.split("-");
      const year = parseInt(yearStr, 10);
      if (year < effectiveFrom || year > effectiveTo) return;

      const monthIndex = parseInt(monthStr, 10) - 1;
      if (selectedMonths && !selectedMonths.has(monthIndex)) return;

      const jsDate = new Date(year, monthIndex, parseInt(dayStr, 10));
      if (!selectedDays.has(jsDate.getDay())) return;

      filteredEntries.push(hourlyArr);
    });

    if (filteredEntries.length === 0) return [];

    const unitMultiplier = displayUnit === "kw" ? 1 : 1 / powerFactor;

    // Step 1: Compute daily totals and collect all day arrays with their totals
    const dayEntries: { arr: number[]; total: number }[] = [];
    const sumHourly = Array(24).fill(0);
    let count = 0;

    for (const dayArr of filteredEntries) {
      let dayTotal = 0;
      for (let h = 0; h < 24; h++) {
        const compositeVal = (dayArr[h] + fallbackHourlyTotal[h]) * diversityFactor;
        dayTotal += compositeVal;
        sumHourly[h] += compositeVal;
      }
      count++;
      dayEntries.push({ arr: dayArr, total: dayTotal });
    }

    if (count === 0) return [];

    // Step 2: Sort by daily total and pick 5th/95th percentile days
    dayEntries.sort((a, b) => a.total - b.total);
    const p5Index = Math.max(0, Math.floor(dayEntries.length * 0.01));
    const p95Index = Math.min(dayEntries.length - 1, Math.floor(dayEntries.length * 0.99));
    const minDayArr = dayEntries[p5Index].arr;
    const maxDayArr = dayEntries[p95Index].arr;

    // Step 3: Build result using percentile days for max/min, average across all days
    // Clamp max/min so they never cross the average line
    const result: EnvelopePoint[] = [];
    for (let h = 0; h < 24; h++) {
      const fallbackH = fallbackHourlyTotal[h];
      const rawMax = ((maxDayArr[h] + fallbackH) * diversityFactor) * unitMultiplier;
      const rawMin = ((minDayArr[h] + fallbackH) * diversityFactor) * unitMultiplier;
      const avgVal = (sumHourly[h] / count) * unitMultiplier;

      result.push({
        hour: `${h.toString().padStart(2, "0")}:00`,
        min: rawMin,
        max: rawMax,
        avg: avgVal,
      });
    }

    return result;
  }, [siteDataByDate, effectiveFrom, effectiveTo, displayUnit, powerFactor, selectedDays, selectedMonths, fallbackHourlyTotal, diversityFactor]);

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
