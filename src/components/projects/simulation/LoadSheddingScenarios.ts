/**
 * LoadSheddingScenarios - South African load shedding stage modeling (Stage 0-8)
 * 
 * Each stage represents different hours of grid outages per day:
 * - Stage 0: No load shedding
 * - Stage 1: 2.5 hours/day
 * - Stage 2: 4 hours/day
 * - Stage 3: 6 hours/day
 * - Stage 4: 8 hours/day
 * - Stage 5: 10 hours/day
 * - Stage 6: 12 hours/day
 * - Stage 7: 14 hours/day
 * - Stage 8: 16 hours/day (worst case)
 */

import { EnergySimulationConfig, EnergySimulationResults, runEnergySimulation } from "./EnergySimulationEngine";

export interface LoadSheddingStage {
  stage: number;
  name: string;
  hoursPerDay: number;
  description: string;
}

export interface LoadSheddingScenarioResult {
  stage: number;
  stageName: string;
  hoursPerDay: number;
  
  // Energy metrics (daily)
  dailyLoad: number;
  dailySolar: number;
  dailyGridImport: number;
  dailyGridExport: number;
  dailySolarUsed: number;
  dailyBatteryDischarge: number;
  
  // Load shedding impact
  unmetLoadDuringOutage: number; // kWh that couldn't be served during outages
  loadServedDuringOutage: number; // kWh served by solar/battery during outages
  outageProtectionRate: number; // % of outage load covered
  
  // Annual projections
  annualSolar: number;
  annualGridImport: number;
  annualGridExport: number;
  annualSolarUsed: number;
  annualLoadShedHours: number;
  annualUnmetLoad: number;
  
  // Financial impact (annual)
  annualSavings: number;
  gridOnlyCost: number;
  solarSystemCost: number;
  additionalSavingsFromBackup: number; // Extra value from having power during outages
  
  // Yield metrics
  selfConsumptionRate: number;
  solarCoverageRate: number;
  specificYield: number; // kWh/kWp
}

export interface LoadSheddingAnalysisResult {
  scenarios: LoadSheddingScenarioResult[];
  systemConfig: {
    solarCapacity: number;
    batteryCapacity: number;
    batteryPower: number;
  };
  baselineComparison: {
    stage0Savings: number;
    stage4Savings: number;
    stage8Savings: number;
    maxSavingsIncrease: number; // % increase from stage 0 to stage 8
  };
  recommendations: string[];
}

// Define all load shedding stages
export const LOAD_SHEDDING_STAGES: LoadSheddingStage[] = [
  { stage: 0, name: "Stage 0", hoursPerDay: 0, description: "No load shedding" },
  { stage: 1, name: "Stage 1", hoursPerDay: 2.5, description: "2.5 hours outage per day" },
  { stage: 2, name: "Stage 2", hoursPerDay: 4, description: "4 hours outage per day" },
  { stage: 3, name: "Stage 3", hoursPerDay: 6, description: "6 hours outage per day" },
  { stage: 4, name: "Stage 4", hoursPerDay: 8, description: "8 hours outage per day" },
  { stage: 5, name: "Stage 5", hoursPerDay: 10, description: "10 hours outage per day" },
  { stage: 6, name: "Stage 6", hoursPerDay: 12, description: "12 hours outage per day" },
  { stage: 7, name: "Stage 7", hoursPerDay: 14, description: "14 hours outage per day" },
  { stage: 8, name: "Stage 8", hoursPerDay: 16, description: "16 hours outage per day (worst case)" },
];

// Typical load shedding schedule hours (Eskom pattern)
const TYPICAL_OUTAGE_HOURS: Record<number, number[]> = {
  0: [],
  1: [6, 14], // 2 slots: morning and afternoon
  2: [6, 7, 14, 15], // 4 slots
  3: [6, 7, 10, 14, 15, 18], // 6 slots
  4: [6, 7, 10, 11, 14, 15, 18, 19], // 8 slots
  5: [6, 7, 10, 11, 14, 15, 18, 19, 22, 23], // 10 slots
  6: [6, 7, 8, 10, 11, 12, 14, 15, 16, 18, 19, 20], // 12 slots
  7: [6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 18, 19, 20, 22], // 14 slots
  8: [0, 2, 6, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19, 20, 22], // 16 slots
};

/**
 * Get which hours have grid outage for a given load shedding stage
 */
export function getOutageHours(stage: number): number[] {
  return TYPICAL_OUTAGE_HOURS[stage] || [];
}

/**
 * Simulate energy flow during load shedding scenario
 * During outages, grid import is blocked - only solar and battery can serve load
 */
function simulateWithLoadShedding(
  loadProfile: number[],
  solarProfile: number[],
  config: EnergySimulationConfig,
  outageHours: number[]
): {
  results: EnergySimulationResults;
  unmetLoad: number;
  loadServedDuringOutage: number;
} {
  const {
    batteryCapacity,
    batteryPower,
    batteryMinSoC = 0.10,
    batteryMaxSoC = 0.95,
    batteryInitialSoC = 0.50,
  } = config;

  let batteryState = batteryCapacity * batteryInitialSoC;
  const minBatteryLevel = batteryCapacity * batteryMinSoC;
  const maxBatteryLevel = batteryCapacity * batteryMaxSoC;

  let totalGridImport = 0;
  let totalGridExport = 0;
  let totalSolarUsed = 0;
  let totalBatteryCharge = 0;
  let totalBatteryDischarge = 0;
  let unmetLoad = 0;
  let loadServedDuringOutage = 0;

  const hourlyData: EnergySimulationResults["hourlyData"] = [];

  for (let h = 0; h < 24; h++) {
    const load = loadProfile[h] || 0;
    const solar = solarProfile[h] || 0;
    const isOutage = outageHours.includes(h);
    const netLoad = load - solar;

    let gridImport = 0;
    let gridExport = 0;
    let solarUsed = Math.min(solar, load);
    let batteryDischarge = 0;
    let batteryCharge = 0;

    if (netLoad > 0) {
      // Load exceeds solar
      const batteryAvailable = Math.min(
        batteryState - minBatteryLevel,
        batteryPower
      );
      batteryDischarge = Math.min(netLoad, Math.max(0, batteryAvailable));
      batteryState -= batteryDischarge;
      totalBatteryDischarge += batteryDischarge;

      const remainingDeficit = netLoad - batteryDischarge;

      if (isOutage) {
        // During outage, can't import from grid
        unmetLoad += remainingDeficit;
        loadServedDuringOutage += solarUsed + batteryDischarge;
      } else {
        gridImport = remainingDeficit;
        totalGridImport += gridImport;
      }
    } else {
      // Solar exceeds load
      const excess = -netLoad;
      const batterySpace = Math.min(
        maxBatteryLevel - batteryState,
        batteryPower
      );
      
      // During outages, prioritize battery charging for later use
      if (isOutage) {
        batteryCharge = Math.min(excess, Math.max(0, batterySpace));
        batteryState += batteryCharge;
        totalBatteryCharge += batteryCharge;
        loadServedDuringOutage += solarUsed;
        // Can't export during outage - excess is curtailed (not counted)
      } else {
        batteryCharge = Math.min(excess, Math.max(0, batterySpace));
        batteryState += batteryCharge;
        totalBatteryCharge += batteryCharge;
        gridExport = excess - batteryCharge;
        totalGridExport += gridExport;
      }
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

  const totalDailyLoad = loadProfile.reduce((a, b) => a + b, 0);
  const totalDailySolar = solarProfile.reduce((a, b) => a + b, 0);
  const peakLoad = Math.max(...loadProfile);
  const peakGridImport = Math.max(...hourlyData.map(d => d.gridImport));

  const selfConsumptionRate = totalDailySolar > 0
    ? (totalSolarUsed / totalDailySolar) * 100
    : 0;

  const solarCoverageRate = totalDailyLoad > 0
    ? ((totalSolarUsed + totalBatteryDischarge) / totalDailyLoad) * 100
    : 0;

  const peakReduction = peakLoad > 0
    ? ((peakLoad - peakGridImport) / peakLoad) * 100
    : 0;

  const batteryCycles = batteryCapacity > 0
    ? totalBatteryDischarge / batteryCapacity
    : 0;

  const batteryUtilization = batteryCapacity > 0
    ? ((totalBatteryCharge + totalBatteryDischarge) / 2 / batteryCapacity) * 100
    : 0;

  return {
    results: {
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
    },
    unmetLoad,
    loadServedDuringOutage,
  };
}

/**
 * Run load shedding scenario analysis for all stages
 */
export function runLoadSheddingAnalysis(
  loadProfile: number[],
  solarProfile: number[],
  config: EnergySimulationConfig,
  tariffRate: number = 2.50, // R/kWh average
  backupValueRate: number = 5.00 // R/kWh value of having power during outages
): LoadSheddingAnalysisResult {
  const scenarios: LoadSheddingScenarioResult[] = [];

  for (const stage of LOAD_SHEDDING_STAGES) {
    const outageHours = getOutageHours(stage.stage);
    
    const { results, unmetLoad, loadServedDuringOutage } = simulateWithLoadShedding(
      loadProfile,
      solarProfile,
      config,
      outageHours
    );

    // Calculate outage protection
    const totalOutageLoad = outageHours.reduce((sum, h) => sum + (loadProfile[h] || 0), 0);
    const outageProtectionRate = totalOutageLoad > 0
      ? (loadServedDuringOutage / totalOutageLoad) * 100
      : 100;

    // Annual projections
    const annualSolar = results.totalDailySolar * 365;
    const annualGridImport = results.totalGridImport * 365;
    const annualGridExport = results.totalGridExport * 365;
    const annualSolarUsed = results.totalSolarUsed * 365;
    const annualLoadShedHours = stage.hoursPerDay * 365;
    const annualUnmetLoad = unmetLoad * 365;

    // Financial calculations
    const gridOnlyCost = results.totalDailyLoad * 365 * tariffRate;
    const solarSystemCost = annualGridImport * tariffRate;
    const annualSavings = gridOnlyCost - solarSystemCost;
    
    // Additional value from backup power during outages
    const additionalSavingsFromBackup = loadServedDuringOutage * 365 * (backupValueRate - tariffRate);

    // Yield metrics
    const specificYield = config.solarCapacity > 0
      ? annualSolar / config.solarCapacity
      : 0;

    scenarios.push({
      stage: stage.stage,
      stageName: stage.name,
      hoursPerDay: stage.hoursPerDay,
      dailyLoad: results.totalDailyLoad,
      dailySolar: results.totalDailySolar,
      dailyGridImport: results.totalGridImport,
      dailyGridExport: results.totalGridExport,
      dailySolarUsed: results.totalSolarUsed,
      dailyBatteryDischarge: results.totalBatteryDischarge,
      unmetLoadDuringOutage: unmetLoad,
      loadServedDuringOutage,
      outageProtectionRate,
      annualSolar,
      annualGridImport,
      annualGridExport,
      annualSolarUsed,
      annualLoadShedHours,
      annualUnmetLoad,
      annualSavings,
      gridOnlyCost,
      solarSystemCost,
      additionalSavingsFromBackup,
      selfConsumptionRate: results.selfConsumptionRate,
      solarCoverageRate: results.solarCoverageRate,
      specificYield,
    });
  }

  // Calculate baseline comparison
  const stage0 = scenarios.find(s => s.stage === 0)!;
  const stage4 = scenarios.find(s => s.stage === 4)!;
  const stage8 = scenarios.find(s => s.stage === 8)!;

  const maxSavingsIncrease = stage0.annualSavings > 0
    ? ((stage8.annualSavings + stage8.additionalSavingsFromBackup - stage0.annualSavings) / stage0.annualSavings) * 100
    : 0;

  // Generate recommendations
  const recommendations = generateRecommendations(scenarios, config);

  return {
    scenarios,
    systemConfig: {
      solarCapacity: config.solarCapacity,
      batteryCapacity: config.batteryCapacity,
      batteryPower: config.batteryPower,
    },
    baselineComparison: {
      stage0Savings: stage0.annualSavings,
      stage4Savings: stage4.annualSavings + stage4.additionalSavingsFromBackup,
      stage8Savings: stage8.annualSavings + stage8.additionalSavingsFromBackup,
      maxSavingsIncrease,
    },
    recommendations,
  };
}

/**
 * Generate recommendations based on scenario analysis
 */
function generateRecommendations(
  scenarios: LoadSheddingScenarioResult[],
  config: EnergySimulationConfig
): string[] {
  const recommendations: string[] = [];
  const stage4 = scenarios.find(s => s.stage === 4)!;
  const stage6 = scenarios.find(s => s.stage === 6)!;

  // Battery sizing recommendation
  if (stage4.outageProtectionRate < 80 && config.batteryCapacity > 0) {
    recommendations.push(
      `Consider increasing battery capacity. Current system provides only ${stage4.outageProtectionRate.toFixed(0)}% outage protection at Stage 4.`
    );
  }

  if (config.batteryCapacity === 0) {
    recommendations.push(
      `Adding battery storage would provide backup power during load shedding. At Stage 4, ${stage4.unmetLoadDuringOutage.toFixed(1)} kWh daily would go unserved.`
    );
  }

  // Solar sizing recommendation
  if (stage6.solarCoverageRate < 50) {
    recommendations.push(
      `Solar coverage is ${stage6.solarCoverageRate.toFixed(0)}% at Stage 6. Consider increasing solar capacity for better grid independence.`
    );
  }

  // ROI recommendation
  if (stage4.additionalSavingsFromBackup > stage4.annualSavings * 0.2) {
    recommendations.push(
      `Backup power value adds significant ROI. At Stage 4, backup value is R${stage4.additionalSavingsFromBackup.toFixed(0)}/year additional.`
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "System is well-sized for current load shedding scenarios."
    );
  }

  return recommendations;
}

/**
 * Get a specific stage's analysis result
 */
export function getStageAnalysis(
  analysis: LoadSheddingAnalysisResult,
  stage: number
): LoadSheddingScenarioResult | undefined {
  return analysis.scenarios.find(s => s.stage === stage);
}

/**
 * Calculate the break-even load shedding stage where solar+battery ROI is maximized
 */
export function getOptimalStage(analysis: LoadSheddingAnalysisResult): number {
  let maxValue = 0;
  let optimalStage = 0;

  for (const scenario of analysis.scenarios) {
    const totalValue = scenario.annualSavings + scenario.additionalSavingsFromBackup;
    if (totalValue > maxValue) {
      maxValue = totalValue;
      optimalStage = scenario.stage;
    }
  }

  return optimalStage;
}
