/**
 * Future Enhancements Types - Phase 8
 * 
 * Defines configuration and result types for advanced simulation features:
 * 1. Historical Weather Integration
 * 2. Grid Feed-in Tariff Modeling
 * 3. Multi-site Portfolio Analysis
 * 4. Carbon & Sustainability
 * 5. Financing Options
 * 6. Equipment Database
 */

// ============= 1. Historical Weather Integration =============
export interface HistoricalWeatherConfig {
  enabled: boolean;
  weatherApiProvider: 'solcast' | 'openmeteo' | 'nasa_power';
  dateRangeStart: string; // ISO date
  dateRangeEnd: string;
  compareToForecast: boolean;
  weatherAdjustmentEnabled: boolean;
}

export interface WeatherComparisonData {
  date: string;
  forecastGhi: number; // kWh/m²
  actualGhi: number;
  forecastGeneration: number; // kWh
  actualGeneration: number;
  performanceRatio: number; // actual/forecast %
}

export interface HistoricalWeatherResults {
  averagePerformanceRatio: number;
  totalForecastGeneration: number;
  totalActualGeneration: number;
  weatherLossPercent: number;
  monthlyComparison: WeatherComparisonData[];
}

export const DEFAULT_HISTORICAL_WEATHER_CONFIG: HistoricalWeatherConfig = {
  enabled: false,
  weatherApiProvider: 'solcast',
  dateRangeStart: '',
  dateRangeEnd: '',
  compareToForecast: true,
  weatherAdjustmentEnabled: true,
};

// ============= 2. Grid Feed-in Tariff Modeling =============
export interface FeedInTariffPeriod {
  id: string;
  name: string;
  startHour: number;
  endHour: number;
  ratePerKwh: number;
  daysApplicable: ('weekday' | 'saturday' | 'sunday')[];
}

export interface FeedInTariffConfig {
  enabled: boolean;
  meteringType: 'net' | 'gross';
  feedInPeriods: FeedInTariffPeriod[];
  escalationRate: number; // % per year
  minimumExportPrice: number; // Floor price R/kWh
  maximumExportPrice: number; // Cap price R/kWh
  gridConnectionFee: number; // Monthly R
}

export interface FeedInTariffResults {
  totalExportRevenue: number;
  averageExportRate: number;
  peakExportRevenue: number;
  offPeakExportRevenue: number;
  netMeteringCredits: number;
  annualExportRevenue: number;
}

export const DEFAULT_FEED_IN_TARIFF_CONFIG: FeedInTariffConfig = {
  enabled: false,
  meteringType: 'net',
  feedInPeriods: [
    {
      id: 'peak',
      name: 'Peak Export',
      startHour: 7,
      endHour: 10,
      ratePerKwh: 1.50,
      daysApplicable: ['weekday'],
    },
    {
      id: 'standard',
      name: 'Standard Export',
      startHour: 10,
      endHour: 18,
      ratePerKwh: 0.80,
      daysApplicable: ['weekday', 'saturday'],
    },
    {
      id: 'offpeak',
      name: 'Off-Peak Export',
      startHour: 22,
      endHour: 6,
      ratePerKwh: 0.40,
      daysApplicable: ['weekday', 'saturday', 'sunday'],
    },
  ],
  escalationRate: 8,
  minimumExportPrice: 0.30,
  maximumExportPrice: 2.50,
  gridConnectionFee: 500,
};

// ============= 3. Multi-site Portfolio Analysis =============
export interface PortfolioProject {
  projectId: string;
  projectName: string;
  location: string;
  solarCapacity: number;
  batteryCapacity: number;
  annualGeneration: number;
  annualSavings: number;
  npv: number;
  irr: number;
  payback: number;
  status: 'active' | 'planned' | 'decommissioned';
}

export interface PortfolioConfig {
  enabled: boolean;
  portfolioName: string;
  projectIds: string[];
  aggregationMethod: 'sum' | 'weighted_average';
  benchmarkIrr: number;
  targetPayback: number;
}

export interface PortfolioResults {
  totalCapacity: number;
  totalAnnualGeneration: number;
  totalAnnualSavings: number;
  portfolioNpv: number;
  weightedIrr: number;
  averagePayback: number;
  bestPerformer: PortfolioProject | null;
  worstPerformer: PortfolioProject | null;
  projectComparison: PortfolioProject[];
}

export const DEFAULT_PORTFOLIO_CONFIG: PortfolioConfig = {
  enabled: false,
  portfolioName: 'My Portfolio',
  projectIds: [],
  aggregationMethod: 'sum',
  benchmarkIrr: 15,
  targetPayback: 6,
};

// ============= 4. Carbon & Sustainability =============
export interface CarbonConfig {
  enabled: boolean;
  gridEmissionFactor: number; // kg CO2/kWh (SA default ~0.95)
  includeTransmissionLosses: boolean;
  transmissionLossPercent: number;
  recTrackingEnabled: boolean;
  recPricePerMwh: number; // R per MWh for RECs
  carbonTaxRate: number; // R per ton CO2
  esgReportingEnabled: boolean;
}

export interface CarbonResults {
  annualCo2Avoided: number; // kg
  lifetimeCo2Avoided: number; // kg
  equivalentTreesPlanted: number;
  equivalentCarsOffRoad: number;
  recValue: number; // R
  carbonTaxSavings: number; // R
  esgScore: number; // 0-100
}

export const DEFAULT_CARBON_CONFIG: CarbonConfig = {
  enabled: false,
  gridEmissionFactor: 0.95, // SA grid average
  includeTransmissionLosses: true,
  transmissionLossPercent: 8,
  recTrackingEnabled: false,
  recPricePerMwh: 150,
  carbonTaxRate: 190, // SA carbon tax per ton CO2
  esgReportingEnabled: false,
};

// ============= 5. Financing Options =============
export interface FinancingOption {
  id: string;
  type: 'cash' | 'ppa' | 'lease' | 'loan';
  name: string;
}

export interface PPAConfig {
  enabled: boolean;
  ppaRate: number; // R/kWh
  ppaEscalationRate: number; // % per year
  contractTerm: number; // years
  minimumOfftake: number; // % of generation
  performanceGuarantee: number; // % of projected
}

export interface LeaseConfig {
  enabled: boolean;
  monthlyPayment: number;
  leaseTerm: number; // months
  residualValue: number; // % of system cost
  buyoutOption: boolean;
  buyoutYear: number;
}

export interface LoanConfig {
  enabled: boolean;
  loanAmount: number;
  interestRate: number; // %
  loanTerm: number; // years
  downPayment: number; // %
  paymentFrequency: 'monthly' | 'quarterly' | 'annually';
}

export interface FinancingConfig {
  enabled: boolean;
  selectedOption: 'cash' | 'ppa' | 'lease' | 'loan';
  ppa: PPAConfig;
  lease: LeaseConfig;
  loan: LoanConfig;
}

export interface FinancingResults {
  selectedOption: string;
  totalCost: number;
  monthlyCashFlow: number[];
  effectiveRate: number; // R/kWh effective cost
  savingsVsCash: number;
  breakEvenYear: number;
  yearlyPayments: { year: number; payment: number; principal: number; interest: number }[];
}

export const DEFAULT_PPA_CONFIG: PPAConfig = {
  enabled: false,
  ppaRate: 1.20,
  ppaEscalationRate: 6,
  contractTerm: 20,
  minimumOfftake: 90,
  performanceGuarantee: 95,
};

export const DEFAULT_LEASE_CONFIG: LeaseConfig = {
  enabled: false,
  monthlyPayment: 25000,
  leaseTerm: 84, // 7 years
  residualValue: 10,
  buyoutOption: true,
  buyoutYear: 5,
};

export const DEFAULT_LOAN_CONFIG: LoanConfig = {
  enabled: false,
  loanAmount: 0, // Will be calculated from system cost
  interestRate: 11.5, // Prime rate
  loanTerm: 7,
  downPayment: 20,
  paymentFrequency: 'monthly',
};

export const DEFAULT_FINANCING_CONFIG: FinancingConfig = {
  enabled: false,
  selectedOption: 'cash',
  ppa: DEFAULT_PPA_CONFIG,
  lease: DEFAULT_LEASE_CONFIG,
  loan: DEFAULT_LOAN_CONFIG,
};

// ============= 6. Equipment Database =============
export interface PanelSpec {
  id: string;
  manufacturer: string;
  model: string;
  wattage: number; // Wp
  efficiency: number; // %
  voc: number; // V
  isc: number; // A
  vmp: number; // V
  imp: number; // A
  tempCoeffPmax: number; // %/°C
  dimensions: { width: number; height: number; depth: number }; // mm
  weight: number; // kg
  warranty: number; // years
  degradationRate: number; // %/year
}

export interface InverterSpec {
  id: string;
  manufacturer: string;
  model: string;
  ratedPower: number; // kW
  maxDcPower: number; // kW
  maxEfficiency: number; // %
  euroEfficiency: number; // %
  mpptCount: number;
  mpptVoltageRange: { min: number; max: number }; // V
  maxInputCurrent: number; // A
  acOutputVoltage: number; // V
  warranty: number; // years
}

export interface BatterySpec {
  id: string;
  manufacturer: string;
  model: string;
  chemistry: 'lfp' | 'nmc' | 'lead_acid' | 'flow';
  capacity: number; // kWh
  power: number; // kW
  roundTripEfficiency: number; // %
  depthOfDischarge: number; // %
  cycleLife: number; // cycles
  warranty: number; // years
  tempRange: { min: number; max: number }; // °C
}

export interface EquipmentConfig {
  enabled: boolean;
  selectedPanelId: string | null;
  selectedInverterId: string | null;
  selectedBatteryId: string | null;
  autoMatch: boolean; // Auto-select compatible equipment
}

export interface EquipmentResults {
  panelCount: number;
  stringsCount: number;
  panelsPerString: number;
  inverterCount: number;
  dcAcRatio: number;
  systemEfficiency: number;
  compatibilityScore: number; // 0-100
  warnings: string[];
}

export const DEFAULT_EQUIPMENT_CONFIG: EquipmentConfig = {
  enabled: false,
  selectedPanelId: null,
  selectedInverterId: null,
  selectedBatteryId: null,
  autoMatch: true,
};

// Sample equipment data
export const SAMPLE_PANELS: PanelSpec[] = [
  {
    id: 'canadian-550',
    manufacturer: 'Canadian Solar',
    model: 'HiKu6 CS6W-550MS',
    wattage: 550,
    efficiency: 21.2,
    voc: 49.6,
    isc: 14.0,
    vmp: 41.7,
    imp: 13.2,
    tempCoeffPmax: -0.34,
    dimensions: { width: 1134, height: 2278, depth: 35 },
    weight: 28.6,
    warranty: 25,
    degradationRate: 0.55,
  },
  {
    id: 'jinko-545',
    manufacturer: 'JinkoSolar',
    model: 'Tiger Neo N-type 545W',
    wattage: 545,
    efficiency: 21.1,
    voc: 49.3,
    isc: 13.9,
    vmp: 41.5,
    imp: 13.1,
    tempCoeffPmax: -0.30,
    dimensions: { width: 1134, height: 2278, depth: 30 },
    weight: 26.5,
    warranty: 25,
    degradationRate: 0.40,
  },
  {
    id: 'longi-555',
    manufacturer: 'LONGi',
    model: 'Hi-MO 5 LR5-72HBD-555M',
    wattage: 555,
    efficiency: 21.4,
    voc: 49.8,
    isc: 14.1,
    vmp: 42.0,
    imp: 13.3,
    tempCoeffPmax: -0.35,
    dimensions: { width: 1134, height: 2278, depth: 35 },
    weight: 27.5,
    warranty: 25,
    degradationRate: 0.45,
  },
];

export const SAMPLE_INVERTERS: InverterSpec[] = [
  {
    id: 'huawei-100',
    manufacturer: 'Huawei',
    model: 'SUN2000-100KTL-M1',
    ratedPower: 100,
    maxDcPower: 150,
    maxEfficiency: 98.8,
    euroEfficiency: 98.5,
    mpptCount: 10,
    mpptVoltageRange: { min: 200, max: 1000 },
    maxInputCurrent: 22,
    acOutputVoltage: 400,
    warranty: 10,
  },
  {
    id: 'sungrow-110',
    manufacturer: 'Sungrow',
    model: 'SG110CX',
    ratedPower: 110,
    maxDcPower: 165,
    maxEfficiency: 98.7,
    euroEfficiency: 98.4,
    mpptCount: 9,
    mpptVoltageRange: { min: 180, max: 1000 },
    maxInputCurrent: 26,
    acOutputVoltage: 400,
    warranty: 10,
  },
];

export const SAMPLE_BATTERIES: BatterySpec[] = [
  {
    id: 'byd-hvs',
    manufacturer: 'BYD',
    model: 'Battery-Box Premium HVS',
    chemistry: 'lfp',
    capacity: 10.2,
    power: 10.2,
    roundTripEfficiency: 95.3,
    depthOfDischarge: 96,
    cycleLife: 6000,
    warranty: 10,
    tempRange: { min: -10, max: 50 },
  },
  {
    id: 'tesla-powerwall',
    manufacturer: 'Tesla',
    model: 'Powerwall 3',
    chemistry: 'nmc',
    capacity: 13.5,
    power: 11.5,
    roundTripEfficiency: 92,
    depthOfDischarge: 100,
    cycleLife: 4000,
    warranty: 10,
    tempRange: { min: -20, max: 50 },
  },
];

// ============= Combined Enhancement Config =============
export interface FutureEnhancementsConfig {
  historicalWeather: HistoricalWeatherConfig;
  feedInTariff: FeedInTariffConfig;
  portfolio: PortfolioConfig;
  carbon: CarbonConfig;
  financing: FinancingConfig;
  equipment: EquipmentConfig;
}

export const DEFAULT_FUTURE_ENHANCEMENTS_CONFIG: FutureEnhancementsConfig = {
  historicalWeather: DEFAULT_HISTORICAL_WEATHER_CONFIG,
  feedInTariff: DEFAULT_FEED_IN_TARIFF_CONFIG,
  portfolio: DEFAULT_PORTFOLIO_CONFIG,
  carbon: DEFAULT_CARBON_CONFIG,
  financing: DEFAULT_FINANCING_CONFIG,
  equipment: DEFAULT_EQUIPMENT_CONFIG,
};
