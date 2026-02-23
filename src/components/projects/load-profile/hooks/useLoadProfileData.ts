import { useMemo } from "react";
import {
  Tenant,
  TenantMeter,
  ShopType,
  DAYS_OF_WEEK,
  DAY_MULTIPLIERS,
  DEFAULT_PROFILE_PERCENT,
  getTOUPeriod,
  ChartDataPoint,
  DisplayUnit,
  OverPanelingStats,
  PVStats,
} from "../types";
import { SolcastPVProfile } from "./useSolcastPVProfile";
import { ValidatedSiteData } from "./useValidatedSiteData";

// Correct profile for interval and ensure proper averaging
function correctProfileForInterval(
  profile: number[], 
  detectedIntervalMinutes?: number | null
): number[] {
  if (profile.length === 48) {
    const hourlyProfile: number[] = Array(24).fill(0);
    for (let h = 0; h < 24; h++) {
      const idx = h * 2;
      hourlyProfile[h] = (profile[idx] + profile[idx + 1]) / 2;
    }
    return hourlyProfile;
  } else if (profile.length === 96) {
    const hourlyProfile: number[] = Array(24).fill(0);
    for (let h = 0; h < 24; h++) {
      const idx = h * 4;
      hourlyProfile[h] = (profile[idx] + profile[idx + 1] + profile[idx + 2] + profile[idx + 3]) / 4;
    }
    return hourlyProfile;
  } else if (profile.length === 24) {
    if (detectedIntervalMinutes === 30) return profile.map(v => v / 2);
    if (detectedIntervalMinutes === 15) return profile.map(v => v / 4);
    return profile;
  } else {
    const hourlyProfile: number[] = Array(24).fill(0);
    const ratio = profile.length / 24;
    for (let h = 0; h < 24; h++) {
      const startIdx = Math.floor(h * ratio);
      const endIdx = Math.floor((h + 1) * ratio);
      let sum = 0, count = 0;
      for (let i = startIdx; i < endIdx; i++) { sum += profile[i]; count++; }
      hourlyProfile[h] = count > 0 ? sum / count : 0;
    }
    return hourlyProfile;
  }
}

// Calculate averaged kW profile from multiple meters
function getAveragedProfileKw(
  meters: TenantMeter[] | undefined,
  profileKey: 'load_profile_weekday' | 'load_profile_weekend'
): { profileKw: number[] | null; avgKwPerSqm: number[] | null } {
  if (!meters || meters.length === 0) return { profileKw: null, avgKwPerSqm: null };
  const validMeters = meters.filter(m => {
    const profile = m.scada_imports?.[profileKey];
    if (!profile || ![24, 48, 96].includes(profile.length)) return false;
    return (m.scada_imports?.area_sqm || 0) > 0;
  });
  if (validMeters.length === 0) return { profileKw: null, avgKwPerSqm: null };
  const totalWeight = validMeters.reduce((sum, m) => sum + (m.weight || 1), 0);
  const avgKwPerHour: number[] = Array(24).fill(0);
  const avgKwPerSqmPerHour: number[] = Array(24).fill(0);
  for (const meter of validMeters) {
    const rawProfile = meter.scada_imports![profileKey]!;
    const detectedInterval = meter.scada_imports?.detected_interval_minutes;
    const profile = correctProfileForInterval(rawProfile, detectedInterval);
    const meterWeight = (meter.weight || 1) / totalWeight;
    const meterArea = meter.scada_imports!.area_sqm!;
    for (let h = 0; h < 24; h++) {
      avgKwPerHour[h] += profile[h] * meterWeight;
      avgKwPerSqmPerHour[h] += (profile[h] / meterArea) * meterWeight;
    }
  }
  return { profileKw: avgKwPerHour, avgKwPerSqm: avgKwPerSqmPerHour };
}

const TEMP_COEFFICIENT = 0.004;

interface UseLoadProfileDataProps {
  tenants: Tenant[];
  shopTypes: ShopType[];
  selectedDays: Set<number>;
  displayUnit: DisplayUnit;
  powerFactor: number;
  showPVProfile: boolean;
  maxPvAcKva: number | null;
  dcCapacityKwp: number | null;
  dcAcRatio: number;
  showBattery: boolean;
  batteryCapacity: number;
  batteryPower: number;
  solcastProfile?: SolcastPVProfile;
  systemLosses?: number;
  diversityFactor?: number;
  /** Shared validated site data from useValidatedSiteData (optional for SimulationPanel) */
  validatedSiteData?: ValidatedSiteData;
}

export function useLoadProfileData({
  tenants,
  shopTypes,
  selectedDays,
  displayUnit,
  powerFactor,
  showPVProfile,
  maxPvAcKva,
  dcCapacityKwp,
  dcAcRatio,
  showBattery,
  batteryCapacity,
  batteryPower,
  solcastProfile,
  systemLosses = 0.14,
  diversityFactor = 1.0,
  validatedSiteData,
}: UseLoadProfileDataProps) {
  const includedTenants = useMemo(() => 
    tenants.filter(t => t.include_in_load_profile !== false),
    [tenants]
  );

  const daysArray = Array.from(selectedDays);
  const isWeekend = daysArray.every(d => d === 0 || d === 6);

  const pvNormalizedProfile = useMemo(() => {
    if (solcastProfile) {
      return solcastProfile.normalizedProfile;
    }
    return [0.0, 0.0, 0.0, 0.0, 0.0, 0.02, 0.08, 0.2, 0.38, 0.58, 0.78, 0.92, 1.0, 0.98, 0.9, 0.75, 0.55, 0.32, 0.12, 0.02, 0.0, 0.0, 0.0, 0.0];
  }, [solcastProfile]);

  const hourlyTemps = useMemo(() => {
    return solcastProfile?.hourlyTemp || Array(24).fill(25);
  }, [solcastProfile]);

  // Consume shared validated site data (with empty defaults for SimulationPanel usage)
  const emptyDefault: ValidatedSiteData = {
    siteDataByDate: new Map(),
    tenantDateMaps: new Map(),
    tenantKeyMap: new Map(),
    tenantsWithRawData: [],
    nonScadaTenants: includedTenants,
    validatedDateCount: 0,
    scadaCount: 0,
    estimatedCount: includedTenants.length,
    availableYears: [],
  };
  const {
    siteDataByDate,
    tenantDateMaps,
    tenantKeyMap,
    tenantsWithRawData,
    nonScadaTenants,
    validatedDateCount: totalValidatedDateCount,
    scadaCount: tenantsWithScada,
    estimatedCount: tenantsEstimated,
  } = validatedSiteData || emptyDefault;

  const {
    baseChartData,
    weekdayDailyKwh,
    weekendDailyKwh,
    validatedDateCount,
  } = useMemo(() => {
    // Filter siteDataByDate by selectedDays (day-of-week filter)
    function filterByDays(dayFilter: Set<number>): string[] {
      const result: string[] = [];
      siteDataByDate.forEach((_, dateKey) => {
        const parts = dateKey.split("-");
        if (parts.length !== 3) return;
        const jsDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        const jsDay = jsDate.getDay();
        if (dayFilter.has(jsDay)) result.push(dateKey);
      });
      return result;
    }

    const validatedDates = filterByDays(selectedDays);
    const validatedDateCount = validatedDates.length;

    // --- Fallback: compute hourly kW for non-SCADA tenants ---
    function getFallbackHourlyKw(tenant: Tenant): number[] | null {
      const tenantArea = Number(tenant.area_sqm) || 0;
      const allWeekend = daysArray.every(d => d === 0 || d === 6);
      const avgDayMultiplier = daysArray.reduce((sum, dayIndex) => {
        const dayOfWeek = DAYS_OF_WEEK[(dayIndex + 6) % 7];
        return sum + DAY_MULTIPLIERS[dayOfWeek];
      }, 0) / daysArray.length;

      // Priority 2: Multi-meter averaged profile
      if (tenantArea > 0) {
        const profileKey = allWeekend ? 'load_profile_weekend' : 'load_profile_weekday';
        const profileData = getAveragedProfileKw(tenant.tenant_meters, profileKey);
        const fallbackProfile = allWeekend && !profileData.avgKwPerSqm
          ? getAveragedProfileKw(tenant.tenant_meters, 'load_profile_weekday')
          : profileData;
        if (fallbackProfile.avgKwPerSqm) {
          return fallbackProfile.avgKwPerSqm.map(v => tenantArea * v * avgDayMultiplier);
        }
      }

      // Priority 3: Single SCADA pre-computed profile
      const scadaWeekdayRaw = tenant.scada_imports?.load_profile_weekday;
      const scadaWeekendRaw = tenant.scada_imports?.load_profile_weekend;
      const scadaProfileRaw = allWeekend ? scadaWeekendRaw || scadaWeekdayRaw : scadaWeekdayRaw;
      const detectedInterval = tenant.scada_imports?.detected_interval_minutes;

      if (scadaProfileRaw && [24, 48, 96].includes(scadaProfileRaw.length)) {
        const scadaProfile = correctProfileForInterval(scadaProfileRaw, detectedInterval);
        if (tenantArea > 0) {
          const scadaArea = tenant.scada_imports?.area_sqm || tenantArea;
          const areaScale = scadaArea > 0 ? tenantArea / scadaArea : 1;
          return scadaProfile.map(v => v * areaScale * avgDayMultiplier);
        }
        return scadaProfile.map(v => v * avgDayMultiplier);
      }

      // Priority 4: Shop type estimate
      if (tenantArea <= 0) return null;
      const shopType = tenant.shop_type_id ? shopTypes.find((st) => st.id === tenant.shop_type_id) : null;
      const monthlyKwh = tenant.monthly_kwh_override || (shopType?.kwh_per_sqm_month || 50) * tenantArea;
      const dailyKwh = monthlyKwh / 30;
      const shopTypeProfile = allWeekend
        ? shopType?.load_profile_weekend || shopType?.load_profile_weekday
        : shopType?.load_profile_weekday;
      const profile = shopTypeProfile?.length === 24 ? shopTypeProfile.map(Number) : DEFAULT_PROFILE_PERCENT;
      return profile.map(p => dailyKwh * (p / 100) * avgDayMultiplier);
    }

    // --- Build the 24-hour composite profile ---
    const hourlyData: { hour: string; total: number; [key: string]: number | string }[] = [];

    // Pre-compute fallback profiles for non-SCADA tenants
    const fallbackProfiles: { key: string; profile: number[] }[] = [];
    for (const tenant of nonScadaTenants) {
      const key = tenant.name.length > 15 ? tenant.name.slice(0, 15) + "…" : tenant.name;
      const profile = getFallbackHourlyKw(tenant);
      if (profile) fallbackProfiles.push({ key, profile });
    }

    for (let h = 0; h < 24; h++) {
      const hourLabel = `${h.toString().padStart(2, "0")}:00`;
      const hourData: { hour: string; total: number; [key: string]: number | string } = { hour: hourLabel, total: 0 };

      // Validated-date SCADA contributions (from shared siteDataByDate)
      if (validatedDates.length > 0) {
        // For per-tenant breakdown, use tenantDateMaps
        for (const tenantId of tenantsWithRawData) {
          const dateMap = tenantDateMaps.get(tenantId)!;
          const key = tenantKeyMap.get(tenantId) || tenantId;
          let sum = 0;
          for (const dateKey of validatedDates) {
            const tenantHourly = dateMap.get(dateKey);
            if (tenantHourly) sum += tenantHourly[h];
          }
          const avg = sum / validatedDates.length;
          hourData[key] = (hourData[key] as number || 0) + avg;
          hourData.total += avg;
        }
      }

      // Fallback tenant contributions
      for (const { key, profile } of fallbackProfiles) {
        hourData[key] = (hourData[key] as number || 0) + profile[h];
        hourData.total += profile[h];
      }

      hourlyData.push(hourData);
    }

    // --- Weekday/Weekend daily kWh ---
    const weekdaySet = new Set([1, 2, 3, 4, 5]);
    const weekendSet = new Set([0, 6]);
    const validatedWeekdays = filterByDays(weekdaySet);
    const validatedWeekends = filterByDays(weekendSet);

    let weekdayTotal = 0;
    let weekendTotal = 0;

    // SCADA contributions from validated dates (using siteDataByDate)
    if (validatedWeekdays.length > 0) {
      for (const dateKey of validatedWeekdays) {
        const siteHourly = siteDataByDate.get(dateKey)!;
        for (let h = 0; h < 24; h++) weekdayTotal += siteHourly[h];
      }
      weekdayTotal /= validatedWeekdays.length;
    }
    if (validatedWeekends.length > 0) {
      for (const dateKey of validatedWeekends) {
        const siteHourly = siteDataByDate.get(dateKey)!;
        for (let h = 0; h < 24; h++) weekendTotal += siteHourly[h];
      }
      weekendTotal /= validatedWeekends.length;
    }

    // Fallback tenant contributions for weekday/weekend
    for (const tenant of nonScadaTenants) {
      const tenantArea = Number(tenant.area_sqm) || 0;

      // Multi-meter
      if (tenantArea > 0) {
        const wdProfile = getAveragedProfileKw(tenant.tenant_meters, 'load_profile_weekday');
        const weProfile = getAveragedProfileKw(tenant.tenant_meters, 'load_profile_weekend');
        if (wdProfile.avgKwPerSqm) {
          weekdayTotal += wdProfile.avgKwPerSqm.reduce((s, v) => s + v, 0) * tenantArea;
          weekendTotal += (weProfile.avgKwPerSqm || wdProfile.avgKwPerSqm).reduce((s, v) => s + v, 0) * tenantArea;
          continue;
        }
      }

      // Single SCADA
      const scadaWeekdayRaw = tenant.scada_imports?.load_profile_weekday;
      const scadaWeekendRaw = tenant.scada_imports?.load_profile_weekend || scadaWeekdayRaw;
      const detectedInterval = tenant.scada_imports?.detected_interval_minutes;
      if (scadaWeekdayRaw && [24, 48, 96].includes(scadaWeekdayRaw.length)) {
        const scadaWeekday = correctProfileForInterval(scadaWeekdayRaw, detectedInterval);
        const dailyKwh = scadaWeekday.reduce((s, v) => s + v, 0);
        if (tenantArea > 0) {
          const scadaArea = tenant.scada_imports?.area_sqm || tenantArea;
          const kwhPerSqm = scadaArea > 0 ? dailyKwh / scadaArea : 0;
          weekdayTotal += tenantArea * kwhPerSqm;
        } else {
          weekdayTotal += dailyKwh;
        }
        if (scadaWeekendRaw && [24, 48, 96].includes(scadaWeekendRaw.length)) {
          const scadaWeekend = correctProfileForInterval(scadaWeekendRaw, detectedInterval);
          const weDailyKwh = scadaWeekend.reduce((s, v) => s + v, 0);
          if (tenantArea > 0) {
            const scadaArea = tenant.scada_imports?.area_sqm || tenantArea;
            weekendTotal += tenantArea * (scadaArea > 0 ? weDailyKwh / scadaArea : 0);
          } else {
            weekendTotal += weDailyKwh;
          }
        }
        continue;
      }

      // Shop type estimate
      if (tenantArea <= 0) continue;
      const shopType = tenant.shop_type_id ? shopTypes.find((st) => st.id === tenant.shop_type_id) : null;
      const monthlyKwh = tenant.monthly_kwh_override || (shopType?.kwh_per_sqm_month || 50) * tenantArea;
      const dailyKwh = monthlyKwh / 30;
      weekdayTotal += dailyKwh;
      weekendTotal += dailyKwh * 0.85;
    }

    return {
      baseChartData: hourlyData,
      weekdayDailyKwh: weekdayTotal,
      weekendDailyKwh: weekendTotal,
      validatedDateCount,
    };
  }, [siteDataByDate, tenantDateMaps, tenantKeyMap, tenantsWithRawData, nonScadaTenants, selectedDays, daysArray, shopTypes, includedTenants]);

  // Apply diversity factor and convert to kVA if needed
  const chartData = useMemo((): ChartDataPoint[] => {
    const baseData = baseChartData.map((hourData, index) => {
      const result: ChartDataPoint = { hour: hourData.hour, total: 0 };

      Object.keys(hourData).forEach((key) => {
        if (key === "hour") return;
        const kwValue = hourData[key] as number;
        const diversifiedKw = kwValue * diversityFactor;
        const value = displayUnit === "kw" ? diversifiedKw : diversifiedKw / powerFactor;
        result[key] = value;
        if (key === "total") result.total = value;
      });

      if (showPVProfile && maxPvAcKva && dcCapacityKwp) {
        const temp = hourlyTemps[index];
        const tempDerating = temp > 25 ? 1 - TEMP_COEFFICIENT * (temp - 25) : 1;
        const effectiveEfficiency = (1 - systemLosses) * tempDerating;
        const dcOutputRaw = pvNormalizedProfile[index] * dcCapacityKwp;
        const dcOutput = dcOutputRaw * effectiveEfficiency;
        const pvValue = Math.min(dcOutput, maxPvAcKva);

        result.pvGeneration = pvValue;
        result.pvDcOutput = dcOutput;
        result.pvClipping = dcOutput > maxPvAcKva ? dcOutput - maxPvAcKva : 0;

        const baseline1to1Raw = pvNormalizedProfile[index] * maxPvAcKva;
        const baseline1to1 = baseline1to1Raw * effectiveEfficiency;
        result.pv1to1Baseline = baseline1to1;
        result.temperature = temp;

        const netLoad = result.total - pvValue;
        result.netLoad = netLoad;
        result.gridImport = netLoad > 0 ? netLoad : 0;
        result.gridExport = netLoad < 0 ? Math.abs(netLoad) : 0;
      }

      return result;
    });

    // Battery simulation
    if (showBattery && showPVProfile && maxPvAcKva) {
      let soc = batteryCapacity * 0.2;
      const minSoC = batteryCapacity * 0.1;
      const maxSoC = batteryCapacity * 0.95;

      baseData.forEach((hourData, index) => {
        const period = getTOUPeriod(index, isWeekend);
        const excessPV = hourData.gridExport || 0;
        const gridNeed = hourData.gridImport || 0;
        let charge = 0,
          discharge = 0;

        if (excessPV > 0) {
          const availableCapacity = maxSoC - soc;
          charge = Math.min(batteryPower, excessPV, availableCapacity);
          soc += charge;
        } else if (gridNeed > 0 && (period === "peak" || period === "standard")) {
          const availableEnergy = soc - minSoC;
          discharge = Math.min(batteryPower, gridNeed, availableEnergy);
          soc -= discharge;
        }

        hourData.batteryCharge = charge;
        hourData.batteryDischarge = discharge;
        hourData.batterySoC = soc;
        hourData.gridImportWithBattery = Math.max(0, gridNeed - discharge);
      });
    }

    return baseData;
  }, [
    baseChartData,
    displayUnit,
    powerFactor,
    diversityFactor,
    showPVProfile,
    maxPvAcKva,
    dcCapacityKwp,
    showBattery,
    batteryCapacity,
    batteryPower,
    isWeekend,
    pvNormalizedProfile,
    hourlyTemps,
    systemLosses,
  ]);

  // Stats
  const totalDaily = chartData.reduce((sum, d) => sum + d.total, 0);
  const peakHour = chartData.reduce((max, d, i) => (d.total > max.val ? { val: d.total, hour: i } : max), { val: 0, hour: 0 });
  const avgHourly = totalDaily / 24;
  const loadFactor = peakHour.val > 0 ? (avgHourly / peakHour.val) * 100 : 0;

  // PV Stats
  const pvStats = useMemo((): PVStats | null => {
    if (!showPVProfile || !maxPvAcKva) return null;
    const totalGeneration = chartData.reduce((sum, d) => sum + (d.pvGeneration || 0), 0);
    const totalExport = chartData.reduce((sum, d) => sum + (d.gridExport || 0), 0);
    const selfConsumption = totalGeneration - totalExport;
    return {
      totalGeneration,
      selfConsumption,
      selfConsumptionRate: totalGeneration > 0 ? (selfConsumption / totalGeneration) * 100 : 0,
      solarCoverage: totalDaily > 0 ? (selfConsumption / totalDaily) * 100 : 0,
    };
  }, [chartData, showPVProfile, maxPvAcKva, totalDaily]);

  // Over-paneling stats
  const overPanelingStats = useMemo((): OverPanelingStats | null => {
    if (!showPVProfile || !maxPvAcKva || dcAcRatio <= 1) return null;

    const totalDcOutput = chartData.reduce((sum, d) => sum + (d.pvDcOutput || 0), 0);
    const totalAcOutput = chartData.reduce((sum, d) => sum + (d.pvGeneration || 0), 0);
    const totalClipping = chartData.reduce((sum, d) => sum + (d.pvClipping || 0), 0);
    const total1to1Baseline = chartData.reduce((sum, d) => sum + (d.pv1to1Baseline || 0), 0);

    const additionalKwh = totalAcOutput - total1to1Baseline;
    const percentGain = total1to1Baseline > 0 ? (additionalKwh / total1to1Baseline) * 100 : 0;
    const clippingPercent = totalDcOutput > 0 ? (totalClipping / totalDcOutput) * 100 : 0;

    const monthlyAdditionalKwh = additionalKwh * 30;
    const annualAdditionalKwh = additionalKwh * 365;
    const monthlyClipping = totalClipping * 30;
    const annualClipping = totalClipping * 365;
    const monthly1to1 = total1to1Baseline * 30;
    const annual1to1 = total1to1Baseline * 365;
    const monthlyWithOversizing = totalAcOutput * 30;
    const annualWithOversizing = totalAcOutput * 365;

    return {
      totalDcOutput,
      totalAcOutput,
      total1to1Baseline,
      additionalKwh,
      percentGain,
      totalClipping,
      clippingPercent,
      monthlyAdditionalKwh,
      monthlyClipping,
      monthly1to1,
      monthlyWithOversizing,
      annualAdditionalKwh,
      annualClipping,
      annual1to1,
      annualWithOversizing,
    };
  }, [chartData, showPVProfile, maxPvAcKva, dcAcRatio]);

  return {
    chartData,
    totalDaily,
    peakHour,
    avgHourly,
    loadFactor,
    pvStats,
    overPanelingStats,
    tenantsWithScada,
    tenantsEstimated,
    isWeekend,
    weekdayDailyKwh,
    weekendDailyKwh,
    validatedDateCount,
  };
}
