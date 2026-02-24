/**
 * EnergySimulationEngine - Pure energy flow simulation (tariff-independent)
 * 
 * This module handles all kWh calculations:
 * - Solar generation profiles
 * - Battery charge/discharge cycles (with configurable dispatch strategies)
 * - Grid import/export quantities
 * - Self-consumption calculations
 */

// ── Dispatch Strategy Types ──

export type BatteryDispatchStrategy = 'self-consumption' | 'tou-arbitrage' | 'peak-shaving' | 'scheduled';

export interface TimeWindow {
  start: number; // Hour (0-23)
  end: number;   // Hour (0-23), wraps around midnight if end < start
}

export interface DispatchConfig {
  chargeWindows: TimeWindow[];       // When to charge
  dischargeWindows: TimeWindow[];    // When to discharge
  allowGridCharging: boolean;        // Allow charging from grid (not just solar)
  peakShavingTarget?: number;        // kW target for peak shaving strategy
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
  batteryPower: number; // kW
  batteryMinSoC?: number; // Minimum state of charge (default 10%)
  batteryMaxSoC?: number; // Maximum state of charge (default 95%)
  batteryInitialSoC?: number; // Starting SoC (default 50%)
  dispatchStrategy?: BatteryDispatchStrategy;
  dispatchConfig?: DispatchConfig;
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
}

// ── Dispatch strategy implementations ──

interface HourState {
  load: number;
  solar: number;
  netLoad: number;
  batteryState: number;
  minBatteryLevel: number;
  maxBatteryLevel: number;
  batteryPower: number;
}

interface HourResult {
  gridImport: number;
  gridExport: number;
  solarUsed: number;
  batteryCharge: number;
  batteryDischarge: number;
  newBatteryState: number;
}

function dispatchSelfConsumption(s: HourState): HourResult {
  const { load, solar, netLoad, batteryState, minBatteryLevel, maxBatteryLevel, batteryPower } = s;
  let gridImport = 0;
  let gridExport = 0;
  const solarUsed = Math.min(solar, load);
  let batteryDischarge = 0;
  let batteryCharge = 0;
  let newBatteryState = batteryState;

  if (netLoad > 0) {
    // Load exceeds solar – discharge battery then import
    const batteryAvailable = Math.min(batteryState - minBatteryLevel, batteryPower);
    batteryDischarge = Math.min(netLoad, Math.max(0, batteryAvailable));
    newBatteryState -= batteryDischarge;
    gridImport = netLoad - batteryDischarge;
  } else {
    // Solar exceeds load – charge battery then export
    const excess = -netLoad;
    const batterySpace = Math.min(maxBatteryLevel - batteryState, batteryPower);
    batteryCharge = Math.min(excess, Math.max(0, batterySpace));
    newBatteryState += batteryCharge;
    gridExport = excess - batteryCharge;
  }

  return { gridImport, gridExport, solarUsed, batteryCharge, batteryDischarge, newBatteryState };
}

function dispatchTouArbitrage(s: HourState, hour: number, config: DispatchConfig): HourResult {
  const { load, solar, netLoad, batteryState, minBatteryLevel, maxBatteryLevel, batteryPower } = s;
  const isChargeHour = isInAnyWindow(hour, config.chargeWindows);
  const isDischargeHour = isInAnyWindow(hour, config.dischargeWindows);

  let gridImport = 0;
  let gridExport = 0;
  let solarUsed = Math.min(solar, load);
  let batteryCharge = 0;
  let batteryDischarge = 0;
  let newBatteryState = batteryState;

  if (isDischargeHour) {
    // Discharge to offset load (even if solar covers some)
    if (netLoad > 0) {
      const batteryAvailable = Math.min(batteryState - minBatteryLevel, batteryPower);
      batteryDischarge = Math.min(netLoad, Math.max(0, batteryAvailable));
      newBatteryState -= batteryDischarge;
      gridImport = netLoad - batteryDischarge;
    } else {
      // Solar excess during discharge window – export
      gridExport = -netLoad;
    }
  } else if (isChargeHour) {
    // First handle load from solar/grid
    if (netLoad > 0) {
      gridImport = netLoad;
    } else {
      // Use excess solar to charge first
      const excess = -netLoad;
      const batterySpace = Math.min(maxBatteryLevel - batteryState, batteryPower);
      batteryCharge = Math.min(excess, Math.max(0, batterySpace));
      newBatteryState += batteryCharge;
      gridExport = excess - batteryCharge;
    }
    // Charge from grid if allowed and battery has room
    if (config.allowGridCharging) {
      const batterySpace = Math.min(maxBatteryLevel - newBatteryState, batteryPower - batteryCharge);
      const gridCharge = Math.max(0, batterySpace);
      if (gridCharge > 0) {
        batteryCharge += gridCharge;
        gridImport += gridCharge;
        newBatteryState += gridCharge;
      }
    }
  } else {
    // Non-scheduled hours: fall back to self-consumption
    return dispatchSelfConsumption(s);
  }

  return { gridImport, gridExport, solarUsed, batteryCharge, batteryDischarge, newBatteryState };
}

function dispatchPeakShaving(s: HourState, hour: number, config: DispatchConfig): HourResult {
  const { load, solar, netLoad, batteryState, minBatteryLevel, maxBatteryLevel, batteryPower } = s;
  const target = config.peakShavingTarget ?? 150;
  const isChargeHour = config.chargeWindows.length > 0
    ? isInAnyWindow(hour, config.chargeWindows)
    : (hour >= 22 || hour < 6); // Default off-peak

  let gridImport = 0;
  let gridExport = 0;
  let solarUsed = Math.min(solar, load);
  let batteryCharge = 0;
  let batteryDischarge = 0;
  let newBatteryState = batteryState;

  if (netLoad > 0) {
    // Would-be grid import without battery
    const wouldImport = netLoad;
    if (wouldImport > target) {
      // Discharge to cap grid import at target
      const neededDischarge = wouldImport - target;
      const batteryAvailable = Math.min(batteryState - minBatteryLevel, batteryPower);
      batteryDischarge = Math.min(neededDischarge, Math.max(0, batteryAvailable));
      newBatteryState -= batteryDischarge;
      gridImport = wouldImport - batteryDischarge;
    } else {
      gridImport = wouldImport;
    }
  } else {
    // Solar excess – charge battery
    const excess = -netLoad;
    const batterySpace = Math.min(maxBatteryLevel - batteryState, batteryPower);
    batteryCharge = Math.min(excess, Math.max(0, batterySpace));
    newBatteryState += batteryCharge;
    gridExport = excess - batteryCharge;
  }

  // During charge hours, also charge from grid if allowed
  if (isChargeHour && config.allowGridCharging) {
    const batterySpace = Math.min(maxBatteryLevel - newBatteryState, batteryPower - batteryCharge);
    const gridCharge = Math.max(0, batterySpace);
    if (gridCharge > 0) {
      batteryCharge += gridCharge;
      gridImport += gridCharge;
      newBatteryState += gridCharge;
    }
  }

  return { gridImport, gridExport, solarUsed, batteryCharge, batteryDischarge, newBatteryState };
}

function dispatchScheduled(s: HourState, hour: number, config: DispatchConfig): HourResult {
  const { load, solar, netLoad, batteryState, minBatteryLevel, maxBatteryLevel, batteryPower } = s;
  const isChargeHour = isInAnyWindow(hour, config.chargeWindows);
  const isDischargeHour = isInAnyWindow(hour, config.dischargeWindows);

  // Same logic as TOU but with user-defined windows
  return dispatchTouArbitrage(s, hour, config);
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
    batteryMinSoC = 0.10,
    batteryMaxSoC = 0.95,
    batteryInitialSoC = 0.50,
    dispatchStrategy = 'self-consumption',
    dispatchConfig,
  } = config;

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

  for (let h = 0; h < 24; h++) {
    const load = loadProfile[h] || 0;
    const solar = solarProfile[h] || 0;
    const netLoad = load - solar;

    const hourState: HourState = {
      load, solar, netLoad, batteryState,
      minBatteryLevel, maxBatteryLevel, batteryPower,
    };

    let result: HourResult;
    switch (dispatchStrategy) {
      case 'tou-arbitrage':
        result = dispatchTouArbitrage(hourState, h, effectiveDispatchConfig);
        break;
      case 'peak-shaving':
        result = dispatchPeakShaving(hourState, h, effectiveDispatchConfig);
        break;
      case 'scheduled':
        result = dispatchScheduled(hourState, h, effectiveDispatchConfig);
        break;
      case 'self-consumption':
      default:
        result = dispatchSelfConsumption(hourState);
        break;
    }

    batteryState = result.newBatteryState;
    totalGridImport += result.gridImport;
    totalGridExport += result.gridExport;
    totalSolarUsed += result.solarUsed;
    totalBatteryCharge += result.batteryCharge;
    totalBatteryDischarge += result.batteryDischarge;

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

  return {
    hourlyData,
    totalDailyLoad,
    totalDailySolar,
    totalGridImport,
    totalGridExport,
    totalSolarUsed,
    totalBatteryCharge,
    totalBatteryDischarge,
    selfConsumptionRate,
    solarCoverageRate,
    peakLoad,
    peakGridImport,
    peakReduction,
    batteryCycles,
    batteryUtilization,
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
