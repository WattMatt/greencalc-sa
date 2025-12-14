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
