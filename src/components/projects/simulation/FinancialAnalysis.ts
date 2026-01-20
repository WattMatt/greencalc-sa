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
  // 2025/2026 Unbundled Structure
  fixedMonthlyCharge: number; // R/month - Retail/Service charge
  demandChargePerKva: number; // R/kVA - Network demand charge
  networkAccessCharge: number; // R/month - Distribution access
  
  // NEW: Generation Capacity Charge (GCC) - unbundled from energy
  generationCapacityCharge?: number; // R/kVA/month or R/POD/day
  transmissionCharge?: number; // R/kVA/month - for MV/HV customers
  
  // Energy rates - can be simple average or TOU
  averageRatePerKwh: number; // R/kWh - Legacy energy charge
  
  // Optional: Export tariff (feed-in / Gen-offset)
  exportRatePerKwh?: number; // R/kWh for grid export (WEPS-based credit)
  
  // Reactive energy for power factor penalty
  reactiveEnergyCharge?: number; // R/kVArh
}

export interface SystemCosts {
  solarCostPerKwp: number; // R/kWp installed (includes installation)
  batteryCostPerKwh: number; // R/kWh capacity
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
    maintenancePerYear = 0,
  } = systemCosts;

  // Daily fixed cost (pro-rated)
  const dailyFixedCost = fixedMonthlyCharge / 30;

  // === Grid-only scenario ===
  // Energy costs are daily (kWh × R/kWh)
  const gridOnlyEnergyCost = totalDailyLoad * averageRatePerKwh;
  // Demand charges are MONTHLY (kVA × R/kVA/month), pro-rated daily
  // Note: Peak load in kW, assuming power factor ~0.9 for kVA conversion
  const powerFactor = 0.9;
  const peakLoadKva = peakLoad / powerFactor;
  const gridOnlyDemandCost = (peakLoadKva * demandChargePerKva) / 30; // Pro-rate monthly charge to daily
  const gridOnlyFixedCost = dailyFixedCost;
  const gridOnlyDailyCost = gridOnlyEnergyCost + gridOnlyDemandCost + gridOnlyFixedCost;
  const gridOnlyMonthlyCost = gridOnlyDailyCost * 30;
  const gridOnlyAnnualCost = gridOnlyDailyCost * 365;

  // === With solar+battery scenario ===
  const solarEnergyCost = totalGridImport * averageRatePerKwh;
  // Reduced peak demand with solar (pro-rated monthly charge)
  const peakGridImportKva = peakGridImport / powerFactor;
  const solarDemandCost = (peakGridImportKva * demandChargePerKva) / 30; // Pro-rate monthly charge to daily
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
    (batteryCapacity * batteryCostPerKwh);
  
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
 * Default system costs for South Africa (2025/2026)
 * Updated to reflect current market pricing
 */
export const DEFAULT_SYSTEM_COSTS: SystemCosts = {
  solarCostPerKwp: 11000, // R11,000 per kWp installed (includes installation)
  batteryCostPerKwh: 7500, // R7,500 per kWh (LFP battery costs declining)
  maintenancePerYear: 0, // Often minimal for first years
};

/**
 * Eskom 2025/2026 Tariff Reference
 * All tariffs except Homelight are unbundled with separate GCC
 */
export const ESKOM_TARIFF_CATEGORIES = {
  // Urban Large Power Users (NMD > 1 MVA)
  LPU: ['Megaflex', 'Miniflex', 'Nightsave Urban'],
  // Urban Small Power Users (up to 100kVA)
  SPU: ['Businessrate', 'Public Lighting'],
  // Residential
  RESIDENTIAL: ['Homepower', 'Homeflex', 'Homelight'],
  // Rural & Agricultural
  RURAL: ['Ruraflex', 'Landrate', 'Landlight', 'Nightsave Rural'],
  // Municipal (Consolidated for 2025/2026)
  MUNICIPAL: ['Municflex', 'Municrate'],
  // Generator & Wheeling
  GENERATOR: ['Gen-wheeling', 'Gen-offset', 'WEPS', 'Transflex'],
} as const;
