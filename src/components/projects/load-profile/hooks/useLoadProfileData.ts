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

// Correct profile for interval and ensure proper averaging
// For 30-min intervals (48 values), average each pair to get 24 hourly values
// For 15-min intervals (96 values), average each group of 4 to get 24 hourly values
// IMPORTANT: If profile has 24 values but detected_interval is 30, the values were
// incorrectly summed during import and need to be halved to get proper averages
function correctProfileForInterval(
  profile: number[], 
  detectedIntervalMinutes?: number | null
): number[] {
  // Handle sub-hourly profiles that need averaging
  if (profile.length === 48) {
    // 30-minute intervals - average each pair of readings
    const hourlyProfile: number[] = Array(24).fill(0);
    for (let h = 0; h < 24; h++) {
      const idx = h * 2;
      hourlyProfile[h] = (profile[idx] + profile[idx + 1]) / 2;
    }
    return hourlyProfile;
  } else if (profile.length === 96) {
    // 15-minute intervals - average each group of 4 readings
    const hourlyProfile: number[] = Array(24).fill(0);
    for (let h = 0; h < 24; h++) {
      const idx = h * 4;
      hourlyProfile[h] = (profile[idx] + profile[idx + 1] + profile[idx + 2] + profile[idx + 3]) / 4;
    }
    return hourlyProfile;
  } else if (profile.length === 24) {
    // Already hourly - but check if values were incorrectly summed for 30-min data
    // If detected_interval_minutes is 30, values are doubled and need halving
    if (detectedIntervalMinutes === 30) {
      return profile.map(v => v / 2);
    }
    // If detected_interval_minutes is 15, values are quadrupled and need quartering
    if (detectedIntervalMinutes === 15) {
      return profile.map(v => v / 4);
    }
    return profile;
  } else {
    // Unknown interval - try to proportionally map to 24 hours
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
// Returns average kW values per hour and kW per sqm intensity for scaling
// IMPORTANT: load_profile arrays store kW (power), not kWh (energy)
// Handles both 24-value (hourly) and 48-value (30-min) profiles by averaging to hourly
function getAveragedProfileKw(
  meters: TenantMeter[] | undefined,
  profileKey: 'load_profile_weekday' | 'load_profile_weekend'
): { profileKw: number[] | null; avgKwPerSqm: number[] | null } {
  if (!meters || meters.length === 0) return { profileKw: null, avgKwPerSqm: null };
  
  // Filter to valid meters with actual data (accept 24, 48, or 96 values)
  const validMeters = meters.filter(m => {
    const profile = m.scada_imports?.[profileKey];
    if (!profile || ![24, 48, 96].includes(profile.length)) return false;
    const area = m.scada_imports?.area_sqm || 0;
    return area > 0;
  });
  
  if (validMeters.length === 0) return { profileKw: null, avgKwPerSqm: null };
  
  // Calculate total weight from valid meters
  const totalWeight = validMeters.reduce((sum, m) => sum + (m.weight || 1), 0);
  
  // Weight-average the kW values directly per hour and calculate kW/m² intensity
  const avgKwPerHour: number[] = Array(24).fill(0);
  const avgKwPerSqmPerHour: number[] = Array(24).fill(0);
  
  for (const meter of validMeters) {
    const rawProfile = meter.scada_imports![profileKey]!;
    const detectedInterval = meter.scada_imports?.detected_interval_minutes;
    // Correct for interval - handles summed vs averaged issue
    const profile = correctProfileForInterval(rawProfile, detectedInterval);
    const meterWeight = (meter.weight || 1) / totalWeight;
    const meterArea = meter.scada_imports!.area_sqm!;
    
    // Accumulate weighted kW values per hour
    for (let h = 0; h < 24; h++) {
      const kwValue = profile[h];
      avgKwPerHour[h] += kwValue * meterWeight;
      avgKwPerSqmPerHour[h] += (kwValue / meterArea) * meterWeight;
    }
  }
  
  return { profileKw: avgKwPerHour, avgKwPerSqm: avgKwPerSqmPerHour };
}

interface UseLoadProfileDataProps {
  tenants: Tenant[];
  shopTypes: ShopType[];
  selectedDays: Set<number>; // 0=Sunday through 6=Saturday - multi-day selection
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
  systemLosses?: number; // 0-1, default 0.14 (14% losses)
  diversityFactor?: number; // 0-1, default 1.0 (no reduction)
}

// Temperature derating coefficient (%/°C above 25°C)
const TEMP_COEFFICIENT = 0.004; // 0.4% per degree

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
}: UseLoadProfileDataProps) {
  // Convert selectedDays (0=Sunday) to determine if current selection is weekend-only
  const daysArray = Array.from(selectedDays);
  const isWeekend = daysArray.every(d => d === 0 || d === 6);

  // Get the PV profile to use (Solcast or static)
  const pvNormalizedProfile = useMemo(() => {
    if (solcastProfile) {
      return solcastProfile.normalizedProfile;
    }
    // Default static profile
    return [0.0, 0.0, 0.0, 0.0, 0.0, 0.02, 0.08, 0.2, 0.38, 0.58, 0.78, 0.92, 1.0, 0.98, 0.9, 0.75, 0.55, 0.32, 0.12, 0.02, 0.0, 0.0, 0.0, 0.0];
  }, [solcastProfile]);

  // Get hourly temperatures for derating (if available)
  const hourlyTemps = useMemo(() => {
    return solcastProfile?.hourlyTemp || Array(24).fill(25);
  }, [solcastProfile]);

  // Count tenants with actual SCADA data (including multi-meter)
  const { tenantsWithScada, tenantsEstimated } = useMemo(() => {
    let scadaCount = 0;
    let estimatedCount = 0;
    tenants.forEach((t) => {
      const hasValidProfile = (len?: number) => len && [24, 48, 96].includes(len);
      const hasMultiMeter = (t.tenant_meters?.length || 0) > 0 && 
        t.tenant_meters?.some(m => hasValidProfile(m.scada_imports?.load_profile_weekday?.length));
      if (hasMultiMeter || hasValidProfile(t.scada_imports?.load_profile_weekday?.length)) scadaCount++;
      else estimatedCount++;
    });
    return { tenantsWithScada: scadaCount, tenantsEstimated: estimatedCount };
  }, [tenants]);

  // Calculate daily kWh totals for weekday and weekend (for monthly calculation)
  // IMPORTANT: load_profile arrays contain kW (power) per hour, so sum = daily kWh
  const { weekdayDailyKwh, weekendDailyKwh } = useMemo(() => {
    let weekdayTotal = 0;
    let weekendTotal = 0;
    
    tenants.forEach((tenant) => {
      const tenantArea = Number(tenant.area_sqm) || 0;
      if (tenantArea <= 0) return;
      
      // Multi-meter profiles - use kW/m² intensity per hour
      const weekdayProfile = getAveragedProfileKw(tenant.tenant_meters, 'load_profile_weekday');
      const weekendProfile = getAveragedProfileKw(tenant.tenant_meters, 'load_profile_weekend');
      
      if (weekdayProfile.avgKwPerSqm) {
        // Sum hourly kW/m² × tenant area = tenant's daily kWh
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
      
      // Single SCADA profile - values are kW per interval, correct for interval
      const scadaWeekdayRaw = tenant.scada_imports?.load_profile_weekday;
      const scadaWeekendRaw = tenant.scada_imports?.load_profile_weekend || scadaWeekdayRaw;
      const detectedInterval = tenant.scada_imports?.detected_interval_minutes;
      
      if (scadaWeekdayRaw && [24, 48, 96].includes(scadaWeekdayRaw.length)) {
        const scadaArea = tenant.scada_imports?.area_sqm || tenantArea;
        // Correct for interval first (handles summed vs averaged), then sum for daily kWh
        const scadaWeekday = correctProfileForInterval(scadaWeekdayRaw, detectedInterval);
        const dailyKwh = scadaWeekday.reduce((sum, v) => sum + v, 0);
        const kwhPerSqm = scadaArea > 0 ? dailyKwh / scadaArea : 0;
        weekdayTotal += tenantArea * kwhPerSqm;
        
        if (scadaWeekendRaw && [24, 48, 96].includes(scadaWeekendRaw.length)) {
          const scadaWeekend = correctProfileForInterval(scadaWeekendRaw, detectedInterval);
          const weekendDailyKwh = scadaWeekend.reduce((sum, v) => sum + v, 0);
          const weekendKwhPerSqm = scadaArea > 0 ? weekendDailyKwh / scadaArea : 0;
          weekendTotal += tenantArea * weekendKwhPerSqm;
        }
        return;
      }
      
      // Shop type estimate
      const shopType = tenant.shop_type_id ? shopTypes.find((st) => st.id === tenant.shop_type_id) : null;
      const monthlyKwh = tenant.monthly_kwh_override || (shopType?.kwh_per_sqm_month || 50) * tenantArea;
      const dailyKwh = monthlyKwh / 30;
      weekdayTotal += dailyKwh;
      weekendTotal += dailyKwh * 0.85; // Slightly lower on weekends for most shop types
    });
    
    return { weekdayDailyKwh: weekdayTotal, weekendDailyKwh: weekendTotal };
  }, [tenants, shopTypes]);

  // Calculate base kW data by averaging across all selected days
  // IMPORTANT: Chart displays kW (power), not kWh - values are direct power readings per hour
  const baseChartData = useMemo(() => {
    const hourlyData: { hour: string; total: number; [key: string]: number | string }[] = [];

    // For each hour, calculate the average across all selected days
    for (let h = 0; h < 24; h++) {
      const hourLabel = `${h.toString().padStart(2, "0")}:00`;
      const hourData: { hour: string; total: number; [key: string]: number | string } = { hour: hourLabel, total: 0 };

      // Accumulate values across all selected days, then average
      const dayValues: Map<string, number[]> = new Map();
      let totalValues: number[] = [];

      daysArray.forEach((dayIndex) => {
        // Convert day index (0=Sun) to DayOfWeek
        const dayOfWeek = DAYS_OF_WEEK[(dayIndex + 6) % 7]; // Shift: 0=Sun→6, 1=Mon→0, etc.
        const isWeekendDay = dayIndex === 0 || dayIndex === 6;
        const dayMultiplier = DAY_MULTIPLIERS[dayOfWeek];

        tenants.forEach((tenant) => {
          const tenantArea = Number(tenant.area_sqm) || 0;
          if (tenantArea <= 0) return;

          const key = tenant.name.length > 15 ? tenant.name.slice(0, 15) + "…" : tenant.name;

          // Check for multi-meter averaged profile first
          const profileKey = isWeekendDay ? 'load_profile_weekend' : 'load_profile_weekday';
          const profileData = getAveragedProfileKw(tenant.tenant_meters, profileKey);

          // Fallback to weekday if weekend not available
          const fallbackProfile = isWeekendDay && !profileData.avgKwPerSqm
            ? getAveragedProfileKw(tenant.tenant_meters, 'load_profile_weekday')
            : profileData;

          let hourlyKw = 0;

          if (fallbackProfile.avgKwPerSqm) {
            // Scale kW/m² by tenant area to get tenant's kW for this hour
            hourlyKw = tenantArea * fallbackProfile.avgKwPerSqm[h] * dayMultiplier;
          } else {
            // Fall back to single SCADA profile - values are kW per interval
            const scadaWeekdayRaw = tenant.scada_imports?.load_profile_weekday;
            const scadaWeekendRaw = tenant.scada_imports?.load_profile_weekend;
            const scadaProfileRaw = isWeekendDay ? scadaWeekendRaw || scadaWeekdayRaw : scadaWeekdayRaw;
            const detectedInterval = tenant.scada_imports?.detected_interval_minutes;

            if (scadaProfileRaw && [24, 48, 96].includes(scadaProfileRaw.length)) {
              const scadaArea = tenant.scada_imports?.area_sqm || tenantArea;
              // Correct for interval (handles summed vs averaged issue), then scale
              const scadaProfile = correctProfileForInterval(scadaProfileRaw, detectedInterval);
              // Scale kW by area ratio: tenant_kW = source_kW × (tenant_area / source_area)
              const areaScale = scadaArea > 0 ? tenantArea / scadaArea : 1;
              hourlyKw = scadaProfile[h] * areaScale * dayMultiplier;
            } else {
              // Shop type estimate - convert kWh to kW using profile shape
              const shopType = tenant.shop_type_id ? shopTypes.find((st) => st.id === tenant.shop_type_id) : null;
              const monthlyKwh = tenant.monthly_kwh_override || (shopType?.kwh_per_sqm_month || 50) * tenantArea;
              const dailyKwh = monthlyKwh / 30;
              const shopTypeProfile = isWeekendDay ? shopType?.load_profile_weekend || shopType?.load_profile_weekday : shopType?.load_profile_weekday;
              const profile = shopTypeProfile?.length === 24 ? shopTypeProfile.map(Number) : DEFAULT_PROFILE_PERCENT;
              // Profile is percentages, so hourlyKw = dailyKwh × (profile[h] / 100)
              hourlyKw = dailyKwh * (profile[h] / 100) * dayMultiplier;
            }
          }

          // Accumulate for averaging
          if (!dayValues.has(key)) dayValues.set(key, []);
          dayValues.get(key)!.push(hourlyKw);
          totalValues.push(hourlyKw);
        });
      });

      // Average across all selected days
      const numDays = daysArray.length;
      dayValues.forEach((values, key) => {
        const avgValue = values.reduce((sum, v) => sum + v, 0) / numDays;
        hourData[key] = avgValue;
      });
      hourData.total = totalValues.reduce((sum, v) => sum + v, 0) / numDays;

      hourlyData.push(hourData);
    }

    return hourlyData;
  }, [tenants, shopTypes, daysArray]);

  // Apply diversity factor and convert to kVA if needed
  // baseChartData contains kW values - apply diversity and optional kW→kVA conversion
  const chartData = useMemo((): ChartDataPoint[] => {
    const baseData = baseChartData.map((hourData, index) => {
      const result: ChartDataPoint = { hour: hourData.hour, total: 0 };

      Object.keys(hourData).forEach((key) => {
        if (key === "hour") return;
        const kwValue = hourData[key] as number;
        // Apply diversity factor to reduce combined load
        const diversifiedKw = kwValue * diversityFactor;
        // Convert kW to kVA if display unit is kVA (divide by power factor)
        const value = displayUnit === "kw" ? diversifiedKw : diversifiedKw / powerFactor;
        result[key] = value;
        if (key === "total") result.total = value;
      });

      if (showPVProfile && maxPvAcKva && dcCapacityKwp) {
        // Calculate temperature derating
        const temp = hourlyTemps[index];
        const tempDerating = temp > 25 ? 1 - TEMP_COEFFICIENT * (temp - 25) : 1;

        // Apply system losses and temperature derating
        const effectiveEfficiency = (1 - systemLosses) * tempDerating;

        // DC output using normalized profile (this is what the DC panels produce)
        const dcOutputRaw = pvNormalizedProfile[index] * dcCapacityKwp;
        const dcOutput = dcOutputRaw * effectiveEfficiency;

        // AC output capped at inverter limit (this is what gets exported after clipping)
        const pvValue = Math.min(dcOutput, maxPvAcKva);

        result.pvGeneration = pvValue;
        result.pvDcOutput = dcOutput;
        result.pvClipping = dcOutput > maxPvAcKva ? dcOutput - maxPvAcKva : 0;

        // 1:1 baseline comparison (no oversizing, same efficiency)
        const baseline1to1Raw = pvNormalizedProfile[index] * maxPvAcKva;
        const baseline1to1 = baseline1to1Raw * effectiveEfficiency;
        result.pv1to1Baseline = baseline1to1;

        // Temperature for display
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

  // Over-paneling stats (DC/AC ratio > 1)
  const overPanelingStats = useMemo((): OverPanelingStats | null => {
    if (!showPVProfile || !maxPvAcKva || dcAcRatio <= 1) return null;

    const totalDcOutput = chartData.reduce((sum, d) => sum + (d.pvDcOutput || 0), 0);
    const totalAcOutput = chartData.reduce((sum, d) => sum + (d.pvGeneration || 0), 0);
    const totalClipping = chartData.reduce((sum, d) => sum + (d.pvClipping || 0), 0);
    const total1to1Baseline = chartData.reduce((sum, d) => sum + (d.pv1to1Baseline || 0), 0);

    const additionalKwh = totalAcOutput - total1to1Baseline;
    const percentGain = total1to1Baseline > 0 ? (additionalKwh / total1to1Baseline) * 100 : 0;
    const clippingPercent = totalDcOutput > 0 ? (totalClipping / totalDcOutput) * 100 : 0;

    // Monthly and annual projections
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
