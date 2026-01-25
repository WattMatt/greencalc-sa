import type { CalculationVariables } from './types';
import {
  DEFAULT_SOLAR_SYSTEM,
  DEFAULT_PVSYST_LOSS,
  DEFAULT_DEGRADATION,
  DEFAULT_FINANCIAL,
  DEFAULT_COST_BREAKDOWN,
  DEFAULT_CARBON,
  DEFAULT_CALCULATION_VARIABLES,
} from './defaults';

const STORAGE_KEY = "calculation-defaults";

/**
 * Get calculation variables from localStorage (non-hook version for use in calculation engines)
 * This allows calculation engines to access the centralized variables without React hooks
 */
export function getCalculationVariables(): CalculationVariables {
  if (typeof window === 'undefined') {
    return DEFAULT_CALCULATION_VARIABLES;
  }
  
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Deep merge with defaults to handle new fields
      return {
        solarSystem: { ...DEFAULT_SOLAR_SYSTEM, ...parsed.solarSystem },
        pvsystLoss: { ...DEFAULT_PVSYST_LOSS, ...parsed.pvsystLoss },
        degradation: { ...DEFAULT_DEGRADATION, ...parsed.degradation },
        financial: { ...DEFAULT_FINANCIAL, ...parsed.financial },
        costBreakdown: { ...DEFAULT_COST_BREAKDOWN, ...parsed.costBreakdown },
        carbon: { ...DEFAULT_CARBON, ...parsed.carbon },
      };
    } catch {
      return DEFAULT_CALCULATION_VARIABLES;
    }
  }
  return DEFAULT_CALCULATION_VARIABLES;
}

/**
 * Get solar system variables
 */
export function getSolarSystemVariables() {
  return getCalculationVariables().solarSystem;
}

/**
 * Get PVsyst loss chain variables
 */
export function getPVsystLossVariables() {
  return getCalculationVariables().pvsystLoss;
}

/**
 * Get degradation variables
 */
export function getDegradationVariables() {
  return getCalculationVariables().degradation;
}

/**
 * Get financial variables
 */
export function getFinancialVariables() {
  return getCalculationVariables().financial;
}

/**
 * Get cost breakdown variables
 */
export function getCostBreakdownVariables() {
  return getCalculationVariables().costBreakdown;
}

/**
 * Get carbon/environmental variables
 */
export function getCarbonVariables() {
  return getCalculationVariables().carbon;
}

/**
 * Build SystemCosts object from centralized variables (for FinancialAnalysis.ts compatibility)
 * This maps the centralized variables to the SystemCosts interface format
 */
export function buildSystemCostsFromVariables(overrides?: Partial<ReturnType<typeof getCalculationVariables>>) {
  const vars = getCalculationVariables();
  const solar = overrides?.solarSystem ?? vars.solarSystem;
  const financial = overrides?.financial ?? vars.financial;
  const costBreakdown = overrides?.costBreakdown ?? vars.costBreakdown;
  const degradation = overrides?.degradation ?? vars.degradation;
  
  return {
    solarCostPerKwp: solar.solarCostPerKwp,
    batteryCostPerKwh: solar.batteryCostPerKwh,
    solarMaintenancePercentage: 3.5, // Keep as project-level override
    batteryMaintenancePercentage: 1.5, // Keep as project-level override
    maintenancePerYear: 0,
    
    // Fixed costs default to 0 (project-level)
    healthAndSafetyCost: 0,
    waterPointsCost: 0,
    cctvCost: 0,
    mvSwitchGearCost: 0,
    
    // Insurance
    insuranceCostPerYear: 0,
    insuranceRatePercent: financial.insuranceRatePercent,
    
    // Percentage-based fees
    professionalFeesPercent: costBreakdown.professionalFeesPercent,
    projectManagementPercent: costBreakdown.projectManagementPercent,
    contingencyPercent: costBreakdown.contingencyPercent,
    
    // Replacement costs
    replacementYear: costBreakdown.replacementYear,
    equipmentCostPercent: costBreakdown.equipmentCostPercent,
    moduleSharePercent: costBreakdown.moduleSharePercent,
    inverterSharePercent: costBreakdown.inverterSharePercent,
    solarModuleReplacementPercent: costBreakdown.moduleReplacementPercent,
    inverterReplacementPercent: costBreakdown.inverterReplacementPercent,
    batteryReplacementPercent: costBreakdown.batteryReplacementPercent,
    
    // Financial parameters
    costOfCapital: financial.discountRate,
    cpi: financial.cpiInflation,
    electricityInflation: financial.tariffEscalation,
    projectDurationYears: degradation.projectLifetimeYears,
    lcoeDiscountRate: financial.discountRate,
    mirrFinanceRate: financial.financeRate,
    mirrReinvestmentRate: financial.reinvestmentRate,
  };
}

/**
 * Build PVsyst config from centralized variables (for pvsystLossChain.ts compatibility)
 */
export function buildPVsystConfigFromVariables(overrides?: Partial<ReturnType<typeof getPVsystLossVariables>>) {
  const vars = getPVsystLossVariables();
  const merged = { ...vars, ...overrides };
  
  return {
    irradiance: {
      transpositionLoss: 0.13, // Keep as default (project-level typically)
      nearShadingLoss: merged.nearShadingLoss,
      iamLoss: merged.iamLoss,
      soilingLoss: merged.soilingLoss,
      spectralLoss: merged.spectralLoss,
      electricalShadingLoss: merged.electricalShadingLoss,
    },
    array: {
      irradianceLevelLoss: merged.irradianceLevelLoss,
      temperatureLoss: merged.temperatureLoss,
      moduleQualityLoss: merged.moduleQualityLoss,
      lidLoss: merged.lidLoss,
      moduleDegradationLoss: 3.8, // Calculated from year, keep separate
      mismatchLoss: merged.mismatchLoss,
      ohmicLoss: merged.ohmicLoss,
    },
    system: {
      inverter: {
        operationEfficiency: merged.inverterEfficiencyLoss,
        overNominalPower: merged.inverterClippingLoss,
        maxInputCurrent: 0,
        overNominalVoltage: 0,
        powerThreshold: 0.004,
        voltageThreshold: 0.001,
        nightConsumption: 0.009,
      },
    },
    lossesAfterInverter: {
      availabilityLoss: merged.availabilityLoss,
    },
    operationYear: 10,
    stcEfficiency: 0.2149,
  };
}
