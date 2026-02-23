import { useMemo } from "react";
import {
  Tenant,
  getTOUPeriod,
  ChartDataPoint,
  DisplayUnit,
  OverPanelingStats,
  PVStats,
} from "../types";
import { SolcastPVProfile } from "./useSolcastPVProfile";
import { parseRawData } from "../utils/parseRawData";


// Minimum kW threshold to exclude outage/power-off data (same as envelope chart)
const OUTAGE_THRESHOLD_KW = 75;

interface UseLoadProfileDataProps {
  tenants: Tenant[];
  shopTypes: unknown[];
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

    const scadaCount = tenantsWithRawData.length;
    const estimatedCount = includedTenants.length - scadaCount;

    // --- Pass 2: Find validated dates (all SCADA tenants have data) ---
    // Helper to get validated dates filtered by day-of-week set
    function getValidatedDates(dayFilter: Set<number>): string[] {
      if (tenantsWithRawData.length === 0) return [];

      // Start with dates from the first tenant
      const firstMap = tenantDateMaps.get(tenantsWithRawData[0])!;
      const candidateDates = Array.from(firstMap.keys());

      return candidateDates.filter((dateKey) => {
        // Check day-of-week filter
        const parts = dateKey.split("-");
        if (parts.length !== 3) return false;
        const jsDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        const jsDay = jsDate.getDay(); // 0=Sun
        if (!dayFilter.has(jsDay)) return false;

        // Check all other tenants have this date
        for (let i = 1; i < tenantsWithRawData.length; i++) {
          const otherMap = tenantDateMaps.get(tenantsWithRawData[i])!;
          if (!otherMap.has(dateKey)) return false;
        }
        return true;
      });
    }

    // Get validated dates for the user's selected days
    const validatedDates = getValidatedDates(selectedDays);
    const validatedDateCount = validatedDates.length;

    // --- Build the 24-hour composite profile from validated dates ---
    const hourlyData: { hour: string; total: number; [key: string]: number | string }[] = [];

    for (let h = 0; h < 24; h++) {
      const hourLabel = `${h.toString().padStart(2, "0")}:00`;
      const hourData: { hour: string; total: number; [key: string]: number | string } = { hour: hourLabel, total: 0 };

      if (validatedDates.length > 0) {
        // For each tenant, average their hourly value across validated dates
        for (const tenantId of tenantsWithRawData) {
          const dateMap = tenantDateMaps.get(tenantId)!;
          const key = tenantKeyMap.get(tenantId) || tenantId;

          let sum = 0;
          for (const dateKey of validatedDates) {
            const hourlyKw = dateMap.get(dateKey)!;
            sum += hourlyKw[h];
          }
          const avg = sum / validatedDates.length;

          hourData[key] = (hourData[key] as number || 0) + avg;
          hourData.total += avg;
        }
      }

      hourlyData.push(hourData);
    }

    // --- Weekday/Weekend daily kWh using validated dates ---
    const weekdaySet = new Set([1, 2, 3, 4, 5]);
    const weekendSet = new Set([0, 6]);
    const validatedWeekdays = getValidatedDates(weekdaySet);
    const validatedWeekends = getValidatedDates(weekendSet);

    let weekdayTotal = 0;
    let weekendTotal = 0;

    if (validatedWeekdays.length > 0) {
      for (let h = 0; h < 24; h++) {
        for (const tenantId of tenantsWithRawData) {
          const dateMap = tenantDateMaps.get(tenantId)!;
          let sum = 0;
          for (const dateKey of validatedWeekdays) {
            sum += dateMap.get(dateKey)![h];
          }
          weekdayTotal += sum / validatedWeekdays.length;
        }
      }
    }

    if (validatedWeekends.length > 0) {
      for (let h = 0; h < 24; h++) {
        for (const tenantId of tenantsWithRawData) {
          const dateMap = tenantDateMaps.get(tenantId)!;
          let sum = 0;
          for (const dateKey of validatedWeekends) {
            sum += dateMap.get(dateKey)![h];
          }
          weekendTotal += sum / validatedWeekends.length;
        }
      }
    }

    return {
      baseChartData: hourlyData,
      tenantsWithScada: scadaCount,
      tenantsEstimated: estimatedCount,
      weekdayDailyKwh: weekdayTotal,
      weekendDailyKwh: weekendTotal,
      validatedDateCount,
    };
  }, [includedTenants, daysArray, selectedDays, rawDataMap]);

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
