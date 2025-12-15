/**
 * Advanced Simulation Configuration Types
 * 
 * Defines all configurable parameters for sophisticated energy and financial modeling
 */

// ============= Seasonal Variation =============
export interface SeasonalConfig {
  enabled: boolean;
  
  // Monthly irradiance factors (1.0 = baseline, relative to annual average)
  monthlyIrradianceFactors: number[]; // 12 months
  
  // High/Low demand season months (South African standard)
  highDemandMonths: number[]; // e.g., [5, 6, 7] for Jun-Aug (0-indexed)
  
  // Seasonal consumption multipliers
  highDemandLoadMultiplier: number; // e.g., 1.1 for 10% higher in winter
  lowDemandLoadMultiplier: number; // e.g., 0.95 for 5% lower in summer
}

// ============= Degradation Modeling =============
export interface DegradationConfig {
  enabled: boolean;
  
  // Panel degradation
  panelDegradationRate: number; // % per year (default 0.5%)
  panelFirstYearDegradation: number; // Initial degradation (typically higher, ~2%)
  
  // Battery degradation
  batteryDegradationRate: number; // % capacity loss per year
  batteryEolCapacity: number; // End-of-life capacity threshold (e.g., 70%)
  
  // Inverter replacement
  inverterReplacementYear: number; // Year for replacement (default 12)
  inverterReplacementCost: number; // R cost for replacement
}

// ============= Financial Sophistication =============
export interface AdvancedFinancialConfig {
  enabled: boolean;
  
  // Tariff escalation
  tariffEscalationRate: number; // % annual increase (e.g., 10% for SA)
  
  // Inflation
  inflationRate: number; // % (e.g., 5%)
  
  // Discount rate for NPV
  discountRate: number; // % (e.g., 8%)
  
  // Project lifetime
  projectLifetimeYears: number; // Typically 25 years for solar
  
  // Sensitivity analysis
  sensitivityEnabled: boolean;
  sensitivityVariation: number; // % variation for best/worst cases (e.g., 20%)
}

// ============= Grid Constraints =============
export interface GridConstraintsConfig {
  enabled: boolean;
  
  // Export limits
  maxExportKw: number; // Maximum allowed grid export (kW)
  exportLimitEnabled: boolean;
  
  // Time-based export restrictions
  exportRestrictedHours: number[]; // Hours when export is prohibited
  exportRestrictionsEnabled: boolean;
  
  // Wheeling charges
  wheelingChargePerKwh: number; // R/kWh for grid wheeling
  wheelingEnabled: boolean;
}

// ============= Load Growth Modeling =============
export interface LoadGrowthConfig {
  enabled: boolean;
  
  // Annual consumption growth
  annualGrowthRate: number; // % per year (e.g., 2%)
  
  // New tenant projections
  newTenantEnabled: boolean;
  newTenantYear: number; // Year when new tenant joins
  newTenantLoadKwh: number; // Additional monthly kWh from new tenant
}

// ============= Combined Configuration =============
export interface AdvancedSimulationConfig {
  seasonal: SeasonalConfig;
  degradation: DegradationConfig;
  financial: AdvancedFinancialConfig;
  gridConstraints: GridConstraintsConfig;
  loadGrowth: LoadGrowthConfig;
}

// ============= Default Configurations =============
export const DEFAULT_SEASONAL_CONFIG: SeasonalConfig = {
  enabled: false,
  // South African monthly irradiance factors (relative to average)
  // Higher in summer (Oct-Feb), lower in winter (May-Jul)
  monthlyIrradianceFactors: [
    1.15, // Jan
    1.10, // Feb
    1.05, // Mar
    0.95, // Apr
    0.85, // May
    0.80, // Jun
    0.82, // Jul
    0.90, // Aug
    1.00, // Sep
    1.08, // Oct
    1.15, // Nov
    1.15, // Dec
  ],
  highDemandMonths: [5, 6, 7], // June, July, August (0-indexed)
  highDemandLoadMultiplier: 1.05,
  lowDemandLoadMultiplier: 0.98,
};

export const DEFAULT_DEGRADATION_CONFIG: DegradationConfig = {
  enabled: false,
  panelDegradationRate: 0.5,
  panelFirstYearDegradation: 2.0,
  batteryDegradationRate: 3.0, // ~3% per year is typical for Li-ion
  batteryEolCapacity: 70,
  inverterReplacementYear: 12,
  inverterReplacementCost: 50000, // R50,000 typical for commercial
};

export const DEFAULT_FINANCIAL_CONFIG: AdvancedFinancialConfig = {
  enabled: false,
  tariffEscalationRate: 10.0, // SA tariffs have been rising ~10%/year
  inflationRate: 5.5,
  discountRate: 10.0,
  projectLifetimeYears: 25,
  sensitivityEnabled: false,
  sensitivityVariation: 20,
};

export const DEFAULT_GRID_CONSTRAINTS_CONFIG: GridConstraintsConfig = {
  enabled: false,
  maxExportKw: 100,
  exportLimitEnabled: false,
  exportRestrictedHours: [],
  exportRestrictionsEnabled: false,
  wheelingChargePerKwh: 0.30,
  wheelingEnabled: false,
};

export const DEFAULT_LOAD_GROWTH_CONFIG: LoadGrowthConfig = {
  enabled: false,
  annualGrowthRate: 2.0,
  newTenantEnabled: false,
  newTenantYear: 3,
  newTenantLoadKwh: 5000,
};

export const DEFAULT_ADVANCED_CONFIG: AdvancedSimulationConfig = {
  seasonal: DEFAULT_SEASONAL_CONFIG,
  degradation: DEFAULT_DEGRADATION_CONFIG,
  financial: DEFAULT_FINANCIAL_CONFIG,
  gridConstraints: DEFAULT_GRID_CONSTRAINTS_CONFIG,
  loadGrowth: DEFAULT_LOAD_GROWTH_CONFIG,
};

// ============= Advanced Financial Results =============
export interface AdvancedFinancialResults {
  // Standard metrics
  npv: number; // Net Present Value
  irr: number; // Internal Rate of Return (%)
  mirr: number; // Modified Internal Rate of Return (%)
  lcoe: number; // Levelized Cost of Energy (R/kWh)
  
  // Year-by-year projections
  yearlyProjections: YearlyProjection[];
  
  // Cumulative savings over project lifetime
  lifetimeSavings: number;
  lifetimeGeneration: number;
  
  // Sensitivity analysis
  sensitivityResults?: SensitivityResults;
}

export interface YearlyProjection {
  year: number;
  solarGeneration: number; // kWh
  loadConsumption: number; // kWh
  gridImport: number; // kWh
  gridExport: number; // kWh
  
  // With degradation
  panelEfficiency: number; // %
  batteryCapacityRemaining: number; // %
  
  // Financials
  tariffRate: number; // R/kWh (escalated)
  energySavings: number; // R
  maintenanceCost: number; // R
  replacementCost: number; // R (if applicable)
  netCashFlow: number; // R
  cumulativeCashFlow: number; // R
  discountedCashFlow: number; // R (for NPV)
}

export interface SensitivityResults {
  expected: {
    npv: number;
    irr: number;
    payback: number;
  };
  best: {
    npv: number;
    irr: number;
    payback: number;
    assumptions: string;
  };
  worst: {
    npv: number;
    irr: number;
    payback: number;
    assumptions: string;
  };
}
