import type {
  SolarSystemVariables,
  PVsystLossVariables,
  DegradationVariables,
  FinancialVariables,
  CostBreakdownVariables,
  CarbonVariables,
  CalculationVariables,
} from './types';

// ============================================================================
// Default Values - Industry Standards for South Africa
// ============================================================================

export const DEFAULT_SOLAR_SYSTEM: SolarSystemVariables = {
  solarCostPerKwp: 12000,
  batteryCostPerKwh: 8000,
  defaultDcAcRatio: 1.2,
  defaultPeakSunHours: 5.5,
  defaultSystemLosses: 14,
};

export const DEFAULT_PVSYST_LOSS: PVsystLossVariables = {
  // Irradiance losses
  nearShadingLoss: 0.93,
  iamLoss: 2.57,
  soilingLoss: 3.00,
  spectralLoss: 1.05,
  electricalShadingLoss: 0.23,
  
  // Array losses
  irradianceLevelLoss: 0.42,
  temperatureLoss: 4.92,
  moduleQualityLoss: -0.75,
  lidLoss: 2.00,
  mismatchLoss: 3.40,
  ohmicLoss: 1.06,
  
  // Inverter losses
  inverterEfficiencyLoss: 1.53,
  inverterClippingLoss: 1.04,
  
  // System availability
  availabilityLoss: 2.07,
};

export const DEFAULT_DEGRADATION: DegradationVariables = {
  annualPanelDegradation: 0.5,
  firstYearDegradation: 2.0,
  annualBatteryDegradation: 3.0,
  batteryEolCapacity: 70,
  projectLifetimeYears: 20,
};

export const DEFAULT_FINANCIAL: FinancialVariables = {
  discountRate: 9,
  tariffEscalation: 10,
  cpiInflation: 6,
  vatRate: 15,
  insuranceRatePercent: 1.0,
  financeRate: 9,
  reinvestmentRate: 8,
};

export const DEFAULT_COST_BREAKDOWN: CostBreakdownVariables = {
  equipmentCostPercent: 45,
  moduleSharePercent: 70,
  inverterSharePercent: 30,
  moduleReplacementPercent: 10,
  inverterReplacementPercent: 50,
  batteryReplacementPercent: 30,
  replacementYear: 10,
  professionalFeesPercent: 5,
  projectManagementPercent: 3,
  contingencyPercent: 5,
};

export const DEFAULT_CARBON: CarbonVariables = {
  gridEmissionFactor: 0.95,
  transmissionLossPercent: 8,
  recPricePerMwh: 150,
  carbonTaxRate: 190,
  kgCo2PerTreePerYear: 22,
  kgCo2PerCarPerYear: 4600,
};

export const DEFAULT_CALCULATION_VARIABLES: CalculationVariables = {
  solarSystem: DEFAULT_SOLAR_SYSTEM,
  pvsystLoss: DEFAULT_PVSYST_LOSS,
  degradation: DEFAULT_DEGRADATION,
  financial: DEFAULT_FINANCIAL,
  costBreakdown: DEFAULT_COST_BREAKDOWN,
  carbon: DEFAULT_CARBON,
};

// Legacy alias
export const DEFAULT_CALCULATION_DEFAULTS = DEFAULT_CALCULATION_VARIABLES;
