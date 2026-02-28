/**
 * Simulation Configuration Utilities
 * 
 * Consolidates config restoration (deep-merge) and system cost calculation
 * logic that was previously duplicated across SimulationPanel.tsx,
 * FinancialAnalysis.ts, and AdvancedSimulationEngine.ts.
 */

import type { SystemCosts } from "@/components/projects/simulation/FinancialAnalysis";
import { DEFAULT_PVSYST_CONFIG } from "@/lib/pvsystLossChain";
import { DEFAULT_ADVANCED_CONFIG } from "@/components/projects/simulation/AdvancedSimulationTypes";

/**
 * Calculate total system cost (Total Capital Cost) from component costs.
 * Single source of truth — used by FinancialAnalysis and AdvancedSimulationEngine.
 */
export function calculateTotalSystemCost(
  systemCosts: SystemCosts,
  solarCapacity: number,
  batteryCapacity: number
): {
  baseCost: number;
  additionalCosts: number;
  subtotalBeforeFees: number;
  professionalFees: number;
  projectManagementFees: number;
  subtotalWithFees: number;
  contingency: number;
  totalCapitalCost: number;
} {
  const additionalCosts =
    (systemCosts.healthAndSafetyCost ?? 0) +
    (systemCosts.waterPointsCost ?? 0) +
    (systemCosts.cctvCost ?? 0) +
    (systemCosts.mvSwitchGearCost ?? 0);

  const baseCost =
    solarCapacity * systemCosts.solarCostPerKwp +
    batteryCapacity * systemCosts.batteryCostPerKwh;

  const subtotalBeforeFees = baseCost + additionalCosts;

  const professionalFees = subtotalBeforeFees * ((systemCosts.professionalFeesPercent ?? 0) / 100);
  const projectManagementFees = subtotalBeforeFees * ((systemCosts.projectManagementPercent ?? 0) / 100);
  const subtotalWithFees = subtotalBeforeFees + professionalFees + projectManagementFees;
  const contingency = subtotalWithFees * ((systemCosts.contingencyPercent ?? 0) / 100);
  const totalCapitalCost = subtotalWithFees + contingency;

  return {
    baseCost,
    additionalCosts,
    subtotalBeforeFees,
    professionalFees,
    projectManagementFees,
    subtotalWithFees,
    contingency,
    totalCapitalCost,
  };
}

/**
 * Deep-merge a saved PVsyst config with defaults, preserving new fields.
 */
export function mergePvsystConfig(saved: any) {
  return {
    ...DEFAULT_PVSYST_CONFIG,
    ...saved,
    irradiance: {
      ...DEFAULT_PVSYST_CONFIG.irradiance,
      ...saved?.irradiance,
    },
    array: {
      ...DEFAULT_PVSYST_CONFIG.array,
      ...saved?.array,
    },
    system: {
      ...DEFAULT_PVSYST_CONFIG.system,
      inverter: {
        ...DEFAULT_PVSYST_CONFIG.system.inverter,
        ...saved?.system?.inverter,
      },
    },
    lossesAfterInverter: {
      ...DEFAULT_PVSYST_CONFIG.lossesAfterInverter,
      ...saved?.lossesAfterInverter,
    },
  };
}

/**
 * Deep-merge a saved advanced config with defaults, preserving new fields.
 */
export function mergeAdvancedConfig(saved: any) {
  return {
    ...DEFAULT_ADVANCED_CONFIG,
    ...saved,
    seasonal: {
      ...DEFAULT_ADVANCED_CONFIG.seasonal,
      ...saved?.seasonal,
    },
    degradation: {
      ...DEFAULT_ADVANCED_CONFIG.degradation,
      ...saved?.degradation,
    },
    financial: {
      ...DEFAULT_ADVANCED_CONFIG.financial,
      ...saved?.financial,
    },
    gridConstraints: {
      ...DEFAULT_ADVANCED_CONFIG.gridConstraints,
      ...saved?.gridConstraints,
    },
    loadGrowth: {
      ...DEFAULT_ADVANCED_CONFIG.loadGrowth,
      ...saved?.loadGrowth,
    },
  };
}
