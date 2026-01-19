import { useMemo } from "react";
import {
  Tenant,
  TenantMeter,
  ShopType,
  DayOfWeek,
  DAY_MULTIPLIERS,
  DEFAULT_PROFILE_PERCENT,
  getTOUPeriod,
  ChartDataPoint,
  DisplayUnit,
  OverPanelingStats,
  PVStats,
} from "../types";
import { SolcastPVProfile } from "./useSolcastPVProfile";

// Calculate averaged profile from multiple meters
// Returns a normalized profile (percentages summing to ~100) that represents
// the weighted average SHAPE of consumption across the day
function getAveragedProfileShape(
  meters: TenantMeter[] | undefined,
  profileKey: 'load_profile_weekday' | 'load_profile_weekend'
): { profile: number[] | null; avgDailyKwhPerSqm: number } {
  if (!meters || meters.length === 0) return { profile: null, avgDailyKwhPerSqm: 0 };
  
  // Filter to valid meters with actual data
  const validMeters = meters.filter(m => {
    const profile = m.scada_imports?.[profileKey];
    if (!profile || profile.length !== 24) return false;
    const dailyTotal = profile.reduce((sum, v) => sum + v, 0);
    const area = m.scada_imports?.area_sqm || 0;
    return dailyTotal >= 10 && area > 0; // Need both valid consumption and area
  });
  
  if (validMeters.length === 0) return { profile: null, avgDailyKwhPerSqm: 0 };
  
  // Calculate total weight from valid meters
  const totalWeight = validMeters.reduce((sum, m) => sum + (m.weight || 1), 0);
  
  // Average the normalized shapes (percentages) and track kWh/m² intensity
  const normalizedAveraged: number[] = Array(24).fill(0);
  let weightedKwhPerSqm = 0;
  
  for (const meter of validMeters) {
    const profile = meter.scada_imports![profileKey]!;
    const meterWeight = (meter.weight || 1) / totalWeight;
    const dailyTotal = profile.reduce((sum, v) => sum + v, 0);
    const meterArea = meter.scada_imports!.area_sqm!;
    
    // Normalize this profile to percentages (shape only)
    const percentages = profile.map(v => (v / dailyTotal) * 100);
    
    // Accumulate weighted shape
    for (let h = 0; h < 24; h++) {
      normalizedAveraged[h] += percentages[h] * meterWeight;
    }
    
    // Track weighted average kWh per m² (energy intensity)
    weightedKwhPerSqm += (dailyTotal / meterArea) * meterWeight;
  }
  
  return { profile: normalizedAveraged, avgDailyKwhPerSqm: weightedKwhPerSqm };
}

interface UseLoadProfileDataProps {
  tenants: Tenant[];
  shopTypes: ShopType[];
  selectedDay: DayOfWeek;
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
  selectedDay,
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
  const isWeekend = selectedDay === "Saturday" || selectedDay === "Sunday";

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
      const hasMultiMeter = (t.tenant_meters?.length || 0) > 0 && 
        t.tenant_meters?.some(m => m.scada_imports?.load_profile_weekday?.length === 24);
      if (hasMultiMeter || t.scada_imports?.load_profile_weekday?.length === 24) scadaCount++;
      else estimatedCount++;
    });
    return { tenantsWithScada: scadaCount, tenantsEstimated: estimatedCount };
  }, [tenants]);

  // Calculate daily kWh totals for weekday and weekend (for monthly calculation)
  const { weekdayDailyKwh, weekendDailyKwh } = useMemo(() => {
    let weekdayTotal = 0;
    let weekendTotal = 0;
    
    tenants.forEach((tenant) => {
      const tenantArea = Number(tenant.area_sqm) || 0;
      if (tenantArea <= 0) return;
      
      // Multi-meter profiles - use shape + intensity approach
      const weekdayShape = getAveragedProfileShape(tenant.tenant_meters, 'load_profile_weekday');
      const weekendShape = getAveragedProfileShape(tenant.tenant_meters, 'load_profile_weekend');
      
      if (weekdayShape.profile && weekdayShape.avgDailyKwhPerSqm > 0) {
        // Calculate tenant's daily kWh based on their area × average intensity
        const tenantDailyKwh = tenantArea * weekdayShape.avgDailyKwhPerSqm;
        weekdayTotal += tenantDailyKwh;
        
        const weekendKwhPerSqm = weekendShape.avgDailyKwhPerSqm || weekdayShape.avgDailyKwhPerSqm;
        weekendTotal += tenantArea * weekendKwhPerSqm;
        return;
      }
      
      // Single SCADA profile
      const scadaWeekday = tenant.scada_imports?.load_profile_weekday;
      const scadaWeekend = tenant.scada_imports?.load_profile_weekend || scadaWeekday;
      
      if (scadaWeekday?.length === 24) {
        const scadaArea = tenant.scada_imports?.area_sqm || tenantArea;
        const dailyKwh = scadaWeekday.reduce((sum, v) => sum + v, 0);
        const kwhPerSqm = scadaArea > 0 ? dailyKwh / scadaArea : 0;
        weekdayTotal += tenantArea * kwhPerSqm;
        
        if (scadaWeekend?.length === 24) {
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

  // Calculate base kWh data based on selected day
  const baseChartData = useMemo(() => {
    const isWeekendDay = selectedDay === "Saturday" || selectedDay === "Sunday";
    const dayMultiplier = DAY_MULTIPLIERS[selectedDay];
    const hourlyData: { hour: string; total: number; [key: string]: number | string }[] = [];

    for (let h = 0; h < 24; h++) {
      const hourLabel = `${h.toString().padStart(2, "0")}:00`;
      const hourData: { hour: string; total: number; [key: string]: number | string } = { hour: hourLabel, total: 0 };

      tenants.forEach((tenant) => {
        const tenantArea = Number(tenant.area_sqm) || 0;
        if (tenantArea <= 0) return;
        
        const key = tenant.name.length > 15 ? tenant.name.slice(0, 15) + "…" : tenant.name;
        
        // Check for multi-meter averaged profile first
        const profileKey = isWeekendDay ? 'load_profile_weekend' : 'load_profile_weekday';
        const shapeData = getAveragedProfileShape(tenant.tenant_meters, profileKey);
        
        // Fallback to weekday if weekend not available
        const fallbackShape = isWeekendDay && !shapeData.profile 
          ? getAveragedProfileShape(tenant.tenant_meters, 'load_profile_weekday')
          : shapeData;
        
        if (fallbackShape.profile && fallbackShape.avgDailyKwhPerSqm > 0) {
          // Calculate this tenant's hourly kWh:
          // tenant area × avg kWh/m² intensity × hourly percentage shape × day multiplier
          const tenantDailyKwh = tenantArea * fallbackShape.avgDailyKwhPerSqm;
          const hourlyKwh = tenantDailyKwh * (fallbackShape.profile[h] / 100) * dayMultiplier;
          
          hourData[key] = ((hourData[key] as number) || 0) + hourlyKwh;
          hourData.total += hourlyKwh;
          return;
        }
        
        // Fall back to single SCADA profile
        const scadaWeekday = tenant.scada_imports?.load_profile_weekday;
        const scadaWeekend = tenant.scada_imports?.load_profile_weekend;
        const scadaProfile = isWeekendDay ? scadaWeekend || scadaWeekday : scadaWeekday;

        if (scadaProfile?.length === 24) {
          const scadaArea = tenant.scada_imports?.area_sqm || tenantArea;
          const dailyKwh = scadaProfile.reduce((sum, v) => sum + v, 0);
          const kwhPerSqm = scadaArea > 0 ? dailyKwh / scadaArea : 0;
          const tenantDailyKwh = tenantArea * kwhPerSqm;
          const hourPct = (scadaProfile[h] / dailyKwh) * 100;
          const hourlyKwh = tenantDailyKwh * (hourPct / 100) * dayMultiplier;
          
          hourData[key] = ((hourData[key] as number) || 0) + hourlyKwh;
          hourData.total += hourlyKwh;
          return;
        }

        // Shop type estimate
        const shopType = tenant.shop_type_id ? shopTypes.find((st) => st.id === tenant.shop_type_id) : null;
        const monthlyKwh = tenant.monthly_kwh_override || (shopType?.kwh_per_sqm_month || 50) * tenantArea;
        const dailyKwh = monthlyKwh / 30;
        const shopTypeProfile = isWeekendDay ? shopType?.load_profile_weekend || shopType?.load_profile_weekday : shopType?.load_profile_weekday;
        const profile = shopTypeProfile?.length === 24 ? shopTypeProfile.map(Number) : DEFAULT_PROFILE_PERCENT;
        const hourlyKwh = dailyKwh * (profile[h] / 100) * dayMultiplier;
        
        hourData[key] = ((hourData[key] as number) || 0) + hourlyKwh;
        hourData.total += hourlyKwh;
      });

      hourlyData.push(hourData);
    }

    return hourlyData;
  }, [tenants, shopTypes, selectedDay]);

  // Convert to display unit, apply diversity factor, and add PV/battery
  const chartData = useMemo((): ChartDataPoint[] => {
    const baseData = baseChartData.map((hourData, index) => {
      const result: ChartDataPoint = { hour: hourData.hour, total: 0 };

      Object.keys(hourData).forEach((key) => {
        if (key === "hour") return;
        const kwhValue = hourData[key] as number;
        // Apply diversity factor to reduce combined load
        const diversifiedKwh = kwhValue * diversityFactor;
        const value = displayUnit === "kwh" ? diversifiedKwh : diversifiedKwh / powerFactor;
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
