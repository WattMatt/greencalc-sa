import { EngineeringKPIs, EnvironmentalMetrics, FinancialSummary, YearlyCashflow } from "../types";

// South African grid emission factor (kg CO2 per kWh)
// Based on Eskom's carbon intensity
const GRID_EMISSION_FACTOR_KG_PER_KWH = 0.95;

// Conversion factors for environmental equivalents
const KG_CO2_PER_TREE_PER_YEAR = 22; // Average tree absorbs ~22kg CO2/year
const KG_CO2_PER_CAR_MILE = 0.404; // Average car emits ~404g CO2/mile
const KWH_PER_HOME_PER_YEAR = 10908; // Average SA household consumption

/**
 * Calculate engineering KPIs from simulation results
 */
export function calculateEngineeringKPIs(params: {
  solarCapacityKwp: number;
  annualSolarGenerationKwh: number;
  annualConsumptionKwh: number;
  selfConsumptionKwh: number;
  gridImportKwh: number;
  gridExportKwh: number;
  batteryCapacityKwh: number;
  batteryThroughputKwh: number;
  peakDemandKw: number;
  peakDemandWithSolarKw: number;
  systemCost: number;
  systemLifeYears?: number;
}): EngineeringKPIs {
  const {
    solarCapacityKwp,
    annualSolarGenerationKwh,
    annualConsumptionKwh,
    selfConsumptionKwh,
    gridImportKwh,
    batteryCapacityKwh,
    batteryThroughputKwh,
    peakDemandKw,
    peakDemandWithSolarKw,
    systemCost,
    systemLifeYears = 20
  } = params;

  // Specific Yield (kWh/kWp)
  const specificYield = solarCapacityKwp > 0 
    ? annualSolarGenerationKwh / solarCapacityKwp 
    : 0;

  // Performance Ratio (%)
  // Theoretical max based on 1800 kWh/kWp for South Africa
  const theoreticalMaxKwh = solarCapacityKwp * 1800;
  const performanceRatio = theoreticalMaxKwh > 0 
    ? (annualSolarGenerationKwh / theoreticalMaxKwh) * 100 
    : 0;

  // Capacity Factor (%)
  // Average output vs peak capacity over the year
  const hoursPerYear = 8760;
  const theoreticalMaxOutput = solarCapacityKwp * hoursPerYear;
  const capacityFactor = theoreticalMaxOutput > 0 
    ? (annualSolarGenerationKwh / theoreticalMaxOutput) * 100 
    : 0;

  // LCOE (R/kWh)
  // Simplified: Total cost / Total lifetime energy
  const lifetimeEnergyKwh = annualSolarGenerationKwh * systemLifeYears * 0.92; // 8% degradation factor
  const lcoe = lifetimeEnergyKwh > 0 
    ? systemCost / lifetimeEnergyKwh 
    : 0;

  // Self-consumption Rate (%)
  const selfConsumptionRate = annualSolarGenerationKwh > 0 
    ? (selfConsumptionKwh / annualSolarGenerationKwh) * 100 
    : 0;

  // Solar Coverage (%)
  const solarCoverage = annualConsumptionKwh > 0 
    ? (selfConsumptionKwh / annualConsumptionKwh) * 100 
    : 0;

  // Grid Independence (%)
  // Including battery contribution
  const totalSelfSupplied = selfConsumptionKwh + (batteryThroughputKwh * 0.9); // 90% round-trip efficiency
  const gridIndependence = annualConsumptionKwh > 0 
    ? Math.min(100, (totalSelfSupplied / annualConsumptionKwh) * 100)
    : 0;

  // Peak Shaving (kW)
  const peakShavingKw = Math.max(0, peakDemandKw - peakDemandWithSolarKw);

  return {
    specific_yield: Math.round(specificYield),
    performance_ratio: Math.round(performanceRatio * 10) / 10,
    capacity_factor: Math.round(capacityFactor * 10) / 10,
    lcoe: Math.round(lcoe * 100) / 100,
    self_consumption_rate: Math.round(selfConsumptionRate * 10) / 10,
    solar_coverage: Math.round(solarCoverage * 10) / 10,
    grid_independence: Math.round(gridIndependence * 10) / 10,
    peak_shaving_kw: Math.round(peakShavingKw * 10) / 10
  };
}

/**
 * Calculate environmental impact metrics
 */
export function calculateEnvironmentalMetrics(params: {
  annualSolarGenerationKwh: number;
  selfConsumptionKwh: number;
}): EnvironmentalMetrics {
  const { annualSolarGenerationKwh, selfConsumptionKwh } = params;

  // CO2 avoided based on grid displacement
  const co2AvoidedKg = selfConsumptionKwh * GRID_EMISSION_FACTOR_KG_PER_KWH;
  const co2AvoidedTons = co2AvoidedKg / 1000;

  // Equivalent trees
  const treesEquivalent = co2AvoidedKg / KG_CO2_PER_TREE_PER_YEAR;

  // Equivalent car miles
  const carMilesAvoided = co2AvoidedKg / KG_CO2_PER_CAR_MILE;

  // Equivalent homes powered
  const homesPoweredEquivalent = annualSolarGenerationKwh / KWH_PER_HOME_PER_YEAR;

  return {
    co2_avoided_tons: Math.round(co2AvoidedTons * 10) / 10,
    trees_equivalent: Math.round(treesEquivalent),
    car_miles_avoided: Math.round(carMilesAvoided),
    homes_powered_equivalent: Math.round(homesPoweredEquivalent * 10) / 10,
    grid_emission_factor: GRID_EMISSION_FACTOR_KG_PER_KWH
  };
}

/**
 * Calculate financial summary and cashflows
 */
export function calculateFinancialSummary(params: {
  systemCost: number;
  annualSavings: number;
  annualGridCostBaseline: number;
  annualGridCostWithSolar: number;
  discountRate?: number;
  systemLifeYears?: number;
  annualDegradation?: number;
  tariffEscalation?: number;
}): FinancialSummary {
  const {
    systemCost,
    annualSavings,
    annualGridCostBaseline,
    annualGridCostWithSolar,
    discountRate = 0.08, // 8% default
    systemLifeYears = 20,
    annualDegradation = 0.005, // 0.5% per year
    tariffEscalation = 0.10 // 10% annual tariff increase (SA context)
  } = params;

  // Simple payback
  const paybackYears = annualSavings > 0 ? systemCost / annualSavings : Infinity;

  // Generate yearly cashflows
  const yearlyCashflows: YearlyCashflow[] = [];
  let cumulativeSavings = 0;
  let npv = -systemCost;
  
  for (let year = 1; year <= systemLifeYears; year++) {
    // Adjust savings for degradation and tariff escalation
    const degradationFactor = Math.pow(1 - annualDegradation, year - 1);
    const escalationFactor = Math.pow(1 + tariffEscalation, year - 1);
    const yearSavings = annualSavings * degradationFactor * escalationFactor;
    
    cumulativeSavings += yearSavings;
    
    // NPV calculation
    const discountFactor = Math.pow(1 + discountRate, year);
    npv += yearSavings / discountFactor;
    
    yearlyCashflows.push({
      year,
      cumulative_savings: Math.round(cumulativeSavings),
      cumulative_cost: systemCost,
      net_position: Math.round(cumulativeSavings - systemCost)
    });
  }

  // ROI
  const totalSavings = cumulativeSavings;
  const roiPercent = systemCost > 0 ? ((totalSavings - systemCost) / systemCost) * 100 : 0;

  // IRR calculation (simplified Newton-Raphson)
  const irr = calculateIRR(systemCost, yearlyCashflows.map((cf, i) => {
    const degradationFactor = Math.pow(1 - annualDegradation, i);
    const escalationFactor = Math.pow(1 + tariffEscalation, i);
    return annualSavings * degradationFactor * escalationFactor;
  }));

  return {
    system_cost: Math.round(systemCost),
    annual_grid_cost_baseline: Math.round(annualGridCostBaseline),
    annual_grid_cost_with_solar: Math.round(annualGridCostWithSolar),
    annual_savings: Math.round(annualSavings),
    payback_years: Math.round(paybackYears * 10) / 10,
    roi_percent: Math.round(roiPercent),
    npv: Math.round(npv),
    irr: Math.round(irr * 10) / 10,
    yearly_cashflows: yearlyCashflows
  };
}

/**
 * Calculate Internal Rate of Return using Newton-Raphson method
 */
function calculateIRR(initialInvestment: number, cashflows: number[], maxIterations = 100): number {
  let irr = 0.1; // Start with 10% guess
  
  for (let i = 0; i < maxIterations; i++) {
    let npv = -initialInvestment;
    let derivative = 0;
    
    for (let t = 0; t < cashflows.length; t++) {
      const discountFactor = Math.pow(1 + irr, t + 1);
      npv += cashflows[t] / discountFactor;
      derivative -= (t + 1) * cashflows[t] / Math.pow(1 + irr, t + 2);
    }
    
    if (Math.abs(npv) < 0.01) break;
    if (derivative === 0) break;
    
    irr = irr - npv / derivative;
    
    // Clamp to reasonable range
    irr = Math.max(-0.99, Math.min(1, irr));
  }
  
  return irr * 100; // Return as percentage
}

/**
 * Format currency for South African Rand
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

/**
 * Format large numbers with abbreviations
 */
export function formatLargeNumber(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return value.toFixed(0);
}
