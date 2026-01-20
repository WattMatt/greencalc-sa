/**
 * AdvancedSimulationEngine - Extended calculations for sophisticated modeling
 * 
 * Builds on EnergySimulationEngine to add:
 * - Multi-year projections with degradation
 * - Seasonal variations
 * - Grid constraints
 * - Load growth
 * - NPV/IRR calculations
 */

import { EnergySimulationResults } from "./EnergySimulationEngine";
import { TariffData, SystemCosts } from "./FinancialAnalysis";
import {
  AdvancedSimulationConfig,
  AdvancedFinancialResults,
  YearlyProjection,
  SensitivityResults,
  DegradationConfig,
  SeasonalConfig,
  GridConstraintsConfig,
  LoadGrowthConfig,
} from "./AdvancedSimulationTypes";

/**
 * Apply seasonal irradiance factor for a given month
 */
export function getSeasonalIrradianceFactor(
  month: number, // 0-indexed
  config: SeasonalConfig
): number {
  if (!config.enabled) return 1.0;
  return config.monthlyIrradianceFactors[month] ?? 1.0;
}

/**
 * Get load multiplier for a given month (High/Low demand season)
 */
export function getSeasonalLoadMultiplier(
  month: number,
  config: SeasonalConfig
): number {
  if (!config.enabled) return 1.0;
  
  const isHighDemand = config.highDemandMonths.includes(month);
  return isHighDemand 
    ? config.highDemandLoadMultiplier 
    : config.lowDemandLoadMultiplier;
}

/**
 * Calculate panel efficiency after degradation for a given year
 */
export function getPanelEfficiency(
  year: number,
  config: DegradationConfig
): number {
  if (!config.enabled) return 100;
  
  if (year === 1) {
    return 100 - config.panelFirstYearDegradation;
  }
  
  const subsequentDegradation = (year - 1) * config.panelDegradationRate;
  return 100 - config.panelFirstYearDegradation - subsequentDegradation;
}

/**
 * Calculate battery capacity remaining after degradation
 */
export function getBatteryCapacityRemaining(
  year: number,
  config: DegradationConfig
): number {
  if (!config.enabled) return 100;
  
  const degradation = year * config.batteryDegradationRate;
  const remaining = 100 - degradation;
  
  // Don't go below EOL capacity
  return Math.max(remaining, config.batteryEolCapacity);
}

/**
 * Apply grid export constraints to simulation results
 */
export function applyGridConstraints(
  hourlyExport: number[], // 24-hour export profile
  config: GridConstraintsConfig
): { constrainedExport: number[]; curtailment: number } {
  if (!config.enabled) {
    return { constrainedExport: hourlyExport, curtailment: 0 };
  }
  
  let totalCurtailment = 0;
  const constrainedExport = hourlyExport.map((exp, hour) => {
    let constrained = exp;
    
    // Apply maximum export limit
    if (config.exportLimitEnabled && exp > config.maxExportKw) {
      totalCurtailment += exp - config.maxExportKw;
      constrained = config.maxExportKw;
    }
    
    // Apply time-based restrictions
    if (config.exportRestrictionsEnabled && 
        config.exportRestrictedHours.includes(hour)) {
      totalCurtailment += constrained;
      constrained = 0;
    }
    
    return constrained;
  });
  
  return { constrainedExport, curtailment: totalCurtailment };
}

/**
 * Calculate load for a given year with growth
 */
export function getYearlyLoad(
  baseAnnualLoad: number,
  year: number,
  config: LoadGrowthConfig
): number {
  if (!config.enabled) return baseAnnualLoad;
  
  // Apply annual growth
  const growthMultiplier = Math.pow(1 + config.annualGrowthRate / 100, year - 1);
  let yearlyLoad = baseAnnualLoad * growthMultiplier;
  
  // Add new tenant load if applicable
  if (config.newTenantEnabled && year >= config.newTenantYear) {
    yearlyLoad += config.newTenantLoadKwh * 12; // Convert monthly to annual
  }
  
  return yearlyLoad;
}

/**
 * Calculate escalated tariff rate for a given year
 */
export function getEscalatedTariff(
  baseRate: number,
  year: number,
  escalationRate: number
): number {
  return baseRate * Math.pow(1 + escalationRate / 100, year - 1);
}

/**
 * Calculate NPV from cash flows
 */
export function calculateNPV(
  cashFlows: number[],
  discountRate: number
): number {
  return cashFlows.reduce((npv, cf, year) => {
    const discountFactor = Math.pow(1 + discountRate / 100, year);
    return npv + cf / discountFactor;
  }, 0);
}

/**
 * Calculate IRR using Newton-Raphson method
 */
export function calculateIRR(
  cashFlows: number[],
  maxIterations: number = 100,
  tolerance: number = 0.0001
): number {
  let irr = 0.1; // Initial guess: 10%
  
  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let derivative = 0;
    
    for (let t = 0; t < cashFlows.length; t++) {
      const factor = Math.pow(1 + irr, t);
      npv += cashFlows[t] / factor;
      if (t > 0) {
        derivative -= t * cashFlows[t] / Math.pow(1 + irr, t + 1);
      }
    }
    
    if (Math.abs(npv) < tolerance) break;
    if (Math.abs(derivative) < 0.000001) break;
    
    irr = irr - npv / derivative;
    
    // Bound IRR to reasonable range
    if (irr < -0.99) irr = -0.99;
    if (irr > 5) irr = 5;
  }
  
  return irr * 100;
}

/**
 * Calculate MIRR (Modified Internal Rate of Return)
 * Uses separate finance rate for negative cash flows and reinvestment rate for positive cash flows
 */
export function calculateMIRR(
  cashFlows: number[],
  financeRate: number,      // Interest rate paid on money used in cash flows
  reinvestmentRate: number  // Interest rate received on reinvestment
): number {
  const n = cashFlows.length - 1;
  if (n <= 0) return 0;
  
  // Present value of negative cash flows at finance rate
  let pvNegative = 0;
  for (let t = 0; t < cashFlows.length; t++) {
    if (cashFlows[t] < 0) {
      pvNegative += cashFlows[t] / Math.pow(1 + financeRate / 100, t);
    }
  }
  
  // Future value of positive cash flows at reinvestment rate
  let fvPositive = 0;
  for (let t = 0; t < cashFlows.length; t++) {
    if (cashFlows[t] > 0) {
      fvPositive += cashFlows[t] * Math.pow(1 + reinvestmentRate / 100, n - t);
    }
  }
  
  // MIRR formula: (FV of positive / |PV of negative|)^(1/n) - 1
  if (pvNegative === 0 || fvPositive === 0) return 0;
  
  const mirr = Math.pow(-fvPositive / pvNegative, 1 / n) - 1;
  
  return mirr * 100;
}

/**
 * Calculate LCOE (Levelized Cost of Energy)
 */
export function calculateLCOE(
  totalSystemCost: number,
  yearlyGenerations: number[],
  yearlyMaintenanceCosts: number[],
  discountRate: number
): number {
  let discountedCosts = totalSystemCost;
  let discountedEnergy = 0;
  
  for (let year = 0; year < yearlyGenerations.length; year++) {
    const discountFactor = Math.pow(1 + discountRate / 100, year + 1);
    discountedCosts += yearlyMaintenanceCosts[year] / discountFactor;
    discountedEnergy += yearlyGenerations[year] / discountFactor;
  }
  
  return discountedEnergy > 0 ? discountedCosts / discountedEnergy : 0;
}

/**
 * Run advanced multi-year simulation
 */
export function runAdvancedSimulation(
  baseEnergyResults: EnergySimulationResults,
  tariff: TariffData,
  systemCosts: SystemCosts,
  solarCapacity: number,
  batteryCapacity: number,
  advancedConfig: AdvancedSimulationConfig
): AdvancedFinancialResults {
  const { financial, degradation, loadGrowth, gridConstraints } = advancedConfig;
  
  const lifetimeYears = financial.enabled 
    ? financial.projectLifetimeYears 
    : 25;
  
  const baseAnnualLoad = baseEnergyResults.totalDailyLoad * 365;
  const baseAnnualSolar = baseEnergyResults.totalDailySolar * 365;
  const baseAnnualGridImport = baseEnergyResults.totalGridImport * 365;
  const baseAnnualGridExport = baseEnergyResults.totalGridExport * 365;
  
  // Calculate initial system cost
  const initialCost = 
    solarCapacity * systemCosts.solarCostPerKwp +
    batteryCapacity * systemCosts.batteryCostPerKwh;
  
  const yearlyProjections: YearlyProjection[] = [];
  const cashFlows: number[] = [-initialCost]; // Year 0 is investment
  const yearlyGenerations: number[] = [];
  const yearlyMaintenanceCosts: number[] = [];
  
  let cumulativeCashFlow = -initialCost;
  let lifetimeSavings = 0;
  let lifetimeGeneration = 0;
  
  for (let year = 1; year <= lifetimeYears; year++) {
    // Calculate degraded generation
    const panelEfficiency = getPanelEfficiency(year, degradation);
    const batteryRemaining = getBatteryCapacityRemaining(year, degradation);
    
    const yearlyGeneration = baseAnnualSolar * (panelEfficiency / 100);
    
    // Calculate load with growth
    const yearlyLoad = getYearlyLoad(baseAnnualLoad, year, loadGrowth);
    
    // Scale grid import/export proportionally
    const loadGrowthFactor = yearlyLoad / baseAnnualLoad;
    const generationFactor = panelEfficiency / 100;
    
    // Simplified: assume import increases and export decreases with degradation
    let yearlyGridImport = baseAnnualGridImport * loadGrowthFactor / generationFactor;
    let yearlyGridExport = baseAnnualGridExport * generationFactor;
    
    // Apply grid constraints (simplified - just reduce export)
    if (gridConstraints.enabled && gridConstraints.exportLimitEnabled) {
      const maxAnnualExport = gridConstraints.maxExportKw * 365 * 5; // Rough estimate
      if (yearlyGridExport > maxAnnualExport) {
        yearlyGridExport = maxAnnualExport;
      }
    }
    
    // Calculate financials
    const escalatedTariff = financial.enabled
      ? getEscalatedTariff(tariff.averageRatePerKwh, year, financial.tariffEscalationRate)
      : tariff.averageRatePerKwh;
    
    // Grid-only cost (what they would pay without solar)
    const gridOnlyCost = yearlyLoad * escalatedTariff + tariff.fixedMonthlyCharge * 12;
    
    // Solar cost (import + fixed - export revenue)
    const exportRate = tariff.exportRatePerKwh ?? 0;
    const wheelingCost = gridConstraints.enabled && gridConstraints.wheelingEnabled
      ? yearlyGridExport * gridConstraints.wheelingChargePerKwh
      : 0;
    
    const solarCost = 
      yearlyGridImport * escalatedTariff + 
      tariff.fixedMonthlyCharge * 12 -
      yearlyGridExport * exportRate +
      wheelingCost;
    
    const energySavings = gridOnlyCost - solarCost;
    
    // Maintenance cost (inflation adjusted)
    const maintenanceCost = financial.enabled
      ? (systemCosts.maintenancePerYear ?? 0) * Math.pow(1 + financial.inflationRate / 100, year - 1)
      : (systemCosts.maintenancePerYear ?? 0);
    
    // Replacement costs
    let replacementCost = 0;
    if (degradation.enabled && year === degradation.inverterReplacementYear) {
      replacementCost = degradation.inverterReplacementCost;
    }
    
    // Net cash flow
    const netCashFlow = energySavings - maintenanceCost - replacementCost;
    cumulativeCashFlow += netCashFlow;
    
    // Discounted cash flow
    const discountedCashFlow = financial.enabled
      ? netCashFlow / Math.pow(1 + financial.discountRate / 100, year)
      : netCashFlow;
    
    yearlyProjections.push({
      year,
      solarGeneration: yearlyGeneration,
      loadConsumption: yearlyLoad,
      gridImport: yearlyGridImport,
      gridExport: yearlyGridExport,
      panelEfficiency,
      batteryCapacityRemaining: batteryRemaining,
      tariffRate: escalatedTariff,
      energySavings,
      maintenanceCost,
      replacementCost,
      netCashFlow,
      cumulativeCashFlow,
      discountedCashFlow,
    });
    
    cashFlows.push(netCashFlow);
    yearlyGenerations.push(yearlyGeneration);
    yearlyMaintenanceCosts.push(maintenanceCost);
    lifetimeSavings += energySavings;
    lifetimeGeneration += yearlyGeneration;
  }
  
  // Calculate summary metrics using systemCosts financial parameters
  const discountRate = systemCosts.lcoeDiscountRate ?? (financial.enabled ? financial.discountRate : 10);
  const npv = calculateNPV(cashFlows, discountRate);
  const irr = calculateIRR(cashFlows);
  
  // Calculate true MIRR using finance and reinvestment rates from systemCosts
  const mirrFinanceRate = systemCosts.mirrFinanceRate ?? 9;
  const mirrReinvestmentRate = systemCosts.mirrReinvestmentRate ?? 10;
  const mirr = calculateMIRR(cashFlows, mirrFinanceRate, mirrReinvestmentRate);
  
  const lcoe = calculateLCOE(
    initialCost,
    yearlyGenerations,
    yearlyMaintenanceCosts,
    discountRate
  );
  
  // Calculate sensitivity if enabled
  let sensitivityResults: SensitivityResults | undefined;
  
  if (financial.enabled && financial.sensitivityEnabled) {
    const variation = financial.sensitivityVariation / 100;
    
    // Best case: higher tariff escalation, lower degradation
    const bestCashFlows = [-initialCost];
    // Worst case: lower tariff escalation, higher degradation
    const worstCashFlows = [-initialCost];
    
    for (let year = 1; year <= lifetimeYears; year++) {
      const baseProjection = yearlyProjections[year - 1];
      
      // Best case adjustments
      const bestSavings = baseProjection.energySavings * (1 + variation);
      const bestMaintenance = baseProjection.maintenanceCost * (1 - variation * 0.5);
      bestCashFlows.push(bestSavings - bestMaintenance - baseProjection.replacementCost);
      
      // Worst case adjustments
      const worstSavings = baseProjection.energySavings * (1 - variation);
      const worstMaintenance = baseProjection.maintenanceCost * (1 + variation);
      worstCashFlows.push(worstSavings - worstMaintenance - baseProjection.replacementCost);
    }
    
    sensitivityResults = {
      expected: {
        npv,
        irr,
        payback: calculatePayback(yearlyProjections),
      },
      best: {
        npv: calculateNPV(bestCashFlows, financial.discountRate),
        irr: calculateIRR(bestCashFlows),
        payback: calculatePayback(yearlyProjections) * (1 - variation * 0.5),
        assumptions: `+${financial.sensitivityVariation}% savings, -${financial.sensitivityVariation/2}% maintenance`,
      },
      worst: {
        npv: calculateNPV(worstCashFlows, financial.discountRate),
        irr: calculateIRR(worstCashFlows),
        payback: calculatePayback(yearlyProjections) * (1 + variation),
        assumptions: `-${financial.sensitivityVariation}% savings, +${financial.sensitivityVariation}% maintenance`,
      },
    };
  }
  
  return {
    npv,
    irr,
    mirr,
    lcoe,
    yearlyProjections,
    lifetimeSavings,
    lifetimeGeneration,
    sensitivityResults,
  };
}

/**
 * Calculate payback period from yearly projections
 */
function calculatePayback(projections: YearlyProjection[]): number {
  const breakeven = projections.find(p => p.cumulativeCashFlow >= 0);
  if (!breakeven) return projections.length + 1;
  
  // Interpolate for more accurate payback
  const prevYear = projections[breakeven.year - 2];
  if (!prevYear) return breakeven.year;
  
  const remaining = Math.abs(prevYear.cumulativeCashFlow);
  const fraction = remaining / breakeven.netCashFlow;
  
  return breakeven.year - 1 + fraction;
}
