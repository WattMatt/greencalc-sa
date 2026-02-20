import { useMemo } from "react";
import {
  Tenant,
  TenantMeter,
  ShopType,
  DayOfWeek,
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
// For 30-min intervals (48 values), average each pair to get 24 hourly values
// For 15-min intervals (96 values), average each group of 4 to get 24 hourly values
// IMPORTANT: If profile has 24 values but detected_interval is 30, the values were
// incorrectly summed during import and need to be halved to get proper averages
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
    if (detectedIntervalMinutes === 30) {
      return profile.map(v => v / 2);
    }
    if (detectedIntervalMinutes === 15) {
      return profile.map(v => v / 4);
    }
    return profile;
  } else {
    const hourlyProfile: number[] = Array(24).fill(0);
    const ratio = profile.length / 24;
    for (let h = 0; h < 24; h++) {
      const startIdx = Math.floor(h * ratio);
      const endIdx = Math.floor((h + 1) * ratio);
      let sum = 0;
      let count = 0;
      for (let i = startIdx; i < endIdx; i++) {
        sum += profile[i];
        count++;
      }
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
    const area = m.scada_imports?.area_sqm || 0;
    return area > 0;
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
      const kwValue = profile[h];
      avgKwPerHour[h] += kwValue * meterWeight;
      avgKwPerSqmPerHour[h] += (kwValue / meterArea) * meterWeight;
    }
  }
  
  return { profileKw: avgKwPerHour, avgKwPerSqm: avgKwPerSqmPerHour };
}

// Minimum kW threshold to exclude outage/power-off data (same as envelope chart)
const OUTAGE_THRESHOLD_KW = 75;

// JS Date.getDay(): 0=Sunday, 1=Monday, ..., 6=Saturday
// Our DAY_MULTIPLIERS uses DayOfWeek names, DAYS_OF_WEEK is Mon-Sun
// Convert JS day index (0=Sun) to DayOfWeek
function jsDayToDayOfWeek(jsDay: number): DayOfWeek {
  // DAYS_OF_WEEK = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]
  // jsDay: 0=Sun,1=Mon,...,6=Sat
  return DAYS_OF_WEEK[(jsDay + 6) % 7];
}

/**
 * Compute hourly average kW from raw time-series data for a single tenant's SCADA import.
 * Filters by selected days of week, applies area scaling, averages sub-hourly readings,
 * and applies day multipliers per reading. Returns null if no valid data.
 */
function computeHourlyFromRawData(
  rawData: unknown,
  selectedDaysSet: Set<number>, // JS day indices (0=Sun through 6=Sat)
  tenantArea: number,
  scadaArea: number | null | undefined,
): number[] | null {
  const points = parseRawData(rawData);
  if (points.length === 0) return null;

  const areaScale = (scadaArea && scadaArea > 0 && tenantArea > 0)
    ? tenantArea / scadaArea
    : 1;

  // Group by date -> hour -> { sum, count }
  const dateHourMap: Map<string, Map<number, { sum: number; count: number }>> = new Map();

  for (const point of points) {
    if (!point.date || !point.time) continue;

    // Parse date to get day of week
    const dateParts = point.date.split("-");
    if (dateParts.length !== 3) continue;
    const jsDate = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
    const jsDay = jsDate.getDay(); // 0=Sun

    if (!selectedDaysSet.has(jsDay)) continue;

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

  if (dateHourMap.size === 0) return null;

  // For each date, compute the tenant's hourly kW (average sub-hourly), then apply day multiplier
  // Collect per-hour values across all matching dates
  const hourValues: number[][] = Array.from({ length: 24 }, () => []);

  dateHourMap.forEach((hourMap, dateKey) => {
    // Compute daily total to check against outage threshold
    let dailyTotal = 0;
    const hourlyKw: number[] = Array(24).fill(0);

    hourMap.forEach((entry, hour) => {
      const avgKw = entry.sum / entry.count;
      hourlyKw[hour] = avgKw;
      dailyTotal += avgKw;
    });

    // Skip outage days (same threshold as envelope chart)
    if (dailyTotal < OUTAGE_THRESHOLD_KW) return;

    // Get day multiplier for this date
    const dateParts = dateKey.split("-");
    const jsDate = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
    const dayOfWeek = jsDayToDayOfWeek(jsDate.getDay());
    const dayMultiplier = DAY_MULTIPLIERS[dayOfWeek];

    for (let h = 0; h < 24; h++) {
      if (hourlyKw[h] > 0 || hourMap.has(h)) {
        hourValues[h].push(hourlyKw[h] * dayMultiplier);
      }
    }
  });

  // Average across all valid dates for each hour
  const result: number[] = Array(24).fill(0);
  let hasAnyData = false;
  for (let h = 0; h < 24; h++) {
    if (hourValues[h].length > 0) {
      result[h] = hourValues[h].reduce((s, v) => s + v, 0) / hourValues[h].length;
      hasAnyData = true;
    }
  }

  return hasAnyData ? result : null;
}

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

  const { tenantsWithScada, tenantsEstimated } = useMemo(() => {
    let scadaCount = 0;
    let estimatedCount = 0;
    tenants.forEach((t) => {
      const hasValidProfile = (len?: number) => len && [24, 48, 96].includes(len);
      const hasMultiMeter = (t.tenant_meters?.length || 0) > 0 && 
        t.tenant_meters?.some(m => hasValidProfile(m.scada_imports?.load_profile_weekday?.length));
      const hasRawData = parseRawData(getRawData(t)).length > 0;
      if (hasRawData || hasMultiMeter || hasValidProfile(t.scada_imports?.load_profile_weekday?.length)) scadaCount++;
      else estimatedCount++;
    });
    return { tenantsWithScada: scadaCount, tenantsEstimated: estimatedCount };
  }, [tenants, rawDataMap]);

  // Calculate daily kWh totals for weekday and weekend (for monthly calculation)
  const { weekdayDailyKwh, weekendDailyKwh } = useMemo(() => {
    let weekdayTotal = 0;
    let weekendTotal = 0;
    
    tenants.forEach((tenant) => {
      const tenantArea = Number(tenant.area_sqm) || 0;

      // Try raw data first for weekday (Mon-Fri = 1,2,3,4,5)
      const tenantRawData = getRawData(tenant);
      const rawPoints = parseRawData(tenantRawData);
      if (rawPoints.length > 0) {
        const weekdaySet = new Set([1, 2, 3, 4, 5]);
        const weekendSet = new Set([0, 6]);
        const weekdayProfile = computeHourlyFromRawData(
          tenantRawData, weekdaySet, tenantArea, tenant.scada_imports?.area_sqm
        );
        const weekendProfile = computeHourlyFromRawData(
          tenantRawData, weekendSet, tenantArea, tenant.scada_imports?.area_sqm
        );
        if (weekdayProfile) {
          weekdayTotal += weekdayProfile.reduce((s, v) => s + v, 0);
        }
        if (weekendProfile) {
          weekendTotal += weekendProfile.reduce((s, v) => s + v, 0);
        } else if (weekdayProfile) {
          weekendTotal += weekdayProfile.reduce((s, v) => s + v, 0);
        }
        return;
      }
      
      // Multi-meter profiles
      if (tenantArea > 0) {
        const weekdayProfile = getAveragedProfileKw(tenant.tenant_meters, 'load_profile_weekday');
        const weekendProfile = getAveragedProfileKw(tenant.tenant_meters, 'load_profile_weekend');
        
        if (weekdayProfile.avgKwPerSqm) {
          const dailyKwhPerSqm = weekdayProfile.avgKwPerSqm.reduce((sum, kw) => sum + kw, 0);
          weekdayTotal += tenantArea * dailyKwhPerSqm;
          
          if (weekendProfile.avgKwPerSqm) {
            const weekendDailyKwhPerSqm = weekendProfile.avgKwPerSqm.reduce((sum, kw) => sum + kw, 0);
            weekendTotal += tenantArea * weekendDailyKwhPerSqm;
          } else {
            weekendTotal += tenantArea * dailyKwhPerSqm;
          }
          return;
        }
      }
      
      // Single SCADA profile fallback
      const scadaWeekdayRaw = tenant.scada_imports?.load_profile_weekday;
      const scadaWeekendRaw = tenant.scada_imports?.load_profile_weekend || scadaWeekdayRaw;
      const detectedInterval = tenant.scada_imports?.detected_interval_minutes;
      
      if (scadaWeekdayRaw && [24, 48, 96].includes(scadaWeekdayRaw.length)) {
        const scadaWeekday = correctProfileForInterval(scadaWeekdayRaw, detectedInterval);
        const dailyKwh = scadaWeekday.reduce((sum, v) => sum + v, 0);
        
        if (tenantArea > 0) {
          const scadaArea = tenant.scada_imports?.area_sqm || tenantArea;
          const kwhPerSqm = scadaArea > 0 ? dailyKwh / scadaArea : 0;
          weekdayTotal += tenantArea * kwhPerSqm;
        } else {
          weekdayTotal += dailyKwh;
        }
        
        if (scadaWeekendRaw && [24, 48, 96].includes(scadaWeekendRaw.length)) {
          const scadaWeekend = correctProfileForInterval(scadaWeekendRaw, detectedInterval);
          const weekendDailyKwh = scadaWeekend.reduce((sum, v) => sum + v, 0);
          
          if (tenantArea > 0) {
            const scadaArea = tenant.scada_imports?.area_sqm || tenantArea;
            const weekendKwhPerSqm = scadaArea > 0 ? weekendDailyKwh / scadaArea : 0;
            weekendTotal += tenantArea * weekendKwhPerSqm;
          } else {
            weekendTotal += weekendDailyKwh;
          }
        }
        return;
      }
      
      // Shop type estimate fallback
      if (tenantArea <= 0) return;
      const shopType = tenant.shop_type_id ? shopTypes.find((st) => st.id === tenant.shop_type_id) : null;
      const monthlyKwh = tenant.monthly_kwh_override || (shopType?.kwh_per_sqm_month || 50) * tenantArea;
      const dailyKwh = monthlyKwh / 30;
      weekdayTotal += dailyKwh;
      weekendTotal += dailyKwh * 0.85;
    });
    
    return { weekdayDailyKwh: weekdayTotal, weekendDailyKwh: weekendTotal };
  }, [tenants, shopTypes, rawDataMap]);

  // Calculate base kW data using raw time-series when available
  const baseChartData = useMemo(() => {
    const hourlyData: { hour: string; total: number; [key: string]: number | string }[] = [];

    for (let h = 0; h < 24; h++) {
      const hourLabel = `${h.toString().padStart(2, "0")}:00`;
      const hourData: { hour: string; total: number; [key: string]: number | string } = { hour: hourLabel, total: 0 };

      tenants.forEach((tenant) => {
        const tenantArea = Number(tenant.area_sqm) || 0;
        const key = tenant.name.length > 15 ? tenant.name.slice(0, 15) + "…" : tenant.name;

        let hourlyKw = 0;
        let handled = false;

        // Priority 1: Raw time-series data (same source as envelope chart)
        const tenantRawData = getRawData(tenant);
        const rawPoints = parseRawData(tenantRawData);
        if (rawPoints.length > 0) {
          // computeHourlyFromRawData handles day filtering, area scaling, day multipliers,
          // and outage threshold internally. We cache per-tenant to avoid recomputing per hour.
          // Since useMemo runs once, we use a closure-level cache.
          if (!(tenant as any).__rawHourlyCache) {
            (tenant as any).__rawHourlyCache = computeHourlyFromRawData(
              tenantRawData,
              selectedDays,
              tenantArea,
              tenant.scada_imports?.area_sqm,
            );
          }
          const cached = (tenant as any).__rawHourlyCache as number[] | null;
          if (cached) {
            hourlyKw = cached[h];
            handled = true;
          }
        }

        // Priority 2: Multi-meter averaged profile (requires area)
        if (!handled && tenantArea > 0) {
          // Determine if all selected days are weekend days
          const allWeekend = daysArray.every(d => d === 0 || d === 6);
          const profileKey = allWeekend ? 'load_profile_weekend' : 'load_profile_weekday';
          const profileData = getAveragedProfileKw(tenant.tenant_meters, profileKey);
          const fallbackProfile = allWeekend && !profileData.avgKwPerSqm
            ? getAveragedProfileKw(tenant.tenant_meters, 'load_profile_weekday')
            : profileData;

          if (fallbackProfile.avgKwPerSqm) {
            // Apply average day multiplier across selected days
            const avgDayMultiplier = daysArray.reduce((sum, dayIndex) => {
              const dayOfWeek = DAYS_OF_WEEK[(dayIndex + 6) % 7];
              return sum + DAY_MULTIPLIERS[dayOfWeek];
            }, 0) / daysArray.length;
            hourlyKw = tenantArea * fallbackProfile.avgKwPerSqm[h] * avgDayMultiplier;
            handled = true;
          }
        }

        // Priority 3: Single SCADA pre-computed profile fallback
        if (!handled) {
          const allWeekend = daysArray.every(d => d === 0 || d === 6);
          const scadaWeekdayRaw = tenant.scada_imports?.load_profile_weekday;
          const scadaWeekendRaw = tenant.scada_imports?.load_profile_weekend;
          const scadaProfileRaw = allWeekend ? scadaWeekendRaw || scadaWeekdayRaw : scadaWeekdayRaw;
          const detectedInterval = tenant.scada_imports?.detected_interval_minutes;

          if (scadaProfileRaw && [24, 48, 96].includes(scadaProfileRaw.length)) {
            const scadaProfile = correctProfileForInterval(scadaProfileRaw, detectedInterval);
            const avgDayMultiplier = daysArray.reduce((sum, dayIndex) => {
              const dayOfWeek = DAYS_OF_WEEK[(dayIndex + 6) % 7];
              return sum + DAY_MULTIPLIERS[dayOfWeek];
            }, 0) / daysArray.length;

            if (tenantArea > 0) {
              const scadaArea = tenant.scada_imports?.area_sqm || tenantArea;
              const areaScale = scadaArea > 0 ? tenantArea / scadaArea : 1;
              hourlyKw = scadaProfile[h] * areaScale * avgDayMultiplier;
            } else {
              hourlyKw = scadaProfile[h] * avgDayMultiplier;
            }
          } else if (tenantArea > 0) {
            // Priority 4: Shop type estimate fallback
            const shopType = tenant.shop_type_id ? shopTypes.find((st) => st.id === tenant.shop_type_id) : null;
            const monthlyKwh = tenant.monthly_kwh_override || (shopType?.kwh_per_sqm_month || 50) * tenantArea;
            const dailyKwh = monthlyKwh / 30;
            const shopTypeProfile = allWeekend
              ? shopType?.load_profile_weekend || shopType?.load_profile_weekday
              : shopType?.load_profile_weekday;
            const profile = shopTypeProfile?.length === 24 ? shopTypeProfile.map(Number) : DEFAULT_PROFILE_PERCENT;
            const avgDayMultiplier = daysArray.reduce((sum, dayIndex) => {
              const dayOfWeek = DAYS_OF_WEEK[(dayIndex + 6) % 7];
              return sum + DAY_MULTIPLIERS[dayOfWeek];
            }, 0) / daysArray.length;
            hourlyKw = dailyKwh * (profile[h] / 100) * avgDayMultiplier;
          }
        }

        hourData[key] = (hourData[key] as number || 0) + hourlyKw;
        hourData.total += hourlyKw;
      });

      hourlyData.push(hourData);
    }

    // Clean up the temporary cache we added to tenant objects
    tenants.forEach((tenant) => {
      delete (tenant as any).__rawHourlyCache;
    });

    return hourlyData;
  }, [tenants, shopTypes, daysArray, selectedDays, rawDataMap]);

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
  };
}
