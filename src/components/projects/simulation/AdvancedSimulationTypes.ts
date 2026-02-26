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
  
  // Panel degradation - year-by-year configuration
  panelDegradationMode: 'simple' | 'yearly';  // Toggle between modes
  panelSimpleRate: number;                     // Single rate for simple mode (%)
  panelYearlyRates: number[];                  // Array of rates for yearly mode (one per year)
  
  // Battery degradation - year-by-year configuration
  batteryDegradationMode: 'simple' | 'yearly';
  batterySimpleRate: number;                   // Single rate for simple mode (%)
  batteryYearlyRates: number[];                // Array of rates for yearly mode (one per year)
  batteryEolCapacity: number;                  // End-of-life capacity threshold (e.g., 70%)
  
  // Legacy fields for backwards compatibility (deprecated)
  panelDegradationRate?: number;
  panelFirstYearDegradation?: number;
  batteryDegradationRate?: number;
  inverterReplacementYear?: number;
  inverterReplacementCost?: number;
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
  
  // Insurance costs (NEW: Income-based approach)
  insuranceEnabled: boolean;
  baseInsuranceCostR: number; // Year 1 insurance (e.g., R12,500)
  insuranceEscalationRate: number; // % (typically same as CPI, 6%)
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

// Helper to generate default yearly rates
const generateYearlyRates = (rate: number, years: number = 20): number[] => 
  Array(years).fill(rate);

// Import centralized variables for defaults
import { 
  getDegradationVariables, 
  getFinancialVariables,
  getCostBreakdownVariables,
} from "@/hooks/useCalculationDefaults";

// Dynamic getters that read from centralized Settings
function getDegradationDefaults() {
  const vars = getDegradationVariables();
  return {
    panelSimpleRate: vars.annualPanelDegradation,
    firstYearDegradation: vars.firstYearDegradation,
    batterySimpleRate: vars.annualBatteryDegradation,
    batteryEolCapacity: vars.batteryEolCapacity,
    projectLifetimeYears: vars.projectLifetimeYears,
  };
}

function getFinancialDefaults() {
  const vars = getFinancialVariables();
  return {
    tariffEscalationRate: vars.tariffEscalation,
    inflationRate: vars.cpiInflation,
    discountRate: vars.discountRate,
    insuranceEscalationRate: vars.cpiInflation,
  };
}

export const DEFAULT_DEGRADATION_CONFIG: DegradationConfig = {
  enabled: false,
  
  // Panel defaults - read from centralized Settings
  panelDegradationMode: 'simple',
  get panelSimpleRate() { return getDegradationDefaults().panelSimpleRate; },
  get panelYearlyRates() {
    const defaults = getDegradationDefaults();
    return [
      defaults.firstYearDegradation,  // Year 1 - higher initial degradation (LID + settling)
      ...generateYearlyRates(defaults.panelSimpleRate, 19),  // Years 2-20
    ];
  },
  
  // Battery defaults - read from centralized Settings
  batteryDegradationMode: 'simple',
  get batterySimpleRate() { return getDegradationDefaults().batterySimpleRate; },
  get batteryYearlyRates() { return generateYearlyRates(getDegradationDefaults().batterySimpleRate, 20); },
  get batteryEolCapacity() { return getDegradationDefaults().batteryEolCapacity; },
  
  // Legacy (deprecated) - kept for backwards compatibility
  get panelDegradationRate() { return getDegradationDefaults().panelSimpleRate; },
  get panelFirstYearDegradation() { return getDegradationDefaults().firstYearDegradation; },
  get batteryDegradationRate() { return getDegradationDefaults().batterySimpleRate; },
  get inverterReplacementYear() { return getCostBreakdownVariables().replacementYear; },
  inverterReplacementCost: 50000,
};

export const DEFAULT_FINANCIAL_CONFIG: AdvancedFinancialConfig = {
  enabled: true, // Enabled by default for O&M CPI escalation
  get tariffEscalationRate() { return getFinancialDefaults().tariffEscalationRate; },
  get inflationRate() { return getFinancialDefaults().inflationRate; },
  get discountRate() { return getFinancialDefaults().discountRate; },
  get projectLifetimeYears() { return getDegradationDefaults().projectLifetimeYears; },
  sensitivityEnabled: false,
  sensitivityVariation: 20,
  // Insurance defaults (enabled - 1% of total capital + O&M, escalated by CPI)
  insuranceEnabled: true,
  baseInsuranceCostR: 0,
  get insuranceEscalationRate() { return getFinancialDefaults().insuranceEscalationRate; },
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

// ============= Presets =============
export type PresetName = 'conservative' | 'optimistic' | 'sa_market_standard';

export interface SimulationPreset {
  name: string;
  description: string;
  config: AdvancedSimulationConfig;
}

export const SIMULATION_PRESETS: Record<PresetName, SimulationPreset> = {
  conservative: {
    name: "Conservative",
    description: "Lower expectations, higher degradation rates, cautious assumptions",
    config: {
      seasonal: {
        ...DEFAULT_SEASONAL_CONFIG,
        enabled: true,
        highDemandLoadMultiplier: 1.08,
        lowDemandLoadMultiplier: 0.95,
      },
      degradation: {
        ...DEFAULT_DEGRADATION_CONFIG,
        enabled: true,
        panelDegradationMode: 'simple',
        panelSimpleRate: 0.7,
        batteryDegradationMode: 'simple',
        batterySimpleRate: 4.0,
        batteryEolCapacity: 70,
      },
      financial: {
        enabled: true,
        tariffEscalationRate: 8.0,
        inflationRate: 6.5,
        discountRate: 12.0,
        projectLifetimeYears: 20,
        sensitivityEnabled: true,
        sensitivityVariation: 25,
        insuranceEnabled: false,
        baseInsuranceCostR: 0,
        insuranceEscalationRate: 6.5,
      },
      gridConstraints: {
        ...DEFAULT_GRID_CONSTRAINTS_CONFIG,
        enabled: false,
      },
      loadGrowth: {
        enabled: true,
        annualGrowthRate: 1.0,
        newTenantEnabled: false,
        newTenantYear: 3,
        newTenantLoadKwh: 5000,
      },
    },
  },
  optimistic: {
    name: "Optimistic",
    description: "Higher performance assumptions, lower degradation, favorable economics",
    config: {
      seasonal: {
        ...DEFAULT_SEASONAL_CONFIG,
        enabled: true,
        highDemandLoadMultiplier: 1.03,
        lowDemandLoadMultiplier: 0.98,
      },
      degradation: {
        ...DEFAULT_DEGRADATION_CONFIG,
        enabled: true,
        panelDegradationMode: 'simple',
        panelSimpleRate: 0.4,
        batteryDegradationMode: 'simple',
        batterySimpleRate: 2.5,
        batteryEolCapacity: 75,
      },
      financial: {
        enabled: true,
        tariffEscalationRate: 12.0,
        inflationRate: 4.5,
        discountRate: 8.0,
        projectLifetimeYears: 30,
        sensitivityEnabled: true,
        sensitivityVariation: 15,
        insuranceEnabled: false,
        baseInsuranceCostR: 0,
        insuranceEscalationRate: 4.5,
      },
      gridConstraints: {
        ...DEFAULT_GRID_CONSTRAINTS_CONFIG,
        enabled: false,
      },
      loadGrowth: {
        enabled: true,
        annualGrowthRate: 3.0,
        newTenantEnabled: false,
        newTenantYear: 3,
        newTenantLoadKwh: 5000,
      },
    },
  },
  sa_market_standard: {
    name: "SA Market Standard",
    description: "Realistic South African market assumptions based on industry data",
    config: {
      seasonal: {
        enabled: true,
        monthlyIrradianceFactors: [1.15, 1.10, 1.05, 0.95, 0.85, 0.80, 0.82, 0.90, 1.00, 1.08, 1.15, 1.15],
        highDemandMonths: [5, 6, 7],
        highDemandLoadMultiplier: 1.05,
        lowDemandLoadMultiplier: 0.98,
      },
      degradation: {
        ...DEFAULT_DEGRADATION_CONFIG,
        enabled: true,
        panelDegradationMode: 'simple',
        panelSimpleRate: 0.5,
        batteryDegradationMode: 'simple',
        batterySimpleRate: 3.0,
        batteryEolCapacity: 70,
      },
      financial: {
        enabled: true,
        tariffEscalationRate: 10.0,
        inflationRate: 5.5,
        discountRate: 10.0,
        projectLifetimeYears: 20,
        sensitivityEnabled: true,
        sensitivityVariation: 20,
        insuranceEnabled: false,
        baseInsuranceCostR: 0,
        insuranceEscalationRate: 5.5,
      },
      gridConstraints: {
        enabled: true,
        maxExportKw: 100,
        exportLimitEnabled: false,
        exportRestrictedHours: [],
        exportRestrictionsEnabled: false,
        wheelingChargePerKwh: 0.30,
        wheelingEnabled: false,
      },
      loadGrowth: {
        enabled: true,
        annualGrowthRate: 2.0,
        newTenantEnabled: false,
        newTenantYear: 3,
        newTenantLoadKwh: 5000,
      },
    },
  },
};

// ============= Column Totals for Transparency =============
export interface ColumnTotals {
  totalEnergyYield: number;        // Sum of Energy Yield column
  npvEnergyYield: number;          // Sum of Discounted Energy Yield column (for LCOE)
  totalIncome: number;             // Sum of Total Income column
  totalInsurance: number;          // Sum of Insurance column
  totalOM: number;                 // Sum of O&M column
  totalReplacements: number;       // Sum of Replacements column
  totalCosts: number;              // Sum of Total Cost column (excluding replacements)
  totalNetCashflow: number;        // Sum of Net Cashflow column
}

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
  
  // Column totals for transparency (matches cashflow table)
  columnTotals: ColumnTotals;
  
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
  
  // Financials (legacy - kept for backwards compatibility)
  tariffRate: number; // R/kWh (escalated)
  energySavings: number; // R (legacy, replaced by income approach)
  maintenanceCost: number; // R
  replacementCost: number; // R (if applicable)
  netCashFlow: number; // R
  cumulativeCashFlow: number; // R
  discountedCashFlow: number; // R (for NPV)
  
  // NEW: Income-based approach (Excel model alignment)
  energyYield: number; // kWh (total solar production with degradation — for LCOE, not revenue)
  discountedEnergyYield: number; // kWh discounted by LCOE rate (for LCOE denominator)
  revenueKwh: number; // kWh that actually earn revenue (solar-to-load + battery-to-load)
  exportKwh: number; // kWh exported to grid (earns at export rate)
  energyRateIndex: number; // Tariff escalation factor (1.0, 1.1, 1.21...)
  energyRateR: number; // R/kWh (base rate × index) - actual tariff charged
  energyIncomeR: number; // R = revenueKwh × baseRate × index (load-displacement revenue)
  exportIncomeR: number; // R = exportKwh × exportRate × index (grid export revenue)
  
  demandSavingKva: number; // kVA reduction from solar
  demandRateIndex: number; // Demand escalation factor
  demandRateR: number; // R/kVA (base demand rate × index) - actual demand charge
  demandIncomeR: number; // R = kVA × R/kVA × 12 × index
  
  totalIncomeR: number; // energyIncome + demandIncome
  
  insuranceCostR: number; // Insurance with CPI escalation
  totalCostR: number; // insurance + maintenance
  
  // Present Value calculations (for NPV transparency)
  pvReductionFactor: number; // (1 + discountRate)^-year - starts at 1/(1+r) for year 1
  presentValue: number; // netCashFlow × pvReductionFactor
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
