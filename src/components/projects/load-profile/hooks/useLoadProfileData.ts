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
import { parseRawData } from "../utils/parseRawData";

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

// Minimum kW threshold to exclude outage/power-off data (same as envelope chart)
const OUTAGE_THRESHOLD_KW = 75;

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
  /** Map of scada_import_id -> raw_data, fetched on demand by useRawScadaData */
  rawDataMap?: Record<string, unknown>;
}

const TEMP_COEFFICIENT = 0.004;

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
  rawDataMap,
}: UseLoadProfileDataProps) {
  // Filter out tenants excluded from load profile
  const includedTenants = useMemo(() => 
    tenants.filter(t => t.include_in_load_profile !== false),
    [tenants]
  );

  const daysArray = Array.from(selectedDays);
  const isWeekend = daysArray.every(d => d === 0 || d === 6);

  // Helper: get raw data for a tenant, preferring the on-demand rawDataMap over the (now empty) inline field
  const getRawData = (tenant: Tenant): unknown =>
    (rawDataMap && tenant.scada_import_id ? rawDataMap[tenant.scada_import_id] : undefined)
    || tenant.scada_imports?.raw_data;

  const pvNormalizedProfile = useMemo(() => {
    if (solcastProfile) {
      return solcastProfile.normalizedProfile;
    }
    return [0.0, 0.0, 0.0, 0.0, 0.0, 0.02, 0.08, 0.2, 0.38, 0.58, 0.78, 0.92, 1.0, 0.98, 0.9, 0.75, 0.55, 0.32, 0.12, 0.02, 0.0, 0.0, 0.0, 0.0];
  }, [solcastProfile]);

  const hourlyTemps = useMemo(() => {
    return solcastProfile?.hourlyTemp || Array(24).fill(25);
  }, [solcastProfile]);

  // === VALIDATED-DATE APPROACH ===
  // Pass 1: Build per-tenant, per-date hourly maps from raw SCADA data
  // Pass 2: Only use dates where ALL SCADA tenants have valid data

  const {
    baseChartData,
    tenantsWithScada,
    tenantsEstimated,
    weekdayDailyKwh,
    weekendDailyKwh,
    validatedDateCount,
  } = useMemo(() => {
    // --- Pass 1: Collect per-tenant, per-date hourly data ---
    // Structure: Map<tenantId, Map<dateKey, number[24]>>
    const tenantDateMaps = new Map<string, Map<string, number[]>>();
    const tenantsWithRawData: string[] = [];
    const tenantKeyMap = new Map<string, string>(); // tenantId -> display key

    for (const tenant of includedTenants) {
      const tenantArea = Number(tenant.area_sqm) || 0;
      const key = tenant.name.length > 15 ? tenant.name.slice(0, 15) + "…" : tenant.name;
      tenantKeyMap.set(tenant.id, key);

      const tenantRawData = getRawData(tenant);
      const points = parseRawData(tenantRawData);
      if (points.length === 0) continue;

      const areaScale =
        tenant.scada_imports?.area_sqm && tenant.scada_imports.area_sqm > 0 && tenantArea > 0
          ? tenantArea / tenant.scada_imports.area_sqm
          : 1;

      // Group by date -> hour -> { sum, count }
      const dateHourMap = new Map<string, Map<number, { sum: number; count: number }>>();

      for (const point of points) {
        if (!point.date || !point.time) continue;
        const hour = parseInt(point.time.split(":")[0] || "0", 10);
        if (hour < 0 || hour >= 24) continue;

        const kwValue = (point.value || 0) * areaScale;

        if (!dateHourMap.has(point.date)) {
          dateHourMap.set(point.date, new Map());
        }
        const hourMap = dateHourMap.get(point.date)!;
        if (!hourMap.has(hour)) {
          hourMap.set(hour, { sum: 0, count: 0 });
        }
        const entry = hourMap.get(hour)!;
        entry.sum += kwValue;
        entry.count += 1;
      }

      // Convert to per-date hourly kW arrays, filtering outage days
      const dateMap = new Map<string, number[]>();

      dateHourMap.forEach((hourMap, dateKey) => {
        const hourlyKw = Array(24).fill(0);
        let dailyTotal = 0;
        hourMap.forEach((entry, hour) => {
          const avgKw = entry.sum / entry.count;
          hourlyKw[hour] = avgKw;
          dailyTotal += avgKw;
        });

        // Skip outage days
        if (dailyTotal < OUTAGE_THRESHOLD_KW) return;

        dateMap.set(dateKey, hourlyKw);
      });

      if (dateMap.size > 0) {
        tenantDateMaps.set(tenant.id, dateMap);
        tenantsWithRawData.push(tenant.id);
      }
    }

    // Identify non-SCADA tenants for fallback handling
    const rawDataTenantIds = new Set(tenantsWithRawData);
    const nonScadaTenants = includedTenants.filter(t => !rawDataTenantIds.has(t.id));

    // Count tenants with any form of profile data vs pure estimates
    let scadaCount = tenantsWithRawData.length;
    let estimatedCount = 0;
    for (const t of nonScadaTenants) {
      const tenantArea = Number(t.area_sqm) || 0;
      const hasMultiMeter = (t.tenant_meters?.length || 0) > 0 &&
        t.tenant_meters?.some(m => {
          const len = m.scada_imports?.load_profile_weekday?.length;
          return len && [24, 48, 96].includes(len);
        });
      const hasSingleScada = t.scada_imports?.load_profile_weekday &&
        [24, 48, 96].includes(t.scada_imports.load_profile_weekday.length);
      if (hasMultiMeter || hasSingleScada) scadaCount++;
      else estimatedCount++;
    }

    // --- Pass 2: Find validated dates (all SCADA tenants have data) ---
    function getValidatedDates(dayFilter: Set<number>): string[] {
      if (tenantsWithRawData.length === 0) return [];
      const firstMap = tenantDateMaps.get(tenantsWithRawData[0])!;
      const candidateDates = Array.from(firstMap.keys());
      return candidateDates.filter((dateKey) => {
        const parts = dateKey.split("-");
        if (parts.length !== 3) return false;
        const jsDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        const jsDay = jsDate.getDay();
        if (!dayFilter.has(jsDay)) return false;
        for (let i = 1; i < tenantsWithRawData.length; i++) {
          const otherMap = tenantDateMaps.get(tenantsWithRawData[i])!;
          if (!otherMap.has(dateKey)) return false;
        }
        return true;
      });
    }

    const validatedDates = getValidatedDates(selectedDays);
    const validatedDateCount = validatedDates.length;

    // --- Fallback: compute hourly kW for non-SCADA tenants ---
    // Returns 24-hour profile in kW for a single tenant using fallback logic
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

      // Validated-date SCADA contributions
      if (validatedDates.length > 0) {
        for (const tenantId of tenantsWithRawData) {
          const dateMap = tenantDateMaps.get(tenantId)!;
          const key = tenantKeyMap.get(tenantId) || tenantId;
          let sum = 0;
          for (const dateKey of validatedDates) {
            sum += dateMap.get(dateKey)![h];
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
    const validatedWeekdays = getValidatedDates(weekdaySet);
    const validatedWeekends = getValidatedDates(weekendSet);

    let weekdayTotal = 0;
    let weekendTotal = 0;

    // SCADA contributions from validated dates
    if (validatedWeekdays.length > 0) {
      for (let h = 0; h < 24; h++) {
        for (const tenantId of tenantsWithRawData) {
          const dateMap = tenantDateMaps.get(tenantId)!;
          let sum = 0;
          for (const dateKey of validatedWeekdays) sum += dateMap.get(dateKey)![h];
          weekdayTotal += sum / validatedWeekdays.length;
        }
      }
    }
    if (validatedWeekends.length > 0) {
      for (let h = 0; h < 24; h++) {
        for (const tenantId of tenantsWithRawData) {
          const dateMap = tenantDateMaps.get(tenantId)!;
          let sum = 0;
          for (const dateKey of validatedWeekends) sum += dateMap.get(dateKey)![h];
          weekendTotal += sum / validatedWeekends.length;
        }
      }
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
      tenantsWithScada: scadaCount,
      tenantsEstimated: estimatedCount,
      weekdayDailyKwh: weekdayTotal,
      weekendDailyKwh: weekendTotal,
      validatedDateCount,
    };
  }, [includedTenants, shopTypes, daysArray, selectedDays, rawDataMap]);

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
