import { useMemo } from "react";
import { DisplayUnit, ShopType, Tenant, DAYS_OF_WEEK, DAY_MULTIPLIERS, DEFAULT_PROFILE_PERCENT } from "../types";
import { ValidatedSiteData } from "./useValidatedSiteData";

const METER_COLORS = [
  "#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#3b82f6", "#84cc16",
  "#a855f7", "#06b6d4", "#d946ef", "#eab308", "#22d3ee",
  "#f43f5e", "#0ea5e9", "#65a30d", "#e11d48", "#7c3aed",
];

const ESTIMATED_COLOR = "#94a3b8"; // slate-400

export type StackedMode = "avg" | "max" | "min";

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
  mode: StackedMode;
  shopTypes: ShopType[];
}

// Reuse same profile correction from envelope hook
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

function getAveragedProfileKw(tenantMeters: any[] | undefined, profileKey: string): { avgKwPerSqm: number[] | null } {
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

export function useStackedMeterData({
  validatedSiteData,
  selectedDays,
  selectedMonths,
  displayUnit,
  powerFactor,
  diversityFactor,
  yearFrom,
  yearTo,
  mode,
  shopTypes,
}: UseStackedMeterDataProps): StackedMeterResult {
  return useMemo(() => {
    const { tenantDateMaps, tenantKeyMap, tenantsWithRawData, siteDataByDate, nonScadaTenants } = validatedSiteData;

    if (tenantsWithRawData.length === 0) {
      return { data: [], tenantKeys: [] };
    }

    const unitMultiplier = displayUnit === "kw" ? 1 : 1 / powerFactor;
    const daysArray = Array.from(selectedDays);
    const allWeekend = daysArray.every(d => d === 0 || d === 6);

    // Filter dates matching year/month/day criteria
    const filteredDateKeys: string[] = [];
    siteDataByDate.forEach((_, dateKey) => {
      const [yearStr, monthStr, dayStr] = dateKey.split("-");
      const year = parseInt(yearStr, 10);
      if (year < yearFrom || year > yearTo) return;
      const monthIndex = parseInt(monthStr, 10) - 1;
      if (!selectedMonths.has(monthIndex)) return;
      const jsDate = new Date(year, monthIndex, parseInt(dayStr, 10));
      if (!selectedDays.has(jsDate.getDay())) return;
      filteredDateKeys.push(dateKey);
    });

    if (filteredDateKeys.length === 0) {
      return { data: [], tenantKeys: [] };
    }

    // Compute fallback hourly total for non-SCADA tenants (same as envelope hook)
    const avgDayMultiplier = daysArray.reduce((sum, dayIndex) => {
      const dayOfWeek = DAYS_OF_WEEK[(dayIndex + 6) % 7];
      return sum + DAY_MULTIPLIERS[dayOfWeek];
    }, 0) / daysArray.length;

    const fallbackHourly = Array(24).fill(0);
    let hasFallback = false;

    for (const tenant of nonScadaTenants) {
      const tenantArea = Number(tenant.area_sqm) || 0;
      let profile: number[] | null = null;

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
        hasFallback = true;
        for (let h = 0; h < 24; h++) fallbackHourly[h] += profile[h];
      }
    }

    // Build tenant profiles based on mode
    const tenantProfiles = new Map<string, number[]>();

    if (mode === "avg") {
      // Per-tenant average across filtered days
      for (const tenantId of tenantsWithRawData) {
        const dateMap = tenantDateMaps.get(tenantId);
        if (!dateMap) continue;
        const sumHourly = Array(24).fill(0);
        let dayCount = 0;
        for (const dateKey of filteredDateKeys) {
          const hourlyArr = dateMap.get(dateKey);
          if (!hourlyArr) continue;
          dayCount++;
          for (let h = 0; h < 24; h++) {
            sumHourly[h] += hourlyArr[h] * diversityFactor * unitMultiplier;
          }
        }
        if (dayCount > 0) {
          tenantProfiles.set(tenantId, sumHourly.map(v => v / dayCount));
        }
      }
    } else {
      // max or min: find the single day with the highest/lowest total site demand
      let bestDateKey: string | null = null;
      let bestTotal = mode === "max" ? -Infinity : Infinity;

      for (const dateKey of filteredDateKeys) {
        const siteHourly = siteDataByDate.get(dateKey);
        if (!siteHourly) continue;
        let dayTotal = 0;
        for (let h = 0; h < 24; h++) {
          dayTotal += (siteHourly[h] + fallbackHourly[h]) * diversityFactor;
        }
        if (mode === "max" ? dayTotal > bestTotal : dayTotal < bestTotal) {
          bestTotal = dayTotal;
          bestDateKey = dateKey;
        }
      }

      // Use that single day's data for all tenants
      if (bestDateKey) {
        for (const tenantId of tenantsWithRawData) {
          const dateMap = tenantDateMaps.get(tenantId);
          const hourlyArr = dateMap?.get(bestDateKey);
          const profile = Array(24).fill(0);
          for (let h = 0; h < 24; h++) {
            profile[h] = (hourlyArr?.[h] ?? 0) * diversityFactor * unitMultiplier;
          }
          tenantProfiles.set(tenantId, profile);
        }
      }
    }

    // Build tenant keys with colours
    const tenantKeys = tenantsWithRawData
      .filter(id => tenantProfiles.has(id))
      .map((id, i) => ({
        id,
        label: tenantKeyMap.get(id) || id.slice(0, 8),
        color: METER_COLORS[i % METER_COLORS.length],
      }));

    // Add fallback "Estimated" entry if there are non-SCADA tenants
    const estimatedId = "__estimated__";
    if (hasFallback) {
      tenantKeys.push({
        id: estimatedId,
        label: "Estimated",
        color: ESTIMATED_COLOR,
      });
    }

    // Build chart data
    const data: StackedMeterPoint[] = [];
    for (let h = 0; h < 24; h++) {
      const point: StackedMeterPoint = {
        hour: `${h.toString().padStart(2, "0")}:00`,
      };
      for (const tk of tenantKeys) {
        if (tk.id === estimatedId) {
          point[tk.id] = fallbackHourly[h] * diversityFactor * unitMultiplier;
        } else {
          const profile = tenantProfiles.get(tk.id);
          point[tk.id] = profile ? profile[h] : 0;
        }
      }
      data.push(point);
    }

    return { data, tenantKeys };
  }, [validatedSiteData, selectedDays, selectedMonths, displayUnit, powerFactor, diversityFactor, yearFrom, yearTo, mode, shopTypes]);
}
