/**
 * Simulation Module Exports
 * 
 * Energy simulation is separated into two distinct phases:
 * 
 * 1. EnergySimulationEngine - Pure kWh calculations (tariff-independent)
 *    - Solar generation modeling
 *    - Battery charge/discharge cycles  
 *    - Grid import/export quantities
 * 
 * 2. FinancialAnalysis - Tariff-based cost calculations
 *    - Apply tariff rates to energy flows
 *    - Calculate costs and savings
 *    - Investment analysis (payback, ROI)
 * 
 * 3. AdvancedSimulation - Sophisticated multi-year modeling
 *    - Seasonal variations
 *    - Degradation curves
 *    - NPV/IRR calculations
 *    - Sensitivity analysis
 */

export {
  runEnergySimulation,
  scaleToAnnual,
  scaleToMonthly,
  type EnergySimulationConfig,
  type EnergySimulationResults,
  type HourlyEnergyData,
} from "./EnergySimulationEngine";

export {
  calculateFinancials,
  compareTariffs,
  DEFAULT_SYSTEM_COSTS,
  type TariffData,
  type SystemCosts,
  type FinancialResults,
} from "./FinancialAnalysis";

export {
  runAdvancedSimulation,
  calculateNPV,
  calculateIRR,
  calculateLCOE,
  getPanelEfficiency,
  getBatteryCapacityRemaining,
  getSeasonalIrradianceFactor,
  getSeasonalLoadMultiplier,
} from "./AdvancedSimulationEngine";

export {
  DEFAULT_ADVANCED_CONFIG,
  DEFAULT_SEASONAL_CONFIG,
  DEFAULT_DEGRADATION_CONFIG,
  DEFAULT_FINANCIAL_CONFIG,
  DEFAULT_GRID_CONSTRAINTS_CONFIG,
  DEFAULT_LOAD_GROWTH_CONFIG,
  type AdvancedSimulationConfig,
  type SeasonalConfig,
  type DegradationConfig,
  type AdvancedFinancialConfig,
  type GridConstraintsConfig,
  type LoadGrowthConfig,
  type AdvancedFinancialResults,
  type YearlyProjection,
  type SensitivityResults,
} from "./AdvancedSimulationTypes";

export { AdvancedSimulationConfigPanel } from "./AdvancedSimulationConfig";
export { AdvancedResultsDisplay } from "./AdvancedResultsDisplay";
