/**
 * useSimulationEngine – centralises the 8,760-hour annual simulation,
 * financial analysis, advanced 20-year cashflow, and chart-data merging
 * that were previously inline inside SimulationPanel.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLoadProfileData } from "../load-profile/hooks/useLoadProfileData";
import { Tenant as FullTenant, ShopType as FullShopType, TOUPeriod as LoadProfileTOUPeriod, ChartDataPoint } from "../load-profile/types";
import type { SolcastPVProfile } from "../load-profile/hooks/useSolcastPVProfile";
import {
  runAnnualEnergySimulation,
  calculateFinancialsFromAnnual,
  type TariffData,
} from "../simulation";
import type { DispatchConfig, BatteryDispatchStrategy } from "./EnergySimulationEngine";
import type { AdvancedSimulationConfig, AdvancedFinancialResults } from "./AdvancedSimulationTypes";
import { runAdvancedSimulation } from "./AdvancedSimulationEngine";
import { calculateAnnualBlendedRates } from "@/lib/tariffCalculations";
import { calculateFinancialMetrics } from "@/utils/financialMetrics";
import type { BlendedRateType } from "../TariffSelector";
import type { SystemCostsData } from "../SystemCostsManager";
import type { InverterConfig } from "../InverterSizing";
import type { SolarDataSource } from "./useSolarProfiles";

// ─── Configuration input ────────────────────────────────────────────────

export interface SimulationEngineConfig {
  // Project
  projectId: string;
  project: any;
  tenants: FullTenant[];
  shopTypes: FullShopType[];

  // Sizing
  solarCapacity: number;
  batteryCapacity: number;       // DC kWh
  batteryAcCapacity: number;
  batteryPower: number;
  batteryChargePower: number;
  batteryDischargePower: number;
  batteryMinSoC: number;         // 0-100
  batteryMaxSoC: number;         // 0-100
  batteryStrategy: BatteryDispatchStrategy;
  batteryAuxPowerW: number;
  dispatchConfig: DispatchConfig;

  // Flags
  includesSolar: boolean;
  includesBattery: boolean;

  // Inverter
  inverterConfig: InverterConfig;
  moduleMetrics: { actualDcCapacityKwp: number; moduleCount: number; stcEfficiency: number; moduleName: string; collectorAreaM2: number };

  // Solar profiles
  solarDataSource: SolarDataSource;
  solcastPvProfileData: SolcastPVProfile | undefined;
  solarProfile: number[];
  solarProfileSolcast: number[] | undefined;
  solarProfileGeneric: number[];
  tmySolarProfile8760: number[] | undefined;
  tmyDcProfile8760: number[] | undefined;
  tmyInverterLossMultiplier: number;
  annualPVsystResult: any;
  reductionFactor: number;

  // Navigation
  selectedDayIndex: number;
  showAnnualAverage: boolean;
  dayDateInfo: { dayOfWeek: number; month: number };
  comparisonTabViewed: boolean;

  // Tariff / financial
  systemCosts: SystemCostsData;
  blendedRateType: BlendedRateType;
  useHourlyTouRates: boolean;
  advancedConfig: AdvancedSimulationConfig;

  // TOU
  touSettingsData: any;
  touPeriodToWindows: (period: string) => { start: number; end: number }[];
}

// ─── Output ─────────────────────────────────────────────────────────────

export interface SimulationEngineOutput {
  // Energy config (for chart tabs)
  energyConfig: any;
  // Load profiles
  loadProfile: number[];
  loadProfileChartData: ChartDataPoint[];
  loadProfileTotalDaily: number;
  loadProfilePeakHour: { val: number; hour: number };
  loadProfileLoadFactor: number;
  loadProfileIsWeekend: boolean;
  tenantsWithScada: number;
  tenantsEstimated: number;

  // Energy results
  annualEnergyResults: ReturnType<typeof runAnnualEnergySimulation>;
  annualEnergyResultsGeneric: ReturnType<typeof runAnnualEnergySimulation> | null;
  annualEnergyResultsSolcast: ReturnType<typeof runAnnualEnergySimulation> | null;

  // Day slices
  representativeDay: any[];
  touPeriodsForDay: LoadProfileTOUPeriod[] | undefined;

  // Tariff
  tariffData: TariffData;
  tariffRates: any[] | undefined;
  tariff: any;
  annualBlendedRates: ReturnType<typeof calculateAnnualBlendedRates>;
  selectedBlendedRate: number;
  hasFinancialData: boolean;

  // Financial
  financialResults: ReturnType<typeof calculateFinancialsFromAnnual>;
  financialResultsGeneric: ReturnType<typeof calculateFinancialsFromAnnual>;
  financialResultsSolcast: ReturnType<typeof calculateFinancialsFromAnnual> | null;
  basicFinancialMetrics: { npv: number; irr: number; mirr: number; lcoe: number; projectLifeYears: number; discountRate: number };
  threeYearOM: number;

  // Advanced
  advancedResults: AdvancedFinancialResults | null;
  unifiedPaybackPeriod: number | null;
  isAdvancedEnabled: boolean;

  // Chart data (merged)
  simulationChartData: ChartDataPoint[];
}

// ─── Constants ──────────────────────────────────────────────────────────

const ALL_DAYS = new Set([0, 1, 2, 3, 4, 5, 6]);
const ALL_MONTHS = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);

// ─── Hook ───────────────────────────────────────────────────────────────

export function useSimulationEngine(cfg: SimulationEngineConfig): SimulationEngineOutput {
  const {
    project, tenants, shopTypes,
    solarCapacity, batteryCapacity, batteryAcCapacity, batteryPower,
    batteryChargePower, batteryDischargePower,
    batteryMinSoC, batteryMaxSoC, batteryStrategy, dispatchConfig,
    includesSolar, includesBattery,
    inverterConfig, moduleMetrics,
    solarDataSource, solcastPvProfileData,
    solarProfile, solarProfileSolcast, solarProfileGeneric,
    tmySolarProfile8760, tmyDcProfile8760, tmyInverterLossMultiplier,
    annualPVsystResult, reductionFactor,
    selectedDayIndex, showAnnualAverage, dayDateInfo, comparisonTabViewed,
    systemCosts, blendedRateType, useHourlyTouRates,
    advancedConfig, touSettingsData, touPeriodToWindows,
  } = cfg;

  // ── Stable load profile (all days/months) ──
  const {
    chartData: stableChartData,
  } = useLoadProfileData({
    tenants,
    shopTypes,
    selectedDays: ALL_DAYS,
    selectedMonths: ALL_MONTHS,
    displayUnit: "kw",
    powerFactor: 0.9,
    showPVProfile: includesSolar && solarCapacity > 0,
    maxPvAcKva: inverterConfig.inverterSize * inverterConfig.inverterCount,
    dcCapacityKwp: moduleMetrics.actualDcCapacityKwp,
    dcAcRatio: inverterConfig.dcAcRatio,
    showBattery: includesBattery && batteryCapacity > 0,
    batteryCapacity,
    batteryPower: batteryChargePower,
    batteryDischargePower,
    solcastProfile: solarDataSource === "solcast" ? solcastPvProfileData : undefined,
  });

  // ── Per-day load profile ──
  const {
    chartData: loadProfileChartData,
    totalDaily: loadProfileTotalDaily,
    peakHour: loadProfilePeakHour,
    loadFactor: loadProfileLoadFactor,
    isWeekend: loadProfileIsWeekend,
    tenantsWithScada,
    tenantsEstimated,
  } = useLoadProfileData({
    tenants,
    shopTypes,
    selectedDays: showAnnualAverage ? ALL_DAYS : new Set([dayDateInfo.dayOfWeek]),
    selectedMonths: showAnnualAverage ? ALL_MONTHS : new Set([dayDateInfo.month]),
    displayUnit: "kw",
    powerFactor: 0.9,
    showPVProfile: includesSolar && solarCapacity > 0,
    maxPvAcKva: inverterConfig.inverterSize * inverterConfig.inverterCount,
    dcCapacityKwp: moduleMetrics.actualDcCapacityKwp,
    dcAcRatio: inverterConfig.dcAcRatio,
    showBattery: includesBattery && batteryCapacity > 0,
    batteryCapacity,
    batteryPower: batteryChargePower,
    batteryDischargePower,
    solcastProfile: solarDataSource === "solcast" ? solcastPvProfileData : undefined,
  });

  // ── Load profile array for engine ──
  const loadProfile = useMemo(() => stableChartData.map(d => d.total), [stableChartData]);

  const effectiveSolarCapacity = includesSolar ? solarCapacity : 0;

  const energyConfig = useMemo(() => ({
    solarCapacity: effectiveSolarCapacity,
    batteryCapacity,
    batteryPower,
    batteryChargePower,
    batteryDischargePower,
    batteryMinSoC: batteryMinSoC / 100,
    batteryMaxSoC: batteryMaxSoC / 100,
    batteryAuxPowerW: cfg.batteryAuxPowerW,
    dispatchStrategy: batteryStrategy,
    dispatchConfig,
    touPeriodToWindows,
    touSettings: touSettingsData,
    representativeSeason: 'low' as const,
  }), [effectiveSolarCapacity, batteryCapacity, batteryPower, batteryChargePower, batteryDischargePower, batteryMinSoC, batteryMaxSoC, cfg.batteryAuxPowerW, batteryStrategy, dispatchConfig, touSettingsData]);

  const chartSolarProfile = useMemo(() => stableChartData.map(d => d.pvGeneration || 0), [stableChartData]);
  const effectiveSolarProfile = includesSolar ? chartSolarProfile : loadProfile.map(() => 0);

  // ── 8,760-hour annual simulation ──
  const annualEnergyResults = useMemo(() =>
    runAnnualEnergySimulation(loadProfile, effectiveSolarProfile, energyConfig, touSettingsData, tmySolarProfile8760),
    [loadProfile, effectiveSolarProfile, energyConfig, touSettingsData, tmySolarProfile8760]
  );

  const annualEnergyResultsGeneric = useMemo(() =>
    comparisonTabViewed ? runAnnualEnergySimulation(loadProfile, solarProfileGeneric, energyConfig, touSettingsData) : null,
    [comparisonTabViewed, loadProfile, solarProfileGeneric, energyConfig, touSettingsData]
  );

  const annualEnergyResultsSolcast = useMemo(() =>
    comparisonTabViewed && solarProfileSolcast ? runAnnualEnergySimulation(loadProfile, solarProfileSolcast, energyConfig, touSettingsData) : null,
    [comparisonTabViewed, loadProfile, solarProfileSolcast, energyConfig, touSettingsData]
  );

  // ── Day slices (O(1) direct indexing instead of O(8760) filter) ──
  const dailySlice = useMemo(() => {
    if (!annualEnergyResults?.hourlyData) return [];
    const start = selectedDayIndex * 24;
    return annualEnergyResults.hourlyData.slice(start, start + 24);
  }, [annualEnergyResults, selectedDayIndex]);

  // ── Annual average (single O(8760) pass instead of O(8760×24)) ──
  const annualAverageSlice = useMemo(() => {
    const hourly = annualEnergyResults?.hourlyData;
    if (!hourly || hourly.length === 0) return [];

    const FIELDS = ['load', 'solarUsed', 'gridImport', 'gridExport', 'batteryCharge', 'batteryDischarge', 'batterySOC', 'netLoad', 'solar', 'batteryChargeFromGrid'] as const;
    const sums: number[][] = Array.from({ length: 24 }, () => new Array(FIELDS.length).fill(0));
    const counts = new Array(24).fill(0);

    for (let i = 0; i < hourly.length; i++) {
      const h = i % 24;
      const entry = hourly[i] as any;
      counts[h]++;
      for (let f = 0; f < FIELDS.length; f++) {
        sums[h][f] += entry[FIELDS[f]] || 0;
      }
    }

    return Array.from({ length: 24 }, (_, h) => {
      const c = counts[h] || 1;
      const s = sums[h];
      return {
        hour: `${h.toString().padStart(2, '0')}:00`,
        load: s[0] / c, solarUsed: s[1] / c,
        gridImport: s[2] / c, gridExport: s[3] / c,
        batteryCharge: s[4] / c, batteryDischarge: s[5] / c,
        batterySOC: s[6] / c, netLoad: s[7] / c,
        pvGeneration: s[8] / c,
        batteryChargeFromGrid: s[9] / c,
        touPeriod: 'off-peak' as LoadProfileTOUPeriod,
      };
    });
  }, [annualEnergyResults]);

  const touPeriodsForDay = useMemo((): LoadProfileTOUPeriod[] | undefined => {
    if (showAnnualAverage) return undefined;
    if (dailySlice.length === 24) return dailySlice.map(h => h.touPeriod);
    return undefined;
  }, [showAnnualAverage, dailySlice]);

  const representativeDay = useMemo(() => {
    if (showAnnualAverage) return annualAverageSlice;
    return dailySlice;
  }, [showAnnualAverage, annualAverageSlice, dailySlice]);

  // ── Tariff queries ──
  const { data: tariffRates } = useQuery({
    queryKey: ["tariff-rates", project.tariff_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tariff_rates")
        .select("*")
        .eq("tariff_plan_id", project.tariff_id);
      if (error) throw error;
      return (data || []).map((r: any) => ({
        ...r,
        rate_per_kwh: r.charge === 'energy' ? r.amount : 0,
        time_of_use: r.tou === 'all' ? 'Any' : r.tou === 'peak' ? 'Peak' : r.tou === 'standard' ? 'Standard' : 'Off-Peak',
        season: r.season === 'all' ? 'All Year' : r.season === 'high' ? 'High/Winter' : 'Low/Summer',
      }));
    },
    enabled: !!project.tariff_id,
  });

  const { data: tariff } = useQuery({
    queryKey: ["tariff", project.tariff_id],
    queryFn: async () => {
      const { data: plan, error } = await supabase
        .from("tariff_plans")
        .select("*")
        .eq("id", project.tariff_id)
        .single();
      if (error) throw error;
      const { data: rates } = await supabase
        .from("tariff_rates")
        .select("*")
        .eq("tariff_plan_id", project.tariff_id);
      const basicCharge = (rates || []).find((r: any) => r.charge === 'basic')?.amount || 0;
      const demandCharge = (rates || []).find((r: any) => r.charge === 'demand')?.amount || 0;
      const networkCharge = (rates || []).find((r: any) => r.charge === 'network_access')?.amount || 0;
      return {
        ...plan,
        fixed_monthly_charge: basicCharge,
        demand_charge_per_kva: demandCharge,
        network_access_charge: networkCharge,
        legacy_charge_per_kwh: 0,
        tariff_type: (plan as any)?.structure || 'flat',
      };
    },
    enabled: !!project.tariff_id,
  });

  const hasFinancialData = !!project.tariff_id;

  // ── Blended rates ──
  const annualBlendedRates = useMemo(() =>
    calculateAnnualBlendedRates(tariffRates, { legacy_charge_per_kwh: tariff?.legacy_charge_per_kwh }),
    [tariffRates, tariff?.legacy_charge_per_kwh]
  );

  const selectedBlendedRate = useMemo(() => {
    if (!annualBlendedRates) return 2.5;
    switch (blendedRateType) {
      case 'allHours': return annualBlendedRates.allHours.annual;
      case 'allHoursHigh': return annualBlendedRates.allHours.high;
      case 'allHoursLow': return annualBlendedRates.allHours.low;
      case 'solarHours': return annualBlendedRates.solarHours.annual;
      case 'solarHoursHigh': return annualBlendedRates.solarHours.high;
      case 'solarHoursLow': return annualBlendedRates.solarHours.low;
      default: return annualBlendedRates.solarHours.annual;
    }
  }, [annualBlendedRates, blendedRateType]);

  const tariffData: TariffData = useMemo(() => ({
    fixedMonthlyCharge: Number(tariff?.fixed_monthly_charge || 0),
    demandChargePerKva: Number(tariff?.demand_charge_per_kva || 0),
    networkAccessCharge: Number(tariff?.network_access_charge || 0),
    averageRatePerKwh: selectedBlendedRate,
    exportRatePerKwh: 0,
  }), [tariff, selectedBlendedRate]);

  // ── Financial results ──
  const financialResults = useMemo(() =>
    calculateFinancialsFromAnnual(annualEnergyResults, tariffData, systemCosts, solarCapacity, batteryCapacity),
    [annualEnergyResults, tariffData, systemCosts, solarCapacity, batteryCapacity]
  );

  const financialResultsGeneric = useMemo(() =>
    calculateFinancialsFromAnnual(annualEnergyResultsGeneric, tariffData, systemCosts, solarCapacity, batteryCapacity),
    [annualEnergyResultsGeneric, tariffData, systemCosts, solarCapacity, batteryCapacity]
  );

  const financialResultsSolcast = useMemo(() =>
    annualEnergyResultsSolcast
      ? calculateFinancialsFromAnnual(annualEnergyResultsSolcast, tariffData, systemCosts, solarCapacity, batteryCapacity)
      : null,
    [annualEnergyResultsSolcast, tariffData, systemCosts, solarCapacity, batteryCapacity]
  );

  // ── 3-Year O&M ──
  const threeYearOM = useMemo(() => {
    const cpi = systemCosts.cpi ?? 6.0;
    const solarCost = solarCapacity * (systemCosts.solarCostPerKwp ?? 8500);
    const batteryCost = batteryCapacity * (systemCosts.batteryCostPerKwh ?? 3500);
    const solarMaintenance = solarCost * ((systemCosts.solarMaintenancePercentage ?? 3.5) / 100);
    const batteryMaintenance = includesBattery
      ? batteryCost * ((systemCosts.batteryMaintenancePercentage ?? 1.5) / 100)
      : 0;
    const cpiMultiplier = 1 + Math.pow(1 + cpi / 100, 1) + Math.pow(1 + cpi / 100, 2);
    return (solarMaintenance + batteryMaintenance) * cpiMultiplier;
  }, [systemCosts, solarCapacity, batteryCapacity, includesBattery]);

  // ── Basic financial metrics (NPV, IRR, MIRR, LCOE) — delegated to pure utility ──
  const basicFinancialMetrics = useMemo(() =>
    calculateFinancialMetrics({
      systemCost: financialResults.systemCost,
      annualSavings: financialResults.annualSavings,
      annualGeneration: annualEnergyResults.totalAnnualSolar,
      projectLifeYears: systemCosts.projectDurationYears ?? 20,
      discountRate: (systemCosts.lcoeDiscountRate ?? 9) / 100,
      financeRate: (systemCosts.mirrFinanceRate ?? 9) / 100,
      reinvestmentRate: (systemCosts.mirrReinvestmentRate ?? 10) / 100,
    }),
    [financialResults, annualEnergyResults, systemCosts]
  );

  // ── Advanced simulation ──
  const isAdvancedEnabled =
    advancedConfig?.seasonal?.enabled ||
    advancedConfig?.degradation?.enabled ||
    advancedConfig?.financial?.enabled ||
    advancedConfig?.gridConstraints?.enabled ||
    advancedConfig?.loadGrowth?.enabled;

  const advancedResults = useMemo<AdvancedFinancialResults | null>(() => {
    if (!isAdvancedEnabled || !hasFinancialData) return null;
    const dailyAdapter = {
      totalDailyLoad: annualEnergyResults.totalAnnualLoad / 365,
      totalDailySolar: annualEnergyResults.totalAnnualSolar / 365,
      totalGridImport: annualEnergyResults.totalAnnualGridImport / 365,
      totalGridExport: annualEnergyResults.totalAnnualGridExport / 365,
      totalSolarUsed: annualEnergyResults.totalAnnualSolarUsed / 365,
      totalBatteryCharge: annualEnergyResults.totalAnnualBatteryCharge / 365,
      totalBatteryDischarge: annualEnergyResults.totalAnnualBatteryDischarge / 365,
      peakLoad: annualEnergyResults.peakLoad,
      peakGridImport: annualEnergyResults.peakGridImport,
      selfConsumptionRate: annualEnergyResults.selfConsumptionRate,
      solarCoverageRate: annualEnergyResults.solarCoverageRate,
      peakReduction: annualEnergyResults.peakReduction,
      batteryCycles: annualEnergyResults.batteryCycles,
      batteryUtilization: 0,
      revenueKwh: annualEnergyResults.totalAnnualSolarUsed / 365 + annualEnergyResults.totalAnnualBatteryDischarge / 365 + annualEnergyResults.totalAnnualGridExport / 365,
      totalBatteryChargeFromGrid: annualEnergyResults.totalAnnualBatteryChargeFromGrid / 365,
      hourlyData: [],
    };
    return runAdvancedSimulation(
      dailyAdapter, tariffData, systemCosts, solarCapacity, batteryCapacity,
      advancedConfig, tariffRates ?? undefined, touSettingsData, annualEnergyResults
    );
  }, [isAdvancedEnabled, hasFinancialData, annualEnergyResults, tariffData, systemCosts, solarCapacity, batteryCapacity, advancedConfig, tariffRates, touSettingsData]);

  const unifiedPaybackPeriod = useMemo(() => {
    if (!advancedResults) return null;
    if (advancedResults.sensitivityResults?.expected.payback) {
      return advancedResults.sensitivityResults.expected.payback;
    }
    const projections = advancedResults.yearlyProjections;
    const breakeven = projections.find(p => p.cumulativeCashFlow >= 0);
    if (!breakeven) return null;
    const prevYear = projections[breakeven.year - 2];
    if (!prevYear) return breakeven.year;
    const remaining = Math.abs(prevYear.cumulativeCashFlow);
    const fraction = remaining / breakeven.netCashFlow;
    return breakeven.year - 1 + fraction;
  }, [advancedResults]);

  // ── Chart data merging ──
  const simulationChartData = useMemo(() => {
    if (!loadProfileChartData || !representativeDay.length) return loadProfileChartData;
    return loadProfileChartData.map((hour, i) => {
      const engineHour = representativeDay[i];
      if (!engineHour) return hour;

      const inverterTotalKw = inverterConfig.inverterSize * inverterConfig.inverterCount;
      const dcAcRatio = inverterConfig.dcAcRatio;
      let pvDcOutput = hour.pvDcOutput;
      let pvClipping = hour.pvClipping;
      let pv1to1Baseline = hour.pv1to1Baseline;
      if (tmyDcProfile8760 && !showAnnualAverage) {
        const idx = selectedDayIndex * 24 + i;
        pvDcOutput = tmyDcProfile8760[idx] || 0;
        pvClipping = Math.max(0, pvDcOutput * tmyInverterLossMultiplier - inverterTotalKw);
        pv1to1Baseline = dcAcRatio > 1 ? pvDcOutput * tmyInverterLossMultiplier : undefined;
      } else if (tmyDcProfile8760 && showAnnualAverage) {
        let sum = 0;
        for (let d = 0; d < 365; d++) {
          sum += tmyDcProfile8760[d * 24 + i] || 0;
        }
        pvDcOutput = sum / 365;
        pvClipping = Math.max(0, pvDcOutput * tmyInverterLossMultiplier - inverterTotalKw);
        pv1to1Baseline = dcAcRatio > 1 ? pvDcOutput * tmyInverterLossMultiplier : undefined;
      }

      return {
        ...hour,
        pvGeneration: ('pvGeneration' in engineHour ? (engineHour as any).pvGeneration : (engineHour as any).solar) ?? hour.pvGeneration,
        pvDcOutput,
        pvClipping,
        pv1to1Baseline,
        batteryCharge: engineHour.batteryCharge,
        batteryDischarge: engineHour.batteryDischarge,
        batterySoC: (engineHour.batterySOC / 100) * batteryCapacity,
        gridImport: engineHour.gridImport,
        gridExport: engineHour.gridExport,
        gridImportWithBattery: engineHour.gridImport,
        netLoad: engineHour.netLoad,
        solarUsed: engineHour.solarUsed,
      };
    });
  }, [loadProfileChartData, representativeDay, tmyDcProfile8760, selectedDayIndex, showAnnualAverage, inverterConfig.inverterSize, inverterConfig.inverterCount, inverterConfig.dcAcRatio, tmyInverterLossMultiplier, batteryCapacity]);

  return {
    energyConfig,
    loadProfile,
    loadProfileChartData,
    loadProfileTotalDaily,
    loadProfilePeakHour,
    loadProfileLoadFactor,
    loadProfileIsWeekend,
    tenantsWithScada,
    tenantsEstimated,
    annualEnergyResults,
    annualEnergyResultsGeneric,
    annualEnergyResultsSolcast,
    representativeDay,
    touPeriodsForDay,
    tariffData,
    tariffRates,
    tariff,
    annualBlendedRates,
    selectedBlendedRate,
    hasFinancialData,
    financialResults,
    financialResultsGeneric,
    financialResultsSolcast,
    basicFinancialMetrics,
    threeYearOM,
    advancedResults,
    unifiedPaybackPeriod,
    isAdvancedEnabled,
    simulationChartData,
  };
}
