/**
 * AdvancedSimulationEngine - Extended calculations for sophisticated modeling
 * 
 * Builds on EnergySimulationEngine to add:
 * - Multi-year projections with degradation
 * - Seasonal variations
 * - Grid constraints
 * - Load growth
 * - NPV/IRR calculations
 */

import { EnergySimulationResults } from "./EnergySimulationEngine";
import { TariffData, SystemCosts } from "./FinancialAnalysis";
import {
  AdvancedSimulationConfig,
  AdvancedFinancialResults,
  YearlyProjection,
  SensitivityResults,
  DegradationConfig,
  SeasonalConfig,
  GridConstraintsConfig,
  LoadGrowthConfig,
  ColumnTotals,
} from "./AdvancedSimulationTypes";

/**
 * Apply seasonal irradiance factor for a given month
 */
export function getSeasonalIrradianceFactor(
  month: number, // 0-indexed
  config: SeasonalConfig
): number {
  if (!config.enabled) return 1.0;
  return config.monthlyIrradianceFactors[month] ?? 1.0;
}

/**
 * Get load multiplier for a given month (High/Low demand season)
 */
export function getSeasonalLoadMultiplier(
  month: number,
  config: SeasonalConfig
): number {
  if (!config.enabled) return 1.0;
  
  const isHighDemand = config.highDemandMonths.includes(month);
  return isHighDemand 
    ? config.highDemandLoadMultiplier 
    : config.lowDemandLoadMultiplier;
}

/**
 * Calculate panel efficiency after degradation for a given year
 * Degradation is applied at END of year, meaning:
 * - Year 1: Full production (100% efficiency, no degradation yet)
 * - Year 2: Apply Year 1's degradation rate
 * - Year N: Apply cumulative degradation from Years 1 to N-1
 */
export function getPanelEfficiency(
  year: number,
  config: DegradationConfig
): number {
  if (!config.enabled) return 100;
  
  // Year 1 has no degradation (degradation happens at end of year)
  if (year <= 1) return 100;
  
  let totalDegradation = 0;
  
  // Check if using new yearly mode
  if (config.panelDegradationMode === 'yearly' && config.panelYearlyRates?.length > 0) {
    // Sum degradation from Year 1 to Year (N-1) - applied at end of each year
    // Year 2 gets Year 1's degradation, Year 3 gets Year 1+2's degradation, etc.
    for (let y = 0; y < year - 1 && y < config.panelYearlyRates.length; y++) {
      totalDegradation += config.panelYearlyRates[y];
    }
  } else if (config.panelDegradationMode === 'simple' && config.panelSimpleRate !== undefined) {
    // Simple mode: apply same rate every year (N-1 years of degradation)
    totalDegradation = (year - 1) * config.panelSimpleRate;
  } else {
    // Legacy fallback for backwards compatibility
    const firstYearDeg = config.panelFirstYearDegradation ?? 2.0;
    const subsequentDeg = (year - 2) * (config.panelDegradationRate ?? 0.5);
    totalDegradation = firstYearDeg + Math.max(0, subsequentDeg);
  }
  
  return Math.max(0, 100 - totalDegradation);
}

/**
 * Calculate battery capacity remaining after degradation
 * Degradation is applied at END of year (same logic as panels)
 */
export function getBatteryCapacityRemaining(
  year: number,
  config: DegradationConfig
): number {
  if (!config.enabled) return 100;
  
  // Year 1 has no degradation
  if (year <= 1) return 100;
  
  let totalDegradation = 0;
  
  // Check if using new yearly mode
  if (config.batteryDegradationMode === 'yearly' && config.batteryYearlyRates?.length > 0) {
    // Sum degradation from Year 1 to Year (N-1)
    for (let y = 0; y < year - 1 && y < config.batteryYearlyRates.length; y++) {
      totalDegradation += config.batteryYearlyRates[y];
    }
  } else if (config.batteryDegradationMode === 'simple' && config.batterySimpleRate !== undefined) {
    // Simple mode: apply same rate every year (N-1 years)
    totalDegradation = (year - 1) * config.batterySimpleRate;
  } else {
    // Legacy fallback
    totalDegradation = (year - 1) * (config.batteryDegradationRate ?? 3.0);
  }
  
  const remaining = 100 - totalDegradation;
  
  // Don't go below EOL capacity
  return Math.max(remaining, config.batteryEolCapacity);
}

/**
 * Apply grid export constraints to simulation results
 */
export function applyGridConstraints(
  hourlyExport: number[], // 24-hour export profile
  config: GridConstraintsConfig
): { constrainedExport: number[]; curtailment: number } {
  if (!config.enabled) {
    return { constrainedExport: hourlyExport, curtailment: 0 };
  }
  
  let totalCurtailment = 0;
  const constrainedExport = hourlyExport.map((exp, hour) => {
    let constrained = exp;
    
    // Apply maximum export limit
    if (config.exportLimitEnabled && exp > config.maxExportKw) {
      totalCurtailment += exp - config.maxExportKw;
      constrained = config.maxExportKw;
    }
    
    // Apply time-based restrictions
    if (config.exportRestrictionsEnabled && 
        config.exportRestrictedHours.includes(hour)) {
      totalCurtailment += constrained;
      constrained = 0;
    }
    
    return constrained;
  });
  
  return { constrainedExport, curtailment: totalCurtailment };
}

/**
 * Calculate load for a given year with growth
 */
export function getYearlyLoad(
  baseAnnualLoad: number,
  year: number,
  config: LoadGrowthConfig
): number {
  if (!config.enabled) return baseAnnualLoad;
  
  // Apply annual growth
  const growthMultiplier = Math.pow(1 + config.annualGrowthRate / 100, year - 1);
  let yearlyLoad = baseAnnualLoad * growthMultiplier;
  
  // Add new tenant load if applicable
  if (config.newTenantEnabled && year >= config.newTenantYear) {
    yearlyLoad += config.newTenantLoadKwh * 12; // Convert monthly to annual
  }
  
  return yearlyLoad;
}

/**
 * Calculate escalated tariff rate for a given year
 */
export function getEscalatedTariff(
  baseRate: number,
  year: number,
  escalationRate: number
): number {
  return baseRate * Math.pow(1 + escalationRate / 100, year - 1);
}

/**
 * Calculate NPV from cash flows
 */
export function calculateNPV(
  cashFlows: number[],
  discountRate: number
): number {
  return cashFlows.reduce((npv, cf, year) => {
    const discountFactor = Math.pow(1 + discountRate / 100, year);
    return npv + cf / discountFactor;
  }, 0);
}

/**
 * Calculate IRR using Newton-Raphson method
 */
export function calculateIRR(
  cashFlows: number[],
  maxIterations: number = 100,
  tolerance: number = 0.0001
): number {
  let irr = 0.1; // Initial guess: 10%
  
  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let derivative = 0;
    
    for (let t = 0; t < cashFlows.length; t++) {
      const factor = Math.pow(1 + irr, t);
      npv += cashFlows[t] / factor;
      if (t > 0) {
        derivative -= t * cashFlows[t] / Math.pow(1 + irr, t + 1);
      }
    }
    
    if (Math.abs(npv) < tolerance) break;
    if (Math.abs(derivative) < 0.000001) break;
    
    irr = irr - npv / derivative;
    
    // Bound IRR to reasonable range
    if (irr < -0.99) irr = -0.99;
    if (irr > 5) irr = 5;
  }
  
  return irr * 100;
}

/**
 * Calculate MIRR (Modified Internal Rate of Return)
 * Uses separate finance rate for negative cash flows and reinvestment rate for positive cash flows
 */
export function calculateMIRR(
  cashFlows: number[],
  financeRate: number,      // Interest rate paid on money used in cash flows
  reinvestmentRate: number  // Interest rate received on reinvestment
): number {
  const n = cashFlows.length - 1;
  if (n <= 0) return 0;
  
  // Present value of negative cash flows at finance rate
  let pvNegative = 0;
  for (let t = 0; t < cashFlows.length; t++) {
    if (cashFlows[t] < 0) {
      pvNegative += cashFlows[t] / Math.pow(1 + financeRate / 100, t);
    }
  }
  
  // Future value of positive cash flows at reinvestment rate
  let fvPositive = 0;
  for (let t = 0; t < cashFlows.length; t++) {
    if (cashFlows[t] > 0) {
      fvPositive += cashFlows[t] * Math.pow(1 + reinvestmentRate / 100, n - t);
    }
  }
  
  // MIRR formula: (FV of positive / |PV of negative|)^(1/n) - 1
  if (pvNegative === 0 || fvPositive === 0) return 0;
  
  const mirr = Math.pow(-fvPositive / pvNegative, 1 / n) - 1;
  
  return mirr * 100;
}

/**
 * Calculate LCOE (Levelized Cost of Energy)
 * Formula: Undiscounted Total Costs / NPV of Energy Yield
 * 
 * Uses ACTUAL values directly from cashflow projections - no recalculation.
 * npvEnergyYield is the sum of discountedEnergyYield from yearly projections.
 * yearlyMaintenanceCosts already contains CPI-escalated O&M + Insurance from projections.
 */
export function calculateLCOE(
  totalSystemCost: number,
  npvEnergyYield: number,              // Pre-calculated sum of discounted yields from projections
  yearlyMaintenanceCosts: number[],    // Already CPI-escalated from cashflow projections
  yearlyReplacementCosts: number[]
): number {
  // Numerator: Undiscounted sum of ALL costs from cashflow breakdown
  // Initial Capital + Sum(O&M + Insurance) + Sum(Replacements)
  let totalCosts = totalSystemCost;
  
  for (let year = 0; year < yearlyMaintenanceCosts.length; year++) {
    totalCosts += yearlyMaintenanceCosts[year];  // Use actual escalated values from projections
    totalCosts += yearlyReplacementCosts[year] || 0;
  }
  
  // Denominator: NPV of Energy Yield (pre-calculated from discountedEnergyYield column)
  return npvEnergyYield > 0 ? totalCosts / npvEnergyYield : 0;
}

/**
 * Run advanced multi-year simulation with Income-based methodology
 * Aligned with Excel cashflow model: separate Energy Income + Demand Income
 */
export function runAdvancedSimulation(
  baseEnergyResults: EnergySimulationResults,
  tariff: TariffData,
  systemCosts: SystemCosts,
  solarCapacity: number,
  batteryCapacity: number,
  advancedConfig: AdvancedSimulationConfig
): AdvancedFinancialResults {
  const { financial, degradation, loadGrowth, gridConstraints } = advancedConfig;
  
  const lifetimeYears = financial.enabled 
    ? financial.projectLifetimeYears 
    : 20;
  
  const baseAnnualLoad = baseEnergyResults.totalDailyLoad * 365;
  const baseAnnualSolar = baseEnergyResults.totalDailySolar * 365;
  const baseAnnualGridImport = baseEnergyResults.totalGridImport * 365;
  const baseAnnualGridExport = baseEnergyResults.totalGridExport * 365;
  
  // Calculate initial system cost (Total Capital Cost)
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
  const initialCost = subtotalWithFees + contingency;
  
  // ===== Income-based approach: Base values (Year 1, before escalation) =====
  const baseEnergyRate = tariff.averageRatePerKwh;
  const baseDemandRate = tariff.demandChargePerKva ?? 0;
  const baseMaintenance = systemCosts.maintenancePerYear ?? 0;
  
  // Insurance = X% of Total Capital Cost only (excluding O&M)
  // Insurance Rate produces a monthly amount - multiply by 12 for annual
  // This base value is then escalated by CPI each year
  const insuranceRatePercent = systemCosts.insuranceRatePercent ?? 1.0; // Default 1% if not set
  const insuranceBase = initialCost * (insuranceRatePercent / 100) * 12;
  const baseInsurance = financial.enabled && financial.insuranceEnabled 
    ? insuranceBase 
    : 0;
  
  // Calculate demand saving (kVA) from peak load reduction
  const powerFactor = 0.9;
  const peakLoadKva = baseEnergyResults.peakLoad / powerFactor;
  const peakWithSolarKva = baseEnergyResults.peakGridImport / powerFactor;
  const demandSavingKva = Math.max(0, peakLoadKva - peakWithSolarKva);
  
  // Escalation rates
  const tariffEscalation = financial.enabled ? financial.tariffEscalationRate : 10;
  const inflationRate = financial.enabled ? financial.inflationRate : 6;
  const insuranceEscalation = financial.enabled ? financial.insuranceEscalationRate : inflationRate;
  
  const yearlyProjections: YearlyProjection[] = [];
  const cashFlows: number[] = [-initialCost]; // Year 0 is investment
  const yearlyGenerations: number[] = [];
  const yearlyMaintenanceCosts: number[] = [];
  
  let cumulativeCashFlow = -initialCost;
  let lifetimeSavings = 0;
  let lifetimeGeneration = 0;
  
  for (let year = 1; year <= lifetimeYears; year++) {
    // Calculate degraded generation
    const panelEfficiency = getPanelEfficiency(year, degradation);
    const batteryRemaining = getBatteryCapacityRemaining(year, degradation);
    
    // Energy yield (kWh) with degradation
    const energyYield = baseAnnualSolar * (panelEfficiency / 100);
    
    // Calculate load with growth
    const yearlyLoad = getYearlyLoad(baseAnnualLoad, year, loadGrowth);
    
    // Scale grid import/export proportionally
    const loadGrowthFactor = yearlyLoad / baseAnnualLoad;
    const generationFactor = panelEfficiency / 100;
    
    let yearlyGridImport = baseAnnualGridImport * loadGrowthFactor / generationFactor;
    let yearlyGridExport = baseAnnualGridExport * generationFactor;
    
    // Apply grid constraints (simplified - just reduce export)
    if (gridConstraints.enabled && gridConstraints.exportLimitEnabled) {
      const maxAnnualExport = gridConstraints.maxExportKw * 365 * 5;
      if (yearlyGridExport > maxAnnualExport) {
        yearlyGridExport = maxAnnualExport;
      }
    }
    
    // ===== INCOME CALCULATIONS (Excel model approach) =====
    
    // Escalation indices (compound growth from Year 1)
    const energyRateIndex = Math.pow(1 + tariffEscalation / 100, year - 1);
    const demandRateIndex = energyRateIndex; // Same escalation for demand
    const costIndex = Math.pow(1 + inflationRate / 100, year - 1);
    const insuranceIndex = Math.pow(1 + insuranceEscalation / 100, year - 1);
    
    // Actual rates per unit (for display in table)
    const energyRateR = baseEnergyRate * energyRateIndex; // R/kWh
    const demandRateR = baseDemandRate * demandRateIndex; // R/kVA
    
    // Energy Income = Energy Yield × Base Rate × Escalation Index
    const energyIncomeR = energyYield * baseEnergyRate * energyRateIndex;
    
    // Demand Income = kVA Saving × Base Demand Rate × 12 months × Escalation Index
    const demandIncomeR = demandSavingKva * baseDemandRate * 12 * demandRateIndex;
    
    // Total Income
    const totalIncomeR = energyIncomeR + demandIncomeR;
    
    // ===== COST CALCULATIONS =====
    
    // Insurance Cost = Base Insurance × CPI Index
    const insuranceCostR = baseInsurance * insuranceIndex;
    
    // O&M Cost = Base Maintenance × CPI Index
    const maintenanceCost = baseMaintenance * costIndex;
    
    // Total Operating Costs
    const totalCostR = insuranceCostR + maintenanceCost;
    
    // Replacement costs - percentage-based calculation
    let replacementCost = 0;
    const replacementYear = systemCosts.replacementYear ?? degradation.inverterReplacementYear ?? 10;
    
    if (degradation.enabled && year === replacementYear) {
      // Calculate based on percentages (matching Excel model)
      const solarInstalled = systemCosts.solarCostPerKwp * solarCapacity;
      const batteryInstalled = systemCosts.batteryCostPerKwh * batteryCapacity;
      
      const equipmentCostPercent = systemCosts.equipmentCostPercent ?? 45;
      const moduleSharePercent = systemCosts.moduleSharePercent ?? 70;
      const inverterSharePercent = systemCosts.inverterSharePercent ?? 30;
      
      const equipmentCost = solarInstalled * (equipmentCostPercent / 100);
      const moduleCost = equipmentCost * (moduleSharePercent / 100);
      const inverterCost = equipmentCost * (inverterSharePercent / 100);
      
      const moduleReplacementPercent = systemCosts.solarModuleReplacementPercent ?? 10;
      const inverterReplacementPercent = systemCosts.inverterReplacementPercent ?? 50;
      const batteryReplacementPercent = systemCosts.batteryReplacementPercent ?? 30;
      
      const moduleReplacement = moduleCost * (moduleReplacementPercent / 100);
      const inverterReplacement = inverterCost * (inverterReplacementPercent / 100);
      const batteryReplacement = batteryInstalled * (batteryReplacementPercent / 100);
      
      // Escalate by CPI to replacement year
      const cpiEscalation = Math.pow(1 + inflationRate / 100, year - 1);
      replacementCost = (moduleReplacement + inverterReplacement + batteryReplacement) * cpiEscalation;
    }
    
    // ===== NET CASHFLOW (Income-based) =====
    const netCashFlow = totalIncomeR - totalCostR - replacementCost;
    cumulativeCashFlow += netCashFlow;
    
    // Discounted cash flow
    const discountedCashFlow = financial.enabled
      ? netCashFlow / Math.pow(1 + financial.discountRate / 100, year)
      : netCashFlow;
    
    // Discounted energy yield for LCOE denominator (uses LCOE discount rate)
    const lcoeRate = systemCosts.lcoeDiscountRate ?? (financial.enabled ? financial.discountRate : 10);
    const discountedEnergyYield = energyYield / Math.pow(1 + lcoeRate / 100, year);
    
    // PV Reduction Factor using discount rate: 1 / (1 + r)^year
    const pvDiscountRate = financial.enabled ? financial.discountRate : 10;
    const pvReductionFactor = 1 / Math.pow(1 + pvDiscountRate / 100, year);
    const presentValue = netCashFlow * pvReductionFactor;
    
    // Legacy fields (for backwards compatibility)
    const escalatedTariff = baseEnergyRate * energyRateIndex;
    const energySavings = totalIncomeR; // Map to legacy field
    
    yearlyProjections.push({
      year,
      solarGeneration: energyYield,
      loadConsumption: yearlyLoad,
      gridImport: yearlyGridImport,
      gridExport: yearlyGridExport,
      panelEfficiency,
      batteryCapacityRemaining: batteryRemaining,
      tariffRate: escalatedTariff,
      energySavings, // Legacy: now equals totalIncome
      maintenanceCost,
      replacementCost,
      netCashFlow,
      cumulativeCashFlow,
      discountedCashFlow,
      // NEW: Income-based fields
      energyYield,
      discountedEnergyYield, // For LCOE denominator
      energyRateIndex,
      energyRateR,
      energyIncomeR,
      demandSavingKva,
      demandRateIndex,
      demandRateR,
      demandIncomeR,
      totalIncomeR,
      insuranceCostR,
      totalCostR,
      pvReductionFactor,
      presentValue,
    });
    
    cashFlows.push(netCashFlow);
    yearlyGenerations.push(energyYield);
    yearlyMaintenanceCosts.push(maintenanceCost + insuranceCostR);
    lifetimeSavings += totalIncomeR;
    lifetimeGeneration += energyYield;
  }
  
  // Calculate summary metrics using systemCosts financial parameters
  const discountRate = systemCosts.lcoeDiscountRate ?? (financial.enabled ? financial.discountRate : 10);
  const npv = calculateNPV(cashFlows, discountRate);
  const irr = calculateIRR(cashFlows);
  
  // Calculate true MIRR using finance and reinvestment rates from systemCosts
  const mirrFinanceRate = systemCosts.mirrFinanceRate ?? 9;
  const mirrReinvestmentRate = systemCosts.mirrReinvestmentRate ?? 10;
  const mirr = calculateMIRR(cashFlows, mirrFinanceRate, mirrReinvestmentRate);
  
  // Build yearly replacement costs array from projections
  const yearlyReplacementCosts = yearlyProjections.map(p => p.replacementCost);
  
  // NPV of Energy Yield - sum from projections (already discounted by LCOE rate)
  const npvEnergyYield = yearlyProjections.reduce(
    (sum, p) => sum + p.discountedEnergyYield, 
    0
  );
  
  // LCOE calculation: uses ACTUAL values directly from cashflow projections
  const lcoe = calculateLCOE(
    initialCost,
    npvEnergyYield,          // Pre-calculated NPV from discountedEnergyYield column
    yearlyMaintenanceCosts,  // Already contains CPI-escalated O&M + Insurance
    yearlyReplacementCosts
  );
  
  // Calculate sensitivity if enabled
  let sensitivityResults: SensitivityResults | undefined;
  
  if (financial.enabled && financial.sensitivityEnabled) {
    const variation = financial.sensitivityVariation / 100;
    
    // Best case: higher income, lower costs
    const bestCashFlows = [-initialCost];
    // Worst case: lower income, higher costs
    const worstCashFlows = [-initialCost];
    
    for (let year = 1; year <= lifetimeYears; year++) {
      const baseProjection = yearlyProjections[year - 1];
      
      // Best case adjustments (more income, less cost)
      const bestIncome = baseProjection.totalIncomeR * (1 + variation);
      const bestCost = baseProjection.totalCostR * (1 - variation * 0.5);
      bestCashFlows.push(bestIncome - bestCost - baseProjection.replacementCost);
      
      // Worst case adjustments (less income, more cost)
      const worstIncome = baseProjection.totalIncomeR * (1 - variation);
      const worstCost = baseProjection.totalCostR * (1 + variation);
      worstCashFlows.push(worstIncome - worstCost - baseProjection.replacementCost);
    }
    
    sensitivityResults = {
      expected: {
        npv,
        irr,
        payback: calculatePayback(yearlyProjections),
      },
      best: {
        npv: calculateNPV(bestCashFlows, financial.discountRate),
        irr: calculateIRR(bestCashFlows),
        payback: calculatePayback(yearlyProjections) * (1 - variation * 0.5),
        assumptions: `+${financial.sensitivityVariation}% income, -${financial.sensitivityVariation/2}% costs`,
      },
      worst: {
        npv: calculateNPV(worstCashFlows, financial.discountRate),
        irr: calculateIRR(worstCashFlows),
        payback: calculatePayback(yearlyProjections) * (1 + variation),
        assumptions: `-${financial.sensitivityVariation}% income, +${financial.sensitivityVariation}% costs`,
      },
    };
  }
  
  // Calculate column totals for transparency (matches cashflow table)
  const columnTotals: ColumnTotals = {
    totalEnergyYield: lifetimeGeneration,
    npvEnergyYield,
    totalIncome: lifetimeSavings,
    totalInsurance: yearlyProjections.reduce((s, p) => s + (p.insuranceCostR || 0), 0),
    totalOM: yearlyProjections.reduce((s, p) => s + p.maintenanceCost, 0),
    totalReplacements: yearlyProjections.reduce((s, p) => s + (p.replacementCost || 0), 0),
    totalCosts: yearlyProjections.reduce((s, p) => s + (p.totalCostR || 0), 0),
    totalNetCashflow: yearlyProjections.reduce((s, p) => s + p.netCashFlow, 0),
  };

  return {
    npv,
    irr,
    mirr,
    lcoe,
    yearlyProjections,
    lifetimeSavings,
    lifetimeGeneration,
    columnTotals,
    sensitivityResults,
  };
}

/**
 * Calculate payback period from yearly projections
 */
function calculatePayback(projections: YearlyProjection[]): number {
  const breakeven = projections.find(p => p.cumulativeCashFlow >= 0);
  if (!breakeven) return projections.length + 1;
  
  // Interpolate for more accurate payback
  const prevYear = projections[breakeven.year - 2];
  if (!prevYear) return breakeven.year;
  
  const remaining = Math.abs(prevYear.cumulativeCashFlow);
  const fraction = remaining / breakeven.netCashFlow;
  
  return breakeven.year - 1 + fraction;
}
