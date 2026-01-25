// ============================================================================
// Types - Organized by Domain
// ============================================================================

/** Solar system installation cost variables */
export interface SolarSystemVariables {
  solarCostPerKwp: number;           // R/kWp installed (default 12000)
  batteryCostPerKwh: number;         // R/kWh installed (default 8000)
  defaultDcAcRatio: number;          // Default DC/AC ratio (default 1.2)
  defaultPeakSunHours: number;       // Default PSH for estimates (default 5.5)
  defaultSystemLosses: number;       // % system losses (default 14)
}

/** PVsyst loss chain variables */
export interface PVsystLossVariables {
  // Irradiance losses
  nearShadingLoss: number;           // % (default 0.93)
  iamLoss: number;                   // % (default 2.57)
  soilingLoss: number;               // % (default 3.00)
  spectralLoss: number;              // % (default 1.05)
  electricalShadingLoss: number;     // % (default 0.23)
  
  // Array losses
  irradianceLevelLoss: number;       // % (default 0.42)
  temperatureLoss: number;           // % (default 4.92)
  moduleQualityLoss: number;         // % - negative = gain (default -0.75)
  lidLoss: number;                   // % Light-Induced Degradation (default 2.00)
  mismatchLoss: number;              // % (default 3.40)
  ohmicLoss: number;                 // % DC wiring (default 1.06)
  
  // Inverter losses
  inverterEfficiencyLoss: number;    // % (default 1.53)
  inverterClippingLoss: number;      // % (default 1.04)
  
  // System availability
  availabilityLoss: number;          // % (default 2.07)
}

/** Degradation and lifetime variables */
export interface DegradationVariables {
  annualPanelDegradation: number;    // % per year (default 0.5)
  firstYearDegradation: number;      // % LID in year 1 (default 2.0)
  annualBatteryDegradation: number;  // % per year (default 3.0)
  batteryEolCapacity: number;        // % end-of-life threshold (default 70)
  projectLifetimeYears: number;      // years (default 20)
}

/** Financial assumption variables */
export interface FinancialVariables {
  discountRate: number;              // % for NPV (default 9)
  tariffEscalation: number;          // % annual increase (default 10)
  cpiInflation: number;              // % annual inflation (default 6)
  vatRate: number;                   // % VAT (default 15)
  insuranceRatePercent: number;      // % of capital annually (default 1.0)
  financeRate: number;               // % for MIRR negative flows (default 9)
  reinvestmentRate: number;          // % for MIRR positive flows (default 8)
}

/** Cost breakdown and replacement variables */
export interface CostBreakdownVariables {
  equipmentCostPercent: number;      // % of solar PV cost (default 45)
  moduleSharePercent: number;        // % of equipment (default 70)
  inverterSharePercent: number;      // % of equipment (default 30)
  moduleReplacementPercent: number;  // % to replace (default 10)
  inverterReplacementPercent: number;// % to replace (default 50)
  batteryReplacementPercent: number; // % to replace (default 30)
  replacementYear: number;           // year for replacements (default 10)
  professionalFeesPercent: number;   // % of project (default 5)
  projectManagementPercent: number;  // % of project (default 3)
  contingencyPercent: number;        // % of project (default 5)
}

/** Carbon and environmental variables */
export interface CarbonVariables {
  gridEmissionFactor: number;        // kg CO2/kWh (default 0.95)
  transmissionLossPercent: number;   // % (default 8)
  recPricePerMwh: number;            // R/MWh (default 150)
  carbonTaxRate: number;             // R/ton CO2 (default 190)
  kgCo2PerTreePerYear: number;       // kg CO2 absorbed (default 22)
  kgCo2PerCarPerYear: number;        // kg CO2 emitted (default 4600)
}

/** Complete calculation variables structure */
export interface CalculationVariables {
  solarSystem: SolarSystemVariables;
  pvsystLoss: PVsystLossVariables;
  degradation: DegradationVariables;
  financial: FinancialVariables;
  costBreakdown: CostBreakdownVariables;
  carbon: CarbonVariables;
}

// Legacy type aliases for backwards compatibility
export type SolarSystemDefaults = SolarSystemVariables;
export type PVsystLossDefaults = PVsystLossVariables;
export type DegradationDefaults = DegradationVariables;
export type FinancialDefaults = FinancialVariables;
export type CostBreakdownDefaults = CostBreakdownVariables;
export type CarbonDefaults = CarbonVariables;
export type CalculationDefaults = CalculationVariables;
