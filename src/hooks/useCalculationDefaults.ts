/**
 * Centralized Calculation Variables
 * 
 * This module provides the single source of truth for all calculation constants
 * used throughout the application. Variables are organized into six domains:
 * 
 * 1. Solar System - Installation costs and system parameters
 * 2. PVsyst Loss Chain - Sequential loss factors for yield modeling
 * 3. Degradation & Lifetime - Equipment aging rates and project duration
 * 4. Financial Variables - Discount rates, escalation, and return calculations
 * 5. Cost Structure - Equipment splits and replacement schedules
 * 6. Carbon & Environmental - Emission factors and impact constants
 * 
 * USAGE IN REACT COMPONENTS:
 * ```typescript
 * import { useCalculationDefaults } from "@/hooks/useCalculationDefaults";
 * const { solarSystem, financial, updateValue } = useCalculationDefaults();
 * ```
 * 
 * USAGE IN CALCULATION ENGINES (non-React):
 * ```typescript
 * import { 
 *   getCalculationVariables,
 *   getSolarSystemVariables,
 *   getFinancialVariables,
 *   buildSystemCostsFromVariables 
 * } from "@/hooks/useCalculationDefaults";
 * 
 * const vars = getCalculationVariables();
 * const systemCosts = buildSystemCostsFromVariables();
 * ```
 */

// Re-export everything from the module
export * from './useCalculationDefaults/index';
