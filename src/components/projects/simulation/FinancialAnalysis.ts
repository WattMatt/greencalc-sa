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
import { calculateTotalSystemCost } from "@/utils/simulationConfig";

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
  solarMaintenancePercentage?: number; // Percentage of solar cost (e.g., 3.5 = 3.5%)
  batteryMaintenancePercentage?: number; // Percentage of battery cost (e.g., 1.5 = 1.5%)
  maintenancePerYear?: number; // R/year - calculated from both percentages
  
  // Additional Fixed Costs (Rand values)
  healthAndSafetyCost?: number;        // Health and Safety Consultant
  waterPointsCost?: number;            // Water Points
  cctvCost?: number;                   // CCTV
  mvSwitchGearCost?: number;           // MV Switch Gear
  
  // Insurance Costs (NEW: Income-based model alignment)
  insuranceCostPerYear?: number;       // Annual insurance cost (R) - calculated from percentage
  insuranceRatePercent?: number;       // % of (Total Capital + O&M) for annual insurance (default: 1.0)
  
  // Percentage-based Fees (% of project subtotal)
  professionalFeesPercent?: number;    // Professional Fees %
  projectManagementPercent?: number;   // Project Management Fees %
  contingencyPercent?: number;         // Project Contingency %
  
  // Replacement Costs (Year 10)
  replacementYear?: number;                    // Year for replacement (default: 10)
  equipmentCostPercent?: number;               // % of solar cost that is equipment (default: 45%)
  moduleSharePercent?: number;                 // % of equipment that is modules (default: 70%)
  inverterSharePercent?: number;               // % of equipment that is inverters (default: 30%)
  solarModuleReplacementPercent?: number;      // % of module cost to replace (default: 10%)
  inverterReplacementPercent?: number;         // % of inverter cost to replace (default: 50%)
  batteryReplacementPercent?: number;          // % of battery cost to replace (default: 30%)
  
  // Financial Return Parameters
  costOfCapital?: number;           // % - General WACC (default: 9)
  cpi?: number;                     // % - Inflation (default: 6)
  electricityInflation?: number;    // % - Tariff escalation (default: 10)
  projectDurationYears?: number;    // years (default: 20)
  lcoeDiscountRate?: number;        // % - NPV discount rate (default: 9)
  mirrFinanceRate?: number;         // % - Interest paid on money used in cash flows (default: 9)
  mirrReinvestmentRate?: number;    // % - Interest received on reinvestment (default: 10)
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

// Deprecated: calculateFinancials (24-hour daily scaling) removed.
// Use calculateFinancialsFromAnnual for all financial calculations.

/**
 * Calculate financial results from annual 8,760-hour simulation (single source of truth).
 * Uses pre-summed annual totals directly — no daily scaling.
 */
export function calculateFinancialsFromAnnual(
  annualResults: AnnualEnergySimulationResultsInput | null | undefined,
  tariff: TariffData,
  systemCosts: SystemCosts,
  solarCapacity: number,
  batteryCapacity: number
): FinancialResults {
  // Guard against null/undefined annualResults (engine not yet run)
  if (!annualResults) {
    const { totalCapitalCost: systemCost } = calculateTotalSystemCost(systemCosts, solarCapacity, batteryCapacity);
    return {
      gridOnlyDailyCost: 0, gridOnlyMonthlyCost: 0, gridOnlyAnnualCost: 0,
      solarDailyCost: 0, solarMonthlyCost: 0, solarAnnualCost: 0,
      dailyExportRevenue: 0, annualExportRevenue: 0,
      dailySavings: 0, monthlySavings: 0, annualSavings: 0, savingsPercentage: 0,
      systemCost, paybackYears: Infinity, roi: 0,
      gridOnlyEnergyCost: 0, gridOnlyDemandCost: 0, gridOnlyFixedCost: 0,
      solarEnergyCost: 0, solarDemandCost: 0, solarFixedCost: 0,
    };
  }

  const {
    totalAnnualLoad,
    totalAnnualGridImport,
    totalAnnualGridExport,
    totalAnnualSolar,
    peakLoad,
    peakGridImport,
  } = annualResults;

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

  // === Grid-only scenario (annual-first) ===
  const gridOnlyAnnualEnergyCost = totalAnnualLoad * averageRatePerKwh;
  const powerFactor = 0.9;
  const peakLoadKva = peakLoad / powerFactor;
  const gridOnlyAnnualDemandCost = peakLoadKva * demandChargePerKva * 12; // Monthly charge × 12
  const gridOnlyAnnualFixedCost = fixedMonthlyCharge * 12;
  const gridOnlyAnnualCost = gridOnlyAnnualEnergyCost + gridOnlyAnnualDemandCost + gridOnlyAnnualFixedCost;
  const gridOnlyMonthlyCost = gridOnlyAnnualCost / 12;
  const gridOnlyDailyCost = gridOnlyAnnualCost / 365;

  // === With solar+battery scenario (annual-first) ===
  const solarAnnualEnergyCost = totalAnnualGridImport * averageRatePerKwh;
  const peakGridImportKva = peakGridImport / powerFactor;
  const solarAnnualDemandCost = peakGridImportKva * demandChargePerKva * 12;
  const solarAnnualFixedCost = fixedMonthlyCharge * 12;
  const annualExportRevenue = totalAnnualGridExport * exportRatePerKwh;

  const solarAnnualCost = solarAnnualEnergyCost + solarAnnualDemandCost + solarAnnualFixedCost - annualExportRevenue;
  const solarMonthlyCost = solarAnnualCost / 12;
  const solarDailyCost = solarAnnualCost / 365;

  // === Savings ===
  const annualSavings = gridOnlyAnnualCost - solarAnnualCost;
  const monthlySavings = annualSavings / 12;
  const dailySavings = annualSavings / 365;
  const savingsPercentage = gridOnlyAnnualCost > 0
    ? (annualSavings / gridOnlyAnnualCost) * 100
    : 0;

  // === Investment analysis ===
  const { totalCapitalCost: systemCost } = calculateTotalSystemCost(systemCosts, solarCapacity, batteryCapacity);

  const netAnnualSavings = annualSavings - maintenancePerYear;
  const paybackYears = netAnnualSavings > 0
    ? systemCost / netAnnualSavings
    : Infinity;
  const roi = systemCost > 0
    ? (netAnnualSavings / systemCost) * 100
    : 0;

  return {
    gridOnlyDailyCost,
    gridOnlyMonthlyCost,
    gridOnlyAnnualCost,
    solarDailyCost,
    solarMonthlyCost,
    solarAnnualCost,
    dailyExportRevenue: annualExportRevenue / 365,
    annualExportRevenue,
    dailySavings,
    monthlySavings,
    annualSavings,
    savingsPercentage,
    systemCost,
    paybackYears,
    roi,
    gridOnlyEnergyCost: gridOnlyAnnualEnergyCost / 365,
    gridOnlyDemandCost: gridOnlyAnnualDemandCost / 365,
    gridOnlyFixedCost: gridOnlyAnnualFixedCost / 365,
    solarEnergyCost: solarAnnualEnergyCost / 365,
    solarDemandCost: solarAnnualDemandCost / 365,
    solarFixedCost: solarAnnualFixedCost / 365,
  };
}

/** Minimal shape for annual results accepted by calculateFinancialsFromAnnual */
interface AnnualEnergySimulationResultsInput {
  totalAnnualLoad: number;
  totalAnnualSolar: number;
  totalAnnualGridImport: number;
  totalAnnualGridExport: number;
  peakLoad: number;
  peakGridImport: number;
}

// Deprecated: compareTariffs removed (used the removed calculateFinancials).

/**
 * Default system costs for South Africa (2025/2026)
 * Now sourced from centralized calculation variables in Settings
 */
import { buildSystemCostsFromVariables } from "@/hooks/useCalculationDefaults";

// Dynamic getter that reads from centralized Settings
export function getDefaultSystemCosts(): SystemCosts {
  return buildSystemCostsFromVariables();
}

// Cached lazy singleton — avoids getter-per-property overhead on every access
let _cachedDefaults: SystemCosts | null = null;
let _cacheTimestamp = 0;
const CACHE_TTL_MS = 5000; // Refresh every 5 seconds

export const DEFAULT_SYSTEM_COSTS: SystemCosts = new Proxy({} as SystemCosts, {
  get(_target, prop: string) {
    const now = Date.now();
    if (!_cachedDefaults || now - _cacheTimestamp > CACHE_TTL_MS) {
      _cachedDefaults = getDefaultSystemCosts();
      _cacheTimestamp = now;
    }
    return (_cachedDefaults as any)[prop];
  },
});

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
