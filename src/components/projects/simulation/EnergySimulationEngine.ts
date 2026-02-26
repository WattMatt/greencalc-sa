/**
 * EnergySimulationEngine - Pure energy flow simulation (tariff-independent)
 * 
 * This module handles all kWh calculations:
 * - Solar generation profiles
 * - Battery charge/discharge cycles (with configurable dispatch strategies)
 * - Grid import/export quantities
 * - Self-consumption calculations
 */

import type { DischargeTOUSelection, TOUPeriod, TOUSettings, TOUHourMap } from "@/components/projects/load-profile/types";

// ── Dispatch Strategy Types ──

export type BatteryDispatchStrategy = 'none' | 'self-consumption' | 'tou-arbitrage' | 'peak-shaving' | 'scheduled';

export interface TimeWindow {
  start: number; // Hour (0-23)
  end: number;   // Hour (0-23), wraps around midnight if end < start
}

export type ChargeSourceId = 'pv' | 'grid' | 'generator';

export interface ChargeSource {
  id: ChargeSourceId;
  enabled: boolean;
  chargeTouPeriods?: ('off-peak' | 'standard' | 'peak')[];
  /** @deprecated Use chargeTouPeriods instead */
  chargeTouPeriod?: 'off-peak' | 'standard' | 'peak';
  dischargeTouPeriod?: 'off-peak' | 'standard' | 'peak';
}

export const DEFAULT_CHARGE_SOURCES: ChargeSource[] = [
  { id: 'pv', enabled: true },
  { id: 'grid', enabled: true },
  { id: 'generator', enabled: false },
];

export type DischargeSourceId = 'load' | 'battery' | 'grid-export';

export interface DischargeSource {
  id: DischargeSourceId;
  enabled: boolean;
  dischargeTouPeriods?: ('off-peak' | 'standard' | 'peak')[];
}

export const DEFAULT_DISCHARGE_SOURCES: DischargeSource[] = [
  { id: 'load', enabled: true },
  { id: 'battery', enabled: true },
  { id: 'grid-export', enabled: true },
];

export interface DispatchConfig {
  chargeWindows: TimeWindow[];       // When to charge
  dischargeWindows: TimeWindow[];    // When to discharge
  allowGridCharging: boolean;        // Allow charging from grid (not just solar)
  peakShavingTarget?: number;        // kW target for peak shaving strategy
  chargeSources?: ChargeSource[];    // Ordered list of charge sources (top = highest priority)
  dischargeSources?: DischargeSource[]; // Ordered list of solar discharge destinations (top = highest priority)
  dischargeTouSelection?: DischargeTOUSelection; // Grid-based TOU selection for arbitrage
}

/** Check if an hour falls within a time window (handles midnight wrap) */
function isInWindow(hour: number, window: TimeWindow): boolean {
  if (window.start <= window.end) {
    return hour >= window.start && hour < window.end;
  }
  // Wraps midnight: e.g. 22:00 - 06:00
  return hour >= window.start || hour < window.end;
}

function isInAnyWindow(hour: number, windows: TimeWindow[]): boolean {
  return windows.some(w => isInWindow(hour, w));
}

// ── Default dispatch configs per strategy ──

export function getDefaultDispatchConfig(strategy: BatteryDispatchStrategy): DispatchConfig {
  switch (strategy) {
    case 'none':
      return {
        chargeWindows: [],
        dischargeWindows: [],
        allowGridCharging: false,
      };
    case 'self-consumption':
      return {
        chargeWindows: [],
        dischargeWindows: [],
        allowGridCharging: false,
      };
    case 'tou-arbitrage':
      return {
        chargeWindows: [{ start: 22, end: 6 }],
        dischargeWindows: [{ start: 7, end: 10 }, { start: 18, end: 20 }],
        allowGridCharging: true,
      };
    case 'peak-shaving':
      return {
        chargeWindows: [{ start: 22, end: 6 }],
        dischargeWindows: [],
        allowGridCharging: true,
        peakShavingTarget: 150,
      };
    case 'scheduled':
      return {
        chargeWindows: [{ start: 0, end: 6 }],
        dischargeWindows: [{ start: 7, end: 20 }],
        allowGridCharging: true,
      };
  }
}

// ── Core interfaces ──

export interface EnergySimulationConfig {
  solarCapacity: number; // kWp
  batteryCapacity: number; // kWh
  batteryPower: number; // kW (legacy, used as fallback)
  batteryChargePower?: number; // kW max charge rate (derived from C-rate)
  batteryDischargePower?: number; // kW max discharge rate (derived from C-rate)
  batteryMinSoC?: number; // Minimum state of charge (default 10%)
  batteryMaxSoC?: number; // Maximum state of charge (default 95%)
  batteryInitialSoC?: number; // Starting SoC (default 50%)
  dispatchStrategy?: BatteryDispatchStrategy;
  dispatchConfig?: DispatchConfig;
  /** Resolve a TOU period name ('off-peak'|'standard'|'peak') to TimeWindows */
  touPeriodToWindows?: (period: 'off-peak' | 'standard' | 'peak') => TimeWindow[];
}

export interface HourlyEnergyData {
  hour: string;
  load: number; // kWh demand
  solar: number; // kWh generated
  gridImport: number; // kWh from grid
  gridExport: number; // kWh exported to grid
  solarUsed: number; // kWh self-consumed
  batteryCharge: number; // kWh charged
  batteryDischarge: number; // kWh discharged
  batterySOC: number; // State of charge (%)
  netLoad: number; // Load minus solar (before battery)
}

export interface EnergySimulationResults {
  hourlyData: HourlyEnergyData[];
  
  // Daily totals (kWh)
  totalDailyLoad: number;
  totalDailySolar: number;
  totalGridImport: number;
  totalGridExport: number;
  totalSolarUsed: number;
  totalBatteryCharge: number;
  totalBatteryDischarge: number;
  
  // Efficiency metrics
  selfConsumptionRate: number; // % of solar used on-site
  solarCoverageRate: number; // % of load covered by solar
  
  // Peak metrics
  peakLoad: number; // Maximum hourly load (kW)
  peakGridImport: number; // Maximum hourly grid import (kW)
  peakReduction: number; // % reduction in peak from grid
  
  // Battery metrics
  batteryCycles: number; // Approximate daily cycles
  batteryUtilization: number; // % of capacity used
  
  // Revenue metrics (daily kWh that actually generate revenue)
  revenueKwh: number; // totalSolarUsed + totalBatteryDischarge + totalGridExport
  
  // Grid charging metrics
  totalBatteryChargeFromGrid: number; // kWh charged from grid (must be paid for)
}

// ── Source-aware helpers ──

/** Check if a given hour falls within any of a source's TOU periods */
function isSourceActiveAtHour(
  hour: number,
  touPeriods: ('off-peak' | 'standard' | 'peak')[] | undefined,
  defaultPeriods: ('off-peak' | 'standard' | 'peak')[],
  touPeriodToWindowsFn?: (period: 'off-peak' | 'standard' | 'peak') => TimeWindow[],
): boolean {
  const periods = touPeriods ?? defaultPeriods;
  if (!touPeriodToWindowsFn) return true; // No resolver = always active (backwards compat)
  for (const p of periods) {
    const windows = touPeriodToWindowsFn(p);
    if (windows.some(w => isInWindow(hour, w))) return true;
  }
  return false;
}

/** Determine charging permissions for a given hour based on chargeSources config */
function getChargePermissions(
  hour: number,
  config: DispatchConfig,
  touPeriodToWindowsFn?: (period: 'off-peak' | 'standard' | 'peak') => TimeWindow[],
): { pvChargeAllowed: boolean; gridChargeAllowed: boolean } {
  const sources = config.chargeSources;
  if (!sources || sources.length === 0) {
    // Legacy: fall back to old behaviour
    return { pvChargeAllowed: true, gridChargeAllowed: config.allowGridCharging };
  }

  let pvChargeAllowed = false;
  let gridChargeAllowed = false;

  for (const src of sources) {
    if (!src.enabled) continue;
    const active = isSourceActiveAtHour(hour, src.chargeTouPeriods, ['off-peak'], touPeriodToWindowsFn);
    if (src.id === 'pv' && active) pvChargeAllowed = true;
    if (src.id === 'grid' && active) gridChargeAllowed = true;
  }

  return { pvChargeAllowed, gridChargeAllowed };
}

/** Determine discharge permissions for a given hour based on dischargeSources config */
function getDischargePermissions(
  hour: number,
  config: DispatchConfig,
  touPeriodToWindowsFn?: (period: 'off-peak' | 'standard' | 'peak') => TimeWindow[],
): { loadDischargeAllowed: boolean; batteryDischargeAllowed: boolean; gridExportAllowed: boolean } {
  const sources = config.dischargeSources;
  if (!sources || sources.length === 0) {
    return { loadDischargeAllowed: true, batteryDischargeAllowed: true, gridExportAllowed: true }; // Legacy
  }

  let loadDischargeAllowed = false;
  let batteryDischargeAllowed = false;
  let gridExportAllowed = false;

  for (const src of sources) {
    if (!src.enabled) continue;
    const active = isSourceActiveAtHour(hour, src.dischargeTouPeriods, src.id === 'battery' ? ['peak'] : ['off-peak', 'standard', 'peak'], touPeriodToWindowsFn);
    if (src.id === 'load' && active) loadDischargeAllowed = true;
    if (src.id === 'battery' && active) batteryDischargeAllowed = true;
    if (src.id === 'grid-export' && active) gridExportAllowed = true;
  }

  return { loadDischargeAllowed, batteryDischargeAllowed, gridExportAllowed };
}

// ── Dispatch strategy implementations ──

interface HourState {
  load: number;
  solar: number;
  netLoad: number;
  batteryState: number;
  minBatteryLevel: number;
  maxBatteryLevel: number;
  batteryChargePower: number;
  batteryDischargePower: number;
}

interface HourResult {
  gridImport: number;
  gridExport: number;
  solarUsed: number;
  batteryCharge: number;
  batteryDischarge: number;
  batteryChargeFromGrid: number;
  newBatteryState: number;
}

interface DispatchPermissions {
  pvChargeAllowed: boolean;
  gridChargeAllowed: boolean;
  loadDischargeAllowed: boolean;
  batteryDischargeAllowed: boolean;
  gridExportAllowed: boolean;
}

function dispatchSelfConsumption(
  s: HourState,
  permissions: DispatchPermissions,
): HourResult {
  const { load, solar, batteryState, minBatteryLevel, maxBatteryLevel, batteryChargePower, batteryDischargePower } = s;
  const { pvChargeAllowed, loadDischargeAllowed, batteryDischargeAllowed, gridExportAllowed } = permissions;

  const solarUsed = loadDischargeAllowed ? Math.min(solar, load) : 0;
  const effectiveNetLoad = load - solarUsed; // How much load remains after solar
  const solarExcess = solar - solarUsed; // Solar not used by load

  let gridImport = 0;
  let gridExport = 0;
  let batteryDischarge = 0;
  let batteryCharge = 0;
  let newBatteryState = batteryState;

  // Handle remaining load deficit
  if (effectiveNetLoad > 0) {
    if (batteryDischargeAllowed) {
      const batteryAvailable = Math.min(batteryState - minBatteryLevel, batteryDischargePower);
      batteryDischarge = Math.min(effectiveNetLoad, Math.max(0, batteryAvailable));
      newBatteryState -= batteryDischarge;
    }
    gridImport = effectiveNetLoad - batteryDischarge;
  }

  // Handle solar excess (charge battery or export)
  if (solarExcess > 0) {
    if (pvChargeAllowed) {
      const batterySpace = Math.min(maxBatteryLevel - batteryState, batteryChargePower);
      batteryCharge = Math.min(solarExcess, Math.max(0, batterySpace));
      newBatteryState += batteryCharge;
    }
    const remainder = solarExcess - batteryCharge;
    gridExport = gridExportAllowed ? remainder : 0;
  }

  return { gridImport, gridExport, solarUsed, batteryCharge, batteryDischarge, batteryChargeFromGrid: 0, newBatteryState };
}

/** Check whether battery discharge is permitted for the given TOU context using the 12-cell selection matrix */
function isDischargePermittedByTouSelection(
  season: 'high' | 'low',
  dayType: 'weekday' | 'saturday' | 'sunday',
  touPeriod: TOUPeriod,
  selection?: DischargeTOUSelection,
): boolean {
  if (!selection) return true; // No matrix = always permitted (backwards compat)
  const seasonKey = season === 'high' ? 'highSeason' : 'lowSeason';
  const dayTypeKey: 'weekday' | 'weekend' = dayType === 'weekday' ? 'weekday' : 'weekend';
  const flags = selection[seasonKey][dayTypeKey];
  switch (touPeriod) {
    case 'peak': return flags.peak;
    case 'standard': return flags.standard;
    case 'off-peak': return flags.offPeak;
    default: return false;
  }
}

interface TouContext {
  season: 'high' | 'low';
  dayType: 'weekday' | 'saturday' | 'sunday';
  touPeriod: TOUPeriod;
}

function dispatchTouArbitrage(
  s: HourState, hour: number, config: DispatchConfig, permissions: DispatchPermissions,
  touContext?: TouContext,
): HourResult {
  const { load, solar, batteryState, minBatteryLevel, maxBatteryLevel, batteryChargePower, batteryDischargePower } = s;
  const { pvChargeAllowed, gridChargeAllowed, loadDischargeAllowed, batteryDischargeAllowed, gridExportAllowed } = permissions;
  const isChargeHour = isInAnyWindow(hour, config.chargeWindows);
  // Use TOU selection matrix when context is available; fall back to static windows
  const isDischargeHour = touContext
    ? isDischargePermittedByTouSelection(touContext.season, touContext.dayType, touContext.touPeriod, config.dischargeTouSelection)
    : isInAnyWindow(hour, config.dischargeWindows);

  const solarUsed = loadDischargeAllowed ? Math.min(solar, load) : 0;
  const effectiveNetLoad = load - solarUsed;
  const solarExcess = solar - solarUsed;

  let gridImport = 0;
  let gridExport = 0;
  let batteryCharge = 0;
  let batteryDischarge = 0;
  let batteryChargeFromGrid = 0;
  let newBatteryState = batteryState;

  if (isDischargeHour) {
    if (effectiveNetLoad > 0) {
      if (batteryDischargeAllowed) {
        const batteryAvailable = Math.min(batteryState - minBatteryLevel, batteryDischargePower);
        batteryDischarge = Math.min(effectiveNetLoad, Math.max(0, batteryAvailable));
        newBatteryState -= batteryDischarge;
      }
      gridImport = effectiveNetLoad - batteryDischarge;
    }
    // Handle solar excess
    if (solarExcess > 0) {
      if (pvChargeAllowed) {
        const batterySpace = Math.min(maxBatteryLevel - newBatteryState, batteryChargePower);
        batteryCharge = Math.min(solarExcess, Math.max(0, batterySpace));
        newBatteryState += batteryCharge;
      }
      const remainder = solarExcess - batteryCharge;
      gridExport = gridExportAllowed ? remainder : 0;
    }
  } else if (isChargeHour) {
    if (effectiveNetLoad > 0) {
      gridImport = effectiveNetLoad;
    }
    // Charge battery from solar excess
    if (solarExcess > 0 && pvChargeAllowed) {
      const batterySpace = Math.min(maxBatteryLevel - batteryState, batteryChargePower);
      batteryCharge = Math.min(solarExcess, Math.max(0, batterySpace));
      newBatteryState += batteryCharge;
      const remainder = solarExcess - batteryCharge;
      gridExport = gridExportAllowed ? remainder : 0;
    }
    // Charge from grid if allowed
    if (gridChargeAllowed) {
      const batterySpace = Math.min(maxBatteryLevel - newBatteryState, batteryChargePower - batteryCharge);
      const gridCharge = Math.max(0, batterySpace);
      if (gridCharge > 0) {
        batteryCharge += gridCharge;
        gridImport += gridCharge;
        newBatteryState += gridCharge;
        batteryChargeFromGrid = gridCharge;
      }
    }
  } else {
    return dispatchSelfConsumption(s, permissions);
  }

  return { gridImport, gridExport, solarUsed, batteryCharge, batteryDischarge, batteryChargeFromGrid, newBatteryState };
}

function dispatchPeakShaving(s: HourState, hour: number, config: DispatchConfig, permissions: DispatchPermissions): HourResult {
  const { load, solar, batteryState, minBatteryLevel, maxBatteryLevel, batteryChargePower, batteryDischargePower } = s;
  const { pvChargeAllowed, gridChargeAllowed, loadDischargeAllowed, batteryDischargeAllowed, gridExportAllowed } = permissions;
  const target = config.peakShavingTarget ?? 150;
  const isChargeHour = config.chargeWindows.length > 0
    ? isInAnyWindow(hour, config.chargeWindows)
    : (hour >= 22 || hour < 6);

  const solarUsed = loadDischargeAllowed ? Math.min(solar, load) : 0;
  const effectiveNetLoad = load - solarUsed;
  const solarExcess = solar - solarUsed;

  let gridImport = 0;
  let gridExport = 0;
  let batteryCharge = 0;
  let batteryDischarge = 0;
  let newBatteryState = batteryState;

  if (effectiveNetLoad > 0) {
    const wouldImport = effectiveNetLoad;
    if (wouldImport > target && batteryDischargeAllowed) {
      const neededDischarge = wouldImport - target;
      const batteryAvailable = Math.min(batteryState - minBatteryLevel, batteryDischargePower);
      batteryDischarge = Math.min(neededDischarge, Math.max(0, batteryAvailable));
      newBatteryState -= batteryDischarge;
      gridImport = wouldImport - batteryDischarge;
    } else {
      gridImport = wouldImport;
    }
  }

  // Handle solar excess
  if (solarExcess > 0) {
    if (pvChargeAllowed) {
      const batterySpace = Math.min(maxBatteryLevel - newBatteryState, batteryChargePower);
      batteryCharge = Math.min(solarExcess, Math.max(0, batterySpace));
      newBatteryState += batteryCharge;
    }
    const remainder = solarExcess - batteryCharge;
    gridExport = gridExportAllowed ? remainder : 0;
  }

  // During charge hours, also charge from grid if allowed
  let batteryChargeFromGrid = 0;
  if (isChargeHour && gridChargeAllowed) {
    const batterySpace = Math.min(maxBatteryLevel - newBatteryState, batteryChargePower - batteryCharge);
    const gridCharge = Math.max(0, batterySpace);
    if (gridCharge > 0) {
      batteryCharge += gridCharge;
      gridImport += gridCharge;
      newBatteryState += gridCharge;
      batteryChargeFromGrid = gridCharge;
    }
  }

  return { gridImport, gridExport, solarUsed, batteryCharge, batteryDischarge, batteryChargeFromGrid, newBatteryState };
}

function dispatchScheduled(s: HourState, hour: number, config: DispatchConfig, permissions: DispatchPermissions, touContext?: TouContext): HourResult {
  return dispatchTouArbitrage(s, hour, config, permissions, touContext);
}

// ── Main simulation function ──

/**
 * Run energy simulation with given load and solar profiles
 * This is pure energy flow – no tariff or cost calculations
 */
export function runEnergySimulation(
  loadProfile: number[], // 24-hour load profile in kWh
  solarProfile: number[], // 24-hour solar generation in kWh
  config: EnergySimulationConfig
): EnergySimulationResults {
  const {
    batteryCapacity,
    batteryPower,
    batteryChargePower: configChargePower,
    batteryDischargePower: configDischargePower,
    batteryMinSoC = 0.10,
    batteryMaxSoC = 0.95,
    batteryInitialSoC = 0.50,
    dispatchStrategy = 'self-consumption',
    dispatchConfig,
    touPeriodToWindows: touPeriodToWindowsFn,
  } = config;

  // Use explicit charge/discharge power if provided, otherwise fall back to legacy batteryPower
  const batteryChargePower = configChargePower ?? batteryPower;
  const batteryDischargePower = configDischargePower ?? batteryPower;

  const effectiveDispatchConfig = dispatchConfig ?? getDefaultDispatchConfig(dispatchStrategy);

  const hourlyData: HourlyEnergyData[] = [];
  
  // Initialize battery state
  let batteryState = batteryCapacity * batteryInitialSoC;
  const minBatteryLevel = batteryCapacity * batteryMinSoC;
  const maxBatteryLevel = batteryCapacity * batteryMaxSoC;
  
  // Accumulators
  let totalGridImport = 0;
  let totalGridExport = 0;
  let totalSolarUsed = 0;
  let totalBatteryCharge = 0;
  let totalBatteryDischarge = 0;
  let totalBatteryChargeFromGrid = 0;

  for (let h = 0; h < 24; h++) {
    const load = loadProfile[h] || 0;
    const solar = solarProfile[h] || 0;
    const netLoad = load - solar;

    const hourState: HourState = {
      load, solar, netLoad, batteryState,
      minBatteryLevel, maxBatteryLevel, batteryChargePower, batteryDischargePower,
    };

    // Compute source-aware permissions for this hour
    const chargePerms = getChargePermissions(h, effectiveDispatchConfig, touPeriodToWindowsFn);
    const dischargePerms = getDischargePermissions(h, effectiveDispatchConfig, touPeriodToWindowsFn);
    const permissions: DispatchPermissions = { ...chargePerms, ...dischargePerms };

    let result: HourResult;
    switch (dispatchStrategy) {
      case 'none':
        // Battery never discharges; override permission
        result = dispatchSelfConsumption(hourState, { ...permissions, batteryDischargeAllowed: false });
        break;
      case 'tou-arbitrage':
        result = dispatchTouArbitrage(hourState, h, effectiveDispatchConfig, permissions);
        break;
      case 'peak-shaving':
        result = dispatchPeakShaving(hourState, h, effectiveDispatchConfig, permissions);
        break;
      case 'scheduled':
        result = dispatchScheduled(hourState, h, effectiveDispatchConfig, permissions);
        break;
      case 'self-consumption':
      default:
        result = dispatchSelfConsumption(hourState, permissions);
        break;
    }

    batteryState = result.newBatteryState;
    totalGridImport += result.gridImport;
    totalGridExport += result.gridExport;
    totalSolarUsed += result.solarUsed;
    totalBatteryCharge += result.batteryCharge;
    totalBatteryDischarge += result.batteryDischarge;
    totalBatteryChargeFromGrid += result.batteryChargeFromGrid;

    hourlyData.push({
      hour: `${h.toString().padStart(2, "0")}:00`,
      load,
      solar,
      gridImport: result.gridImport,
      gridExport: result.gridExport,
      solarUsed: result.solarUsed,
      batteryCharge: result.batteryCharge,
      batteryDischarge: result.batteryDischarge,
      batterySOC: (batteryState / batteryCapacity) * 100,
      netLoad,
    });
  }

  // Calculate summary metrics
  const totalDailyLoad = loadProfile.reduce((a, b) => a + b, 0);
  const totalDailySolar = solarProfile.reduce((a, b) => a + b, 0);
  const peakLoad = Math.max(...loadProfile);
  const peakGridImport = Math.max(...hourlyData.map(d => d.gridImport));
  
  // Self-consumption: % of solar that was used on-site
  const selfConsumptionRate = totalDailySolar > 0 
    ? (totalSolarUsed / totalDailySolar) * 100 
    : 0;
  
  // Solar coverage: % of load met by solar (direct + via battery)
  const solarCoverageRate = totalDailyLoad > 0 
    ? ((totalSolarUsed + totalBatteryDischarge) / totalDailyLoad) * 100 
    : 0;
  
  // Peak reduction
  const peakReduction = peakLoad > 0 
    ? ((peakLoad - peakGridImport) / peakLoad) * 100 
    : 0;
  
  // Battery metrics
  const batteryCycles = batteryCapacity > 0 
    ? totalBatteryDischarge / batteryCapacity 
    : 0;
  const batteryUtilization = batteryCapacity > 0 
    ? ((totalBatteryCharge + totalBatteryDischarge) / 2 / batteryCapacity) * 100 
    : 0;

  // Revenue kWh = energy that displaces grid or is exported (not battery charging)
  const revenueKwh = totalSolarUsed + totalBatteryDischarge + totalGridExport;

  return {
    hourlyData,
    totalDailyLoad,
    totalDailySolar,
    totalGridImport,
    totalGridExport,
    totalSolarUsed,
    totalBatteryCharge,
    totalBatteryDischarge,
    totalBatteryChargeFromGrid,
    selfConsumptionRate,
    solarCoverageRate,
    peakLoad,
    peakGridImport,
    peakReduction,
    batteryCycles,
    batteryUtilization,
    revenueKwh,
  };
}

/**
 * Scale energy results to different time periods
 */
export function scaleToAnnual(dailyResults: EnergySimulationResults): {
  annualLoad: number;
  annualSolar: number;
  annualGridImport: number;
  annualGridExport: number;
  annualSolarUsed: number;
  annualBatteryCycles: number;
} {
  return {
    annualLoad: dailyResults.totalDailyLoad * 365,
    annualSolar: dailyResults.totalDailySolar * 365,
    annualGridImport: dailyResults.totalGridImport * 365,
    annualGridExport: dailyResults.totalGridExport * 365,
    annualSolarUsed: dailyResults.totalSolarUsed * 365,
    annualBatteryCycles: dailyResults.batteryCycles * 365,
  };
}

export function scaleToMonthly(dailyResults: EnergySimulationResults): {
  monthlyLoad: number;
  monthlySolar: number;
  monthlyGridImport: number;
  monthlyGridExport: number;
  monthlySolarUsed: number;
} {
  return {
    monthlyLoad: dailyResults.totalDailyLoad * 30,
    monthlySolar: dailyResults.totalDailySolar * 30,
    monthlyGridImport: dailyResults.totalGridImport * 30,
    monthlyGridExport: dailyResults.totalGridExport * 30,
    monthlySolarUsed: dailyResults.totalSolarUsed * 30,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// ANNUAL 8,760-HOUR SIMULATION
// ══════════════════════════════════════════════════════════════════════════════

// Types already imported at top of file

/** Extended hourly data with calendar context */
export interface AnnualHourlyEnergyData extends HourlyEnergyData {
  dayIndex: number;        // 0-364
  season: 'high' | 'low';
  dayType: 'weekday' | 'saturday' | 'sunday';
  touPeriod: TOUPeriod;
  batteryChargeFromGrid: number; // kWh charged from grid this hour
}

/** Annual simulation results with 8,760 tagged hours */
export interface AnnualEnergySimulationResults {
  hourlyData: AnnualHourlyEnergyData[];

  // Pre-summed annual totals (no * 365 scaling)
  totalAnnualLoad: number;
  totalAnnualSolar: number;
  totalAnnualGridImport: number;
  totalAnnualGridExport: number;
  totalAnnualSolarUsed: number;
  totalAnnualBatteryCharge: number;
  totalAnnualBatteryDischarge: number;
  totalAnnualBatteryChargeFromGrid: number;

  // Efficiency metrics (annual)
  selfConsumptionRate: number;
  solarCoverageRate: number;
  peakLoad: number;
  peakGridImport: number;
  peakReduction: number;
  batteryCycles: number;
}

/** Calendar info for a single day */
interface DayCalendarInfo {
  dayIndex: number;
  month: number;           // 0-indexed
  dayOfWeek: number;       // 0=Sun, 1=Mon, ..., 6=Sat
  season: 'high' | 'low';
  dayType: 'weekday' | 'saturday' | 'sunday';
  hourMap: TOUHourMap;
}

/** Cumulative days per month (non-leap year) */
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const CUMULATIVE_MONTH_DAYS: number[] = [];
{
  let acc = 0;
  for (const d of MONTH_DAYS) {
    CUMULATIVE_MONTH_DAYS.push(acc);
    acc += d;
  }
}

/** Get 0-indexed month from day-of-year (0-364) */
function monthFromDayIndex(dayIndex: number): number {
  for (let m = 11; m >= 0; m--) {
    if (dayIndex >= CUMULATIVE_MONTH_DAYS[m]) return m;
  }
  return 0;
}

/**
 * Build a 365-day calendar with season, dayType, and TOU hourMap per day.
 * Starts on a Wednesday (Jan 1) to give a balanced day-of-week distribution.
 */
export function buildAnnualCalendar(touSettings: TOUSettings): DayCalendarInfo[] {
  const calendar: DayCalendarInfo[] = [];
  // Start on Wednesday (dayOfWeek=3) for a representative year
  const startDayOfWeek = 3; // 0=Sun,1=Mon,...,6=Sat → 3=Wed

  for (let d = 0; d < 365; d++) {
    const month = monthFromDayIndex(d);
    const dayOfWeek = (startDayOfWeek + d) % 7;
    const season: 'high' | 'low' = touSettings.highSeasonMonths.includes(month) ? 'high' : 'low';
    const dayType: 'weekday' | 'saturday' | 'sunday' =
      dayOfWeek === 0 ? 'sunday' :
      dayOfWeek === 6 ? 'saturday' :
      'weekday';

    const seasonConfig = season === 'high' ? touSettings.highSeason : touSettings.lowSeason;
    const hourMap: TOUHourMap =
      dayType === 'weekday' ? seasonConfig.weekday :
      dayType === 'saturday' ? seasonConfig.saturday :
      seasonConfig.sunday;

    calendar.push({ dayIndex: d, month, dayOfWeek, season, dayType, hourMap });
  }
  return calendar;
}

/**
 * Create a touPeriodToWindows function for a specific hour map.
 * This allows the existing dispatch permission functions to resolve
 * TOU periods correctly for each day in the annual simulation.
 */
function makeTouPeriodToWindowsFromHourMap(hourMap: TOUHourMap): (period: 'off-peak' | 'standard' | 'peak') => TimeWindow[] {
  return (period: 'off-peak' | 'standard' | 'peak') => {
    const windows: TimeWindow[] = [];
    let start: number | null = null;
    for (let h = 0; h <= 24; h++) {
      const p = h < 24 ? hourMap[h] : undefined;
      if (p === period && start === null) {
        start = h;
      } else if (p !== period && start !== null) {
        windows.push({ start, end: h });
        start = null;
      }
    }
    return windows.length > 0 ? windows : [{ start: 0, end: 0 }];
  };
}

/**
 * Run full 8,760-hour annual energy simulation.
 * Battery SoC carries over day-to-day. Each hour is tagged with
 * its calendar context (season, dayType, touPeriod).
 */
export function runAnnualEnergySimulation(
  loadProfile: number[],     // 24-hour representative load profile (kWh)
  solarProfile: number[],    // 24-hour representative solar profile (kWh)
  config: EnergySimulationConfig,
  touSettings: TOUSettings,
): AnnualEnergySimulationResults {
  const {
    batteryCapacity,
    batteryPower,
    batteryChargePower: configChargePower,
    batteryDischargePower: configDischargePower,
    batteryMinSoC = 0.10,
    batteryMaxSoC = 0.95,
    batteryInitialSoC = 0.50,
    dispatchStrategy = 'self-consumption',
    dispatchConfig,
  } = config;

  const batteryChargePower = configChargePower ?? batteryPower;
  const batteryDischargePower = configDischargePower ?? batteryPower;
  const effectiveDispatchConfig = dispatchConfig ?? getDefaultDispatchConfig(dispatchStrategy);

  const calendar = buildAnnualCalendar(touSettings);
  const hourlyData: AnnualHourlyEnergyData[] = [];

  let batteryState = batteryCapacity * batteryInitialSoC;
  const minBatteryLevel = batteryCapacity * batteryMinSoC;
  const maxBatteryLevel = batteryCapacity * batteryMaxSoC;

  // Accumulators
  let totalGridImport = 0;
  let totalGridExport = 0;
  let totalSolarUsed = 0;
  let totalBatteryCharge = 0;
  let totalBatteryDischarge = 0;
  let totalBatteryChargeFromGrid = 0;
  let totalLoad = 0;
  let totalSolar = 0;
  let peakGridImport = 0;

  for (const day of calendar) {
    // Build a per-day touPeriodToWindows function from this day's hourMap
    const dayTouResolver = makeTouPeriodToWindowsFromHourMap(day.hourMap);

    for (let h = 0; h < 24; h++) {
      const load = loadProfile[h] || 0;
      const solar = solarProfile[h] || 0;
      const netLoad = load - solar;

      const hourState: HourState = {
        load, solar, netLoad, batteryState,
        minBatteryLevel, maxBatteryLevel, batteryChargePower, batteryDischargePower,
      };

      // Resolve permissions using this day's TOU context
      const chargePerms = getChargePermissions(h, effectiveDispatchConfig, dayTouResolver);
      const dischargePerms = getDischargePermissions(h, effectiveDispatchConfig, dayTouResolver);
      const permissions: DispatchPermissions = { ...chargePerms, ...dischargePerms };

      // Resolve TOU period BEFORE dispatch so it can inform discharge decisions
      const touPeriod: TOUPeriod = day.hourMap[h] || 'off-peak';
      const touContext: TouContext = { season: day.season, dayType: day.dayType, touPeriod };

      let result: HourResult;
      switch (dispatchStrategy) {
        case 'none':
          result = dispatchSelfConsumption(hourState, { ...permissions, batteryDischargeAllowed: false });
          break;
        case 'tou-arbitrage':
          result = dispatchTouArbitrage(hourState, h, effectiveDispatchConfig, permissions, touContext);
          break;
        case 'peak-shaving':
          result = dispatchPeakShaving(hourState, h, effectiveDispatchConfig, permissions);
          break;
        case 'scheduled':
          result = dispatchScheduled(hourState, h, effectiveDispatchConfig, permissions, touContext);
          break;
        case 'self-consumption':
        default:
          result = dispatchSelfConsumption(hourState, permissions);
          break;
      }

      batteryState = result.newBatteryState;

      hourlyData.push({
        hour: `${h.toString().padStart(2, '0')}:00`,
        load,
        solar,
        gridImport: result.gridImport,
        gridExport: result.gridExport,
        solarUsed: result.solarUsed,
        batteryCharge: result.batteryCharge,
        batteryDischarge: result.batteryDischarge,
        batterySOC: (batteryState / batteryCapacity) * 100,
        netLoad,
        dayIndex: day.dayIndex,
        season: day.season,
        dayType: day.dayType,
        touPeriod,
        batteryChargeFromGrid: result.batteryChargeFromGrid,
      });
    }
  }

  const peakLoad = Math.max(...loadProfile);
  const selfConsumptionRate = totalSolar > 0 ? (totalSolarUsed / totalSolar) * 100 : 0;
  const solarCoverageRate = totalLoad > 0 ? ((totalSolarUsed + totalBatteryDischarge) / totalLoad) * 100 : 0;
  const peakReduction = peakLoad > 0 ? ((peakLoad - peakGridImport) / peakLoad) * 100 : 0;
  const batteryCycles = batteryCapacity > 0 ? totalBatteryDischarge / batteryCapacity : 0;

  return {
    hourlyData,
    totalAnnualLoad: totalLoad,
    totalAnnualSolar: totalSolar,
    totalAnnualGridImport: totalGridImport,
    totalAnnualGridExport: totalGridExport,
    totalAnnualSolarUsed: totalSolarUsed,
    totalAnnualBatteryCharge: totalBatteryCharge,
    totalAnnualBatteryDischarge: totalBatteryDischarge,
    totalAnnualBatteryChargeFromGrid: totalBatteryChargeFromGrid,
    selfConsumptionRate,
    solarCoverageRate,
    peakLoad,
    peakGridImport,
    peakReduction,
    batteryCycles,
  };
}
