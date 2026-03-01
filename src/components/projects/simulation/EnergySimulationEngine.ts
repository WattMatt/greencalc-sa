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
  { id: 'pv', enabled: false },
  { id: 'grid', enabled: false },
  { id: 'generator', enabled: false },
];

export type DischargeSourceId = 'load' | 'battery' | 'grid-export';

export interface DischargeSource {
  id: DischargeSourceId;
  enabled: boolean;
  dischargeTouPeriods?: ('off-peak' | 'standard' | 'peak')[];
}

export const DEFAULT_DISCHARGE_SOURCES: DischargeSource[] = [
  { id: 'load', enabled: false },
  { id: 'battery', enabled: false },
  { id: 'grid-export', enabled: false },
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
  // All strategies start empty — user must explicitly configure
  return {
    chargeWindows: [],
    dischargeWindows: [],
    allowGridCharging: false,
  };
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
  /** Optional TOU settings for 24-hour chart context (resolves touContext per hour) */
  touSettings?: TOUSettings;
  /** Which season to represent in the 24-hour chart (default 'high') */
  representativeSeason?: 'high' | 'low';
}

export interface HourlyEnergyData {
  hour: string;
  load: number; // kWh demand
  solar: number; // kWh generated
  gridImport: number; // kWh from grid
  gridExport: number; // kWh exported to grid
  solarUsed: number; // kWh self-consumed
  solarDirectToLoad?: number; // kWh intentionally dispatched to load (for financial income, excludes netting inflation)
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
  // If no TOU periods configured and no defaults provided, source is unrestricted
  if (touPeriods === undefined && defaultPeriods.length === 0) return true;
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
    // No defaults — only explicitly configured TOU periods are used
    const active = isSourceActiveAtHour(hour, src.chargeTouPeriods, [], touPeriodToWindowsFn);
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
  solarDirectToLoad: number; // Intentional solar-to-load (before netting) — used for financial income
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

/** Check if battery is ranked higher than load in dischargeSources ordering */
function isBatteryPriorityOverLoad(config?: DispatchConfig): boolean {
  const sources = config?.dischargeSources;
  if (!sources || sources.length === 0) return false;
  const batteryIdx = sources.findIndex(s => s.id === 'battery' && s.enabled);
  const loadIdx = sources.findIndex(s => s.id === 'load' && s.enabled);
  if (batteryIdx === -1) return false; // Battery not enabled
  if (loadIdx === -1) return true; // Battery enabled but load not — battery gets priority
  return batteryIdx < loadIdx; // Lower index = higher priority
}

/**
 * Pre-compute 24-hour permission lookup for a single day.
 * Eliminates per-hour getChargePermissions/getDischargePermissions calls (24 → 1 per day).
 */
function precomputeDayPermissions(
  config: DispatchConfig,
  touResolver: (period: 'off-peak' | 'standard' | 'peak') => TimeWindow[],
): DispatchPermissions[] {
  const perms: DispatchPermissions[] = new Array(24);
  for (let h = 0; h < 24; h++) {
    const cp = getChargePermissions(h, config, touResolver);
    const dp = getDischargePermissions(h, config, touResolver);
    perms[h] = {
      pvChargeAllowed: cp.pvChargeAllowed,
      gridChargeAllowed: cp.gridChargeAllowed,
      loadDischargeAllowed: dp.loadDischargeAllowed,
      batteryDischargeAllowed: dp.batteryDischargeAllowed,
      gridExportAllowed: dp.gridExportAllowed,
    };
  }
  return perms;
}

function dispatchSelfConsumption(
  s: HourState,
  permissions: DispatchPermissions,
  config?: DispatchConfig,
  batteryFirst?: boolean,
): HourResult {
  const { load, solar, batteryState, minBatteryLevel, maxBatteryLevel, batteryChargePower, batteryDischargePower } = s;
  const { pvChargeAllowed, loadDischargeAllowed, batteryDischargeAllowed, gridExportAllowed } = permissions;

  // Use pre-hoisted value; fall back to per-call check only for external callers
  const bFirst = batteryFirst ?? isBatteryPriorityOverLoad(config);

  let solarUsed = 0;
  let solarDirectToLoad = 0;
  let gridImport = 0;
  let gridExport = 0;
  let batteryDischarge = 0;
  let batteryCharge = 0;
  let newBatteryState = batteryState;

  if (bFirst && pvChargeAllowed) {
    // Priority: Solar → Battery first, then remaining solar → Load
    const batterySpace = Math.min(maxBatteryLevel - batteryState, batteryChargePower);
    batteryCharge = Math.min(solar, Math.max(0, batterySpace));
    newBatteryState += batteryCharge;

    const solarAfterBattery = solar - batteryCharge;
    solarUsed = loadDischargeAllowed ? Math.min(solarAfterBattery, load) : 0;
    solarDirectToLoad = solarUsed;
    const effectiveNetLoad = load - solarUsed;

    // Discharge battery to cover remaining load if allowed
    if (effectiveNetLoad > 0 && batteryDischargeAllowed) {
      const batteryAvailable = Math.min(newBatteryState - minBatteryLevel, batteryDischargePower);
      batteryDischarge = Math.min(effectiveNetLoad, Math.max(0, batteryAvailable));
      newBatteryState -= batteryDischarge;
    }
    gridImport = load - solarUsed - batteryDischarge;
    gridImport = Math.max(0, gridImport);

    // Any solar left over after battery + load → export
    const solarRemainder = solarAfterBattery - solarUsed;
    gridExport = gridExportAllowed && solarRemainder > 0 ? solarRemainder : 0;
  } else {
    // Default: Solar → Load first, excess → Battery
    solarUsed = loadDischargeAllowed ? Math.min(solar, load) : 0;
    solarDirectToLoad = solarUsed;
    const effectiveNetLoad = load - solarUsed;
    const solarExcess = solar - solarUsed;

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
  }

  return netBatteryFlows({ gridImport, gridExport, solarUsed, solarDirectToLoad, batteryCharge, batteryDischarge, batteryChargeFromGrid: 0, newBatteryState });
}

/** Net simultaneous battery charge and discharge to physically realistic single-direction flow.
 *  Mutates the result in-place to avoid allocating new objects in the hot loop. */
function netBatteryFlows(result: HourResult): HourResult {
  if (result.batteryCharge > 0 && result.batteryDischarge > 0) {
    const netCharge = result.batteryCharge - result.batteryDischarge;
    if (netCharge >= 0) {
      const offset = result.batteryDischarge;
      result.solarUsed += offset;
      // solarDirectToLoad preserved — do NOT inflate
      result.batteryCharge = netCharge;
      result.batteryDischarge = 0;
      result.gridImport = Math.max(0, result.gridImport - offset);
    } else {
      const offset = result.batteryCharge;
      result.solarUsed += offset;
      // solarDirectToLoad preserved — do NOT inflate
      result.batteryCharge = 0;
      result.batteryDischarge = -netCharge;
      result.gridImport = Math.max(0, result.gridImport - offset);
    }
  }
  return result;
}

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
  batteryFirstOverride?: boolean,
): HourResult {
  const { load, solar, batteryState, minBatteryLevel, maxBatteryLevel, batteryChargePower, batteryDischargePower } = s;
  const { pvChargeAllowed, gridChargeAllowed, loadDischargeAllowed, batteryDischargeAllowed, gridExportAllowed } = permissions;

  const hasChargeSources = config.chargeSources && config.chargeSources.some(s => s.enabled);
  const isChargeHour = hasChargeSources
    ? (pvChargeAllowed || gridChargeAllowed)
    : isInAnyWindow(hour, config.chargeWindows);

  const isDischargeHour = touContext
    ? isDischargePermittedByTouSelection(touContext.season, touContext.dayType, touContext.touPeriod, config.dischargeTouSelection)
    : isInAnyWindow(hour, config.dischargeWindows);

  const batteryFirst = batteryFirstOverride ?? isBatteryPriorityOverLoad(config);

  let solarUsed = 0;
  let solarDirectToLoad = 0;
  let gridImport = 0;
  let gridExport = 0;
  let batteryCharge = 0;
  let batteryDischarge = 0;
  let batteryChargeFromGrid = 0;
  let newBatteryState = batteryState;

  if (isDischargeHour) {
    if (batteryFirst && pvChargeAllowed) {
      // Priority: Solar → Battery first, then remaining solar → Load
      const batterySpace = Math.min(maxBatteryLevel - batteryState, batteryChargePower);
      batteryCharge = Math.min(solar, Math.max(0, batterySpace));
      newBatteryState += batteryCharge;

      const solarAfterBattery = solar - batteryCharge;
      solarUsed = loadDischargeAllowed ? Math.min(solarAfterBattery, load) : 0;
      solarDirectToLoad = solarUsed;
      const effectiveNetLoad = load - solarUsed;

      if (effectiveNetLoad > 0 && batteryDischargeAllowed) {
        const batteryAvailable = Math.min(newBatteryState - minBatteryLevel, batteryDischargePower);
        batteryDischarge = Math.min(effectiveNetLoad, Math.max(0, batteryAvailable));
        newBatteryState -= batteryDischarge;
      }
      gridImport = Math.max(0, load - solarUsed - batteryDischarge);

      const solarRemainder = solarAfterBattery - solarUsed;
      gridExport = gridExportAllowed && solarRemainder > 0 ? solarRemainder : 0;
    } else {
      // Default: Solar → Load first
      solarUsed = loadDischargeAllowed ? Math.min(solar, load) : 0;
      solarDirectToLoad = solarUsed;
      const effectiveNetLoad = load - solarUsed;
      const solarExcess = solar - solarUsed;

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
    }
  } else if (isChargeHour) {
    // During charge hours, always prioritise battery charging from solar
    if (batteryFirst && pvChargeAllowed) {
      const batterySpace = Math.min(maxBatteryLevel - batteryState, batteryChargePower);
      batteryCharge = Math.min(solar, Math.max(0, batterySpace));
      newBatteryState += batteryCharge;

      const solarAfterBattery = solar - batteryCharge;
      solarUsed = loadDischargeAllowed ? Math.min(solarAfterBattery, load) : 0;
      solarDirectToLoad = solarUsed;
      gridImport = Math.max(0, load - solarUsed);

      const solarRemainder = solarAfterBattery - solarUsed;
      gridExport = gridExportAllowed && solarRemainder > 0 ? solarRemainder : 0;
    } else {
      solarUsed = loadDischargeAllowed ? Math.min(solar, load) : 0;
      solarDirectToLoad = solarUsed;
      const effectiveNetLoad = load - solarUsed;
      const solarExcess = solar - solarUsed;

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
    // Hour is neither a discharge nor charge hour per the TOU matrix — disable battery discharge
    // so the self-consumption fallback cannot bypass the user's TOU selection
    return dispatchSelfConsumption(s, { ...permissions, batteryDischargeAllowed: false }, config, batteryFirst);
  }

  return netBatteryFlows({ gridImport, gridExport, solarUsed, solarDirectToLoad, batteryCharge, batteryDischarge, batteryChargeFromGrid, newBatteryState });
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

  return netBatteryFlows({ gridImport, gridExport, solarUsed, solarDirectToLoad: solarUsed, batteryCharge, batteryDischarge, batteryChargeFromGrid, newBatteryState });
}

function dispatchScheduled(s: HourState, hour: number, config: DispatchConfig, permissions: DispatchPermissions, touContext?: TouContext, batteryFirstOverride?: boolean): HourResult {
  return dispatchTouArbitrage(s, hour, config, permissions, touContext, batteryFirstOverride);
}

// Deprecated functions (runEnergySimulation, scaleToAnnual, scaleToMonthly) removed.
// All primary simulation paths now use runAnnualEnergySimulation exclusively.

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
  totalAnnualSolarDirectToLoad: number;
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
 * Uses 2026 calendar where 1 January is a Thursday.
 */
export function buildAnnualCalendar(touSettings: TOUSettings): DayCalendarInfo[] {
  const calendar: DayCalendarInfo[] = [];
  // 1 January 2026 is a Thursday
  const startDayOfWeek = new Date(2026, 0, 1).getDay(); // 4 = Thursday

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
 * Results are cached by hourMap reference since there are only ~6 unique maps.
 */
const _touResolverCache = new WeakMap<TOUHourMap, (period: 'off-peak' | 'standard' | 'peak') => TimeWindow[]>();

function makeTouPeriodToWindowsFromHourMap(hourMap: TOUHourMap): (period: 'off-peak' | 'standard' | 'peak') => TimeWindow[] {
  const cached = _touResolverCache.get(hourMap);
  if (cached) return cached;

  // Pre-compute windows for all three periods at once
  const windowsByPeriod: Record<string, TimeWindow[]> = {
    'off-peak': [],
    'standard': [],
    'peak': [],
  };
  for (const period of ['off-peak', 'standard', 'peak'] as const) {
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
    windowsByPeriod[period] = windows.length > 0 ? windows : [{ start: 0, end: 0 }];
  }

  const resolver = (period: 'off-peak' | 'standard' | 'peak') => windowsByPeriod[period];
  _touResolverCache.set(hourMap, resolver);
  return resolver;
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
  solarProfile8760?: number[],  // Optional: 8,760 hourly solar values (kWh) for TMY
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
  // Pre-allocate array for 8,760 hourly entries
  const hourlyData: AnnualHourlyEnergyData[] = new Array(8760);
  let hourlyIdx = 0;

  // Pre-compute hour label strings (avoid 8,760 string allocations)
  const HOUR_LABELS: string[] = Array.from({ length: 24 }, (_, h) => `${h.toString().padStart(2, '0')}:00`);

  let batteryState = batteryCapacity * batteryInitialSoC;
  const minBatteryLevel = batteryCapacity * batteryMinSoC;
  const maxBatteryLevel = batteryCapacity * batteryMaxSoC;

  // Hoist battery-priority check — constant for entire simulation
  const batteryFirst = isBatteryPriorityOverLoad(effectiveDispatchConfig);

  // Accumulators
  let totalGridImport = 0;
  let totalGridExport = 0;
  let totalSolarUsed = 0;
  let totalSolarDirectToLoad = 0;
  let totalBatteryCharge = 0;
  let totalBatteryDischarge = 0;
  let totalBatteryChargeFromGrid = 0;
  let totalLoad = 0;
  let totalSolar = 0;
  let peakGridImport = 0;

  // Reusable objects to avoid per-hour allocations
  const hourState: HourState = {
    load: 0, solar: 0, netLoad: 0, batteryState: 0,
    minBatteryLevel, maxBatteryLevel, batteryChargePower, batteryDischargePower,
  };

  for (const day of calendar) {
    // Build a per-day touPeriodToWindows function from this day's hourMap
    const dayTouResolver = makeTouPeriodToWindowsFromHourMap(day.hourMap);

    // Pre-compute 24-hour permission lookup for this day (avoids 24 calls per day)
    const dayPerms = precomputeDayPermissions(effectiveDispatchConfig, dayTouResolver);

    for (let h = 0; h < 24; h++) {
      const load = loadProfile[h] || 0;
      const solar = solarProfile8760
        ? (solarProfile8760[day.dayIndex * 24 + h] || 0)
        : (solarProfile[h] || 0);
      const netLoad = load - solar;

      // Mutate reusable object instead of creating new one each hour
      hourState.load = load;
      hourState.solar = solar;
      hourState.netLoad = netLoad;
      hourState.batteryState = batteryState;

      // Use pre-computed permissions for this hour
      const perms = dayPerms[h];

      // Resolve TOU period BEFORE dispatch so it can inform discharge decisions
      const touPeriod: TOUPeriod = day.hourMap[h] || 'off-peak';

      let result: HourResult;
      switch (dispatchStrategy) {
        case 'none':
          result = dispatchSelfConsumption(hourState, { pvChargeAllowed: perms.pvChargeAllowed, gridChargeAllowed: perms.gridChargeAllowed, loadDischargeAllowed: perms.loadDischargeAllowed, batteryDischargeAllowed: false, gridExportAllowed: perms.gridExportAllowed }, effectiveDispatchConfig, batteryFirst);
          break;
        case 'tou-arbitrage':
          result = dispatchTouArbitrage(hourState, h, effectiveDispatchConfig, perms, { season: day.season, dayType: day.dayType, touPeriod }, batteryFirst);
          break;
        case 'peak-shaving':
          result = dispatchPeakShaving(hourState, h, effectiveDispatchConfig, perms);
          break;
        case 'scheduled':
          result = dispatchScheduled(hourState, h, effectiveDispatchConfig, perms, { season: day.season, dayType: day.dayType, touPeriod }, batteryFirst);
          break;
        case 'self-consumption':
        default:
          result = dispatchSelfConsumption(hourState, perms, effectiveDispatchConfig, batteryFirst);
          break;
      }

      batteryState = result.newBatteryState;
      totalGridImport += result.gridImport;
      totalGridExport += result.gridExport;
      totalSolarUsed += result.solarUsed;
      totalSolarDirectToLoad += result.solarDirectToLoad;
      totalBatteryCharge += result.batteryCharge;
      totalBatteryDischarge += result.batteryDischarge;
      totalBatteryChargeFromGrid += result.batteryChargeFromGrid;
      totalLoad += load;
      totalSolar += solar;
      if (result.gridImport > peakGridImport) peakGridImport = result.gridImport;

      hourlyData[hourlyIdx++] = {
        hour: HOUR_LABELS[h],
        load,
        solar,
        gridImport: result.gridImport,
        gridExport: result.gridExport,
        solarUsed: result.solarUsed,
        solarDirectToLoad: result.solarDirectToLoad,
        batteryCharge: result.batteryCharge,
        batteryDischarge: result.batteryDischarge,
        batterySOC: (batteryState / batteryCapacity) * 100,
        netLoad,
        dayIndex: day.dayIndex,
        season: day.season,
        dayType: day.dayType,
        touPeriod,
        batteryChargeFromGrid: result.batteryChargeFromGrid,
      };
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
    totalAnnualSolarDirectToLoad: totalSolarDirectToLoad,
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
