import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "calculation-defaults";

// ============================================================================
// Types - Organized by Domain
// ============================================================================

/** Solar system installation cost defaults */
export interface SolarSystemDefaults {
  solarCostPerKwp: number;           // R/kWp installed (default 12000)
  batteryCostPerKwh: number;         // R/kWh installed (default 8000)
  defaultDcAcRatio: number;          // Default DC/AC ratio (default 1.2)
  defaultPeakSunHours: number;       // Default PSH for estimates (default 5.5)
  defaultSystemLosses: number;       // % system losses (default 14)
}

/** PVsyst loss chain defaults */
export interface PVsystLossDefaults {
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

/** Degradation and lifetime defaults */
export interface DegradationDefaults {
  annualPanelDegradation: number;    // % per year (default 0.5)
  firstYearDegradation: number;      // % LID in year 1 (default 2.0)
  annualBatteryDegradation: number;  // % per year (default 3.0)
  batteryEolCapacity: number;        // % end-of-life threshold (default 70)
  projectLifetimeYears: number;      // years (default 20)
}

/** Financial assumption defaults */
export interface FinancialDefaults {
  discountRate: number;              // % for NPV (default 9)
  tariffEscalation: number;          // % annual increase (default 10)
  cpiInflation: number;              // % annual inflation (default 6)
  vatRate: number;                   // % VAT (default 15)
  insuranceRatePercent: number;      // % of capital annually (default 1.0)
  financeRate: number;               // % for MIRR negative flows (default 9)
  reinvestmentRate: number;          // % for MIRR positive flows (default 8)
}

/** Cost breakdown and replacement defaults */
export interface CostBreakdownDefaults {
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

/** Carbon and environmental defaults */
export interface CarbonDefaults {
  gridEmissionFactor: number;        // kg CO2/kWh (default 0.95)
  transmissionLossPercent: number;   // % (default 8)
  recPricePerMwh: number;            // R/MWh (default 150)
  carbonTaxRate: number;             // R/ton CO2 (default 190)
  kgCo2PerTreePerYear: number;       // kg CO2 absorbed (default 22)
  kgCo2PerCarPerYear: number;        // kg CO2 emitted (default 4600)
}

/** Complete calculation defaults structure */
export interface CalculationDefaults {
  solarSystem: SolarSystemDefaults;
  pvsystLoss: PVsystLossDefaults;
  degradation: DegradationDefaults;
  financial: FinancialDefaults;
  costBreakdown: CostBreakdownDefaults;
  carbon: CarbonDefaults;
}

// ============================================================================
// Default Values - Industry Standards for South Africa
// ============================================================================

export const DEFAULT_SOLAR_SYSTEM: SolarSystemDefaults = {
  solarCostPerKwp: 12000,
  batteryCostPerKwh: 8000,
  defaultDcAcRatio: 1.2,
  defaultPeakSunHours: 5.5,
  defaultSystemLosses: 14,
};

export const DEFAULT_PVSYST_LOSS: PVsystLossDefaults = {
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

export const DEFAULT_DEGRADATION: DegradationDefaults = {
  annualPanelDegradation: 0.5,
  firstYearDegradation: 2.0,
  annualBatteryDegradation: 3.0,
  batteryEolCapacity: 70,
  projectLifetimeYears: 20,
};

export const DEFAULT_FINANCIAL: FinancialDefaults = {
  discountRate: 9,
  tariffEscalation: 10,
  cpiInflation: 6,
  vatRate: 15,
  insuranceRatePercent: 1.0,
  financeRate: 9,
  reinvestmentRate: 8,
};

export const DEFAULT_COST_BREAKDOWN: CostBreakdownDefaults = {
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

export const DEFAULT_CARBON: CarbonDefaults = {
  gridEmissionFactor: 0.95,
  transmissionLossPercent: 8,
  recPricePerMwh: 150,
  carbonTaxRate: 190,
  kgCo2PerTreePerYear: 22,
  kgCo2PerCarPerYear: 4600,
};

export const DEFAULT_CALCULATION_DEFAULTS: CalculationDefaults = {
  solarSystem: DEFAULT_SOLAR_SYSTEM,
  pvsystLoss: DEFAULT_PVSYST_LOSS,
  degradation: DEFAULT_DEGRADATION,
  financial: DEFAULT_FINANCIAL,
  costBreakdown: DEFAULT_COST_BREAKDOWN,
  carbon: DEFAULT_CARBON,
};

// ============================================================================
// Hook Implementation
// ============================================================================

export function useCalculationDefaults() {
  const [defaults, setDefaultsState] = useState<CalculationDefaults>(() => {
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
        return DEFAULT_CALCULATION_DEFAULTS;
      }
    }
    return DEFAULT_CALCULATION_DEFAULTS;
  });

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
  }, [defaults]);

  // Update a specific section
  const updateSection = useCallback(<K extends keyof CalculationDefaults>(
    section: K,
    updates: Partial<CalculationDefaults[K]>
  ) => {
    setDefaultsState(prev => ({
      ...prev,
      [section]: { ...prev[section], ...updates },
    }));
  }, []);

  // Update a single value
  const updateValue = useCallback(<
    S extends keyof CalculationDefaults,
    K extends keyof CalculationDefaults[S]
  >(
    section: S,
    key: K,
    value: CalculationDefaults[S][K]
  ) => {
    setDefaultsState(prev => ({
      ...prev,
      [section]: { ...prev[section], [key]: value },
    }));
  }, []);

  // Reset a section to defaults
  const resetSection = useCallback(<K extends keyof CalculationDefaults>(section: K) => {
    const sectionDefaults: Record<keyof CalculationDefaults, CalculationDefaults[keyof CalculationDefaults]> = {
      solarSystem: DEFAULT_SOLAR_SYSTEM,
      pvsystLoss: DEFAULT_PVSYST_LOSS,
      degradation: DEFAULT_DEGRADATION,
      financial: DEFAULT_FINANCIAL,
      costBreakdown: DEFAULT_COST_BREAKDOWN,
      carbon: DEFAULT_CARBON,
    };
    
    setDefaultsState(prev => ({
      ...prev,
      [section]: sectionDefaults[section],
    }));
  }, []);

  // Reset all to defaults
  const resetAll = useCallback(() => {
    setDefaultsState(DEFAULT_CALCULATION_DEFAULTS);
  }, []);

  return {
    defaults,
    updateSection,
    updateValue,
    resetSection,
    resetAll,
    // Export individual sections for convenience
    solarSystem: defaults.solarSystem,
    pvsystLoss: defaults.pvsystLoss,
    degradation: defaults.degradation,
    financial: defaults.financial,
    costBreakdown: defaults.costBreakdown,
    carbon: defaults.carbon,
  };
}
