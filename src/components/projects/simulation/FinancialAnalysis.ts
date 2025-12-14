/**
 * FinancialAnalysis - Tariff-based cost calculations
 * 
 * This module applies tariffs to energy simulation results:
 * - Grid cost calculations (with/without solar)
 * - Savings calculations
 * - System cost and payback
 * - ROI analysis
 */

import { EnergySimulationResults } from "./EnergySimulationEngine";

export interface TariffData {
  fixedMonthlyCharge: number; // R/month
  demandChargePerKva: number; // R/kVA
  networkAccessCharge: number; // R/month
  
  // Energy rates - can be simple average or TOU
  averageRatePerKwh: number; // R/kWh
  
  // Optional: Export tariff (feed-in)
  exportRatePerKwh?: number; // R/kWh for grid export
}

export interface SystemCosts {
  solarCostPerKwp: number; // R/kWp installed
  batteryCostPerKwh: number; // R/kWh capacity
  installationCost?: number; // Fixed R amount
  maintenancePerYear?: number; // R/year
}

export interface FinancialResults {
  // Grid-only scenario
  gridOnlyDailyCost: number;
  gridOnlyMonthlyCost: number;
  gridOnlyAnnualCost: number;
  
  // With solar+battery scenario
  solarDailyCost: number;
  solarMonthlyCost: number;
  solarAnnualCost: number;
  
  // Export revenue (if applicable)
  dailyExportRevenue: number;
  annualExportRevenue: number;
  
  // Savings
  dailySavings: number;
  monthlySavings: number;
  annualSavings: number;
  savingsPercentage: number;
  
  // Investment analysis
  systemCost: number;
  paybackYears: number;
  roi: number; // Annual ROI %
  npv?: number; // Net present value (if discount rate provided)
  
  // Cost breakdown
  gridOnlyEnergyCost: number;
  gridOnlyDemandCost: number;
  gridOnlyFixedCost: number;
  solarEnergyCost: number;
  solarDemandCost: number;
  solarFixedCost: number;
}

/**
 * Calculate financial results from energy simulation
 */
export function calculateFinancials(
  energyResults: EnergySimulationResults,
  tariff: TariffData,
  systemCosts: SystemCosts,
  solarCapacity: number, // kWp
  batteryCapacity: number // kWh
): FinancialResults {
  const {
    totalDailyLoad,
    totalGridImport,
    totalGridExport,
    peakLoad,
    peakGridImport,
  } = energyResults;

  const {
    fixedMonthlyCharge,
    demandChargePerKva,
    averageRatePerKwh,
    exportRatePerKwh = 0,
  } = tariff;

  const {
    solarCostPerKwp,
    batteryCostPerKwh,
    installationCost = 0,
    maintenancePerYear = 0,
  } = systemCosts;

  // Daily fixed cost (pro-rated)
  const dailyFixedCost = fixedMonthlyCharge / 30;

  // === Grid-only scenario ===
  const gridOnlyEnergyCost = totalDailyLoad * averageRatePerKwh;
  const gridOnlyDemandCost = peakLoad * demandChargePerKva;
  const gridOnlyFixedCost = dailyFixedCost;
  const gridOnlyDailyCost = gridOnlyEnergyCost + gridOnlyDemandCost + gridOnlyFixedCost;
  const gridOnlyMonthlyCost = gridOnlyDailyCost * 30;
  const gridOnlyAnnualCost = gridOnlyDailyCost * 365;

  // === With solar+battery scenario ===
  const solarEnergyCost = totalGridImport * averageRatePerKwh;
  const solarDemandCost = peakGridImport * demandChargePerKva;
  const solarFixedCost = dailyFixedCost; // Fixed charges typically remain
  const dailyExportRevenue = totalGridExport * exportRatePerKwh;
  
  const solarDailyCost = solarEnergyCost + solarDemandCost + solarFixedCost - dailyExportRevenue;
  const solarMonthlyCost = solarDailyCost * 30;
  const solarAnnualCost = solarDailyCost * 365;

  // === Savings ===
  const dailySavings = gridOnlyDailyCost - solarDailyCost;
  const monthlySavings = dailySavings * 30;
  const annualSavings = dailySavings * 365;
  const savingsPercentage = gridOnlyAnnualCost > 0 
    ? (annualSavings / gridOnlyAnnualCost) * 100 
    : 0;

  // === Investment analysis ===
  const systemCost = 
    (solarCapacity * solarCostPerKwp) + 
    (batteryCapacity * batteryCostPerKwh) + 
    installationCost;
  
  const netAnnualSavings = annualSavings - maintenancePerYear;
  const paybackYears = netAnnualSavings > 0 
    ? systemCost / netAnnualSavings 
    : Infinity;
  const roi = systemCost > 0 
    ? (netAnnualSavings / systemCost) * 100 
    : 0;

  return {
    // Grid-only
    gridOnlyDailyCost,
    gridOnlyMonthlyCost,
    gridOnlyAnnualCost,
    
    // With solar
    solarDailyCost,
    solarMonthlyCost,
    solarAnnualCost,
    
    // Export
    dailyExportRevenue,
    annualExportRevenue: dailyExportRevenue * 365,
    
    // Savings
    dailySavings,
    monthlySavings,
    annualSavings,
    savingsPercentage,
    
    // Investment
    systemCost,
    paybackYears,
    roi,
    
    // Breakdown
    gridOnlyEnergyCost,
    gridOnlyDemandCost,
    gridOnlyFixedCost,
    solarEnergyCost,
    solarDemandCost,
    solarFixedCost,
  };
}

/**
 * Compare multiple tariffs against same energy results
 */
export function compareTariffs(
  energyResults: EnergySimulationResults,
  tariffs: { name: string; tariff: TariffData }[],
  systemCosts: SystemCosts,
  solarCapacity: number,
  batteryCapacity: number
): { name: string; results: FinancialResults }[] {
  return tariffs.map(({ name, tariff }) => ({
    name,
    results: calculateFinancials(
      energyResults,
      tariff,
      systemCosts,
      solarCapacity,
      batteryCapacity
    ),
  }));
}

/**
 * Default system costs for South Africa (2024/2025)
 */
export const DEFAULT_SYSTEM_COSTS: SystemCosts = {
  solarCostPerKwp: 12000, // R12,000 per kWp installed
  batteryCostPerKwh: 8000, // R8,000 per kWh
  installationCost: 0, // Included in per-unit costs
  maintenancePerYear: 0, // Often minimal for first years
};
