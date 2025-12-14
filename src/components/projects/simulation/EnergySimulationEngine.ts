/**
 * EnergySimulationEngine - Pure energy flow simulation (tariff-independent)
 * 
 * This module handles all kWh calculations:
 * - Solar generation profiles
 * - Battery charge/discharge cycles
 * - Grid import/export quantities
 * - Self-consumption calculations
 */

export interface EnergySimulationConfig {
  solarCapacity: number; // kWp
  batteryCapacity: number; // kWh
  batteryPower: number; // kW
  batteryMinSoC?: number; // Minimum state of charge (default 10%)
  batteryMaxSoC?: number; // Maximum state of charge (default 95%)
  batteryInitialSoC?: number; // Starting SoC (default 50%)
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

/**
 * Run energy simulation with given load and solar profiles
 * This is pure energy flow - no tariff or cost calculations
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
  } = config;

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
    
    let gridImport = 0;
    let gridExport = 0;
    let solarUsed = Math.min(solar, load);
    let batteryDischarge = 0;
    let batteryCharge = 0;

    if (netLoad > 0) {
      // Load exceeds solar - need battery or grid
      const batteryAvailable = Math.min(
        batteryState - minBatteryLevel, // Respect min SoC
        batteryPower // Respect power limit
      );
      batteryDischarge = Math.min(netLoad, Math.max(0, batteryAvailable));
      batteryState -= batteryDischarge;
      totalBatteryDischarge += batteryDischarge;
      
      gridImport = netLoad - batteryDischarge;
      totalGridImport += gridImport;
    } else {
      // Solar exceeds load - charge battery or export
      const excess = -netLoad;
      const batterySpace = Math.min(
        maxBatteryLevel - batteryState, // Respect max SoC
        batteryPower // Respect power limit
      );
      batteryCharge = Math.min(excess, Math.max(0, batterySpace));
      batteryState += batteryCharge;
      totalBatteryCharge += batteryCharge;
      
      gridExport = excess - batteryCharge;
      totalGridExport += gridExport;
    }

    totalSolarUsed += solarUsed;

    hourlyData.push({
      hour: `${h.toString().padStart(2, "0")}:00`,
      load,
      solar,
      gridImport,
      gridExport,
      solarUsed,
      batteryCharge,
      batteryDischarge,
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
