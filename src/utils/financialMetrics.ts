/**
 * Financial Metrics Calculator
 *
 * Pure utility for NPV, IRR (Newton-Raphson), MIRR, and LCOE.
 * Extracted from useSimulationEngine to keep the hook lean
 * and allow unit testing without React.
 */

export interface FinancialMetricsInput {
  systemCost: number;
  annualSavings: number;
  annualGeneration: number;
  projectLifeYears: number;
  discountRate: number;      // decimal (e.g. 0.09)
  financeRate: number;       // decimal
  reinvestmentRate: number;  // decimal
  annualDegradationRate?: number; // decimal (e.g. 0.005 = 0.5%/yr) - used for LCOE
  maintenancePerYear?: number;    // R/year - included in LCOE numerator
}

export interface FinancialMetricsResult {
  npv: number;
  irr: number;   // percentage (e.g. 12.5)
  mirr: number;  // percentage
  lcoe: number;
  projectLifeYears: number;
  discountRate: number; // percentage
}

export function calculateFinancialMetrics(input: FinancialMetricsInput): FinancialMetricsResult {
  const { systemCost, annualSavings, annualGeneration, projectLifeYears, discountRate, financeRate, reinvestmentRate } = input;

  // ── NPV ──
  let npv = -systemCost;
  for (let y = 1; y <= projectLifeYears; y++) {
    npv += annualSavings / Math.pow(1 + discountRate, y);
  }

  // ── IRR (Newton-Raphson, max 50 iterations) ──
  let irr = 0.1;
  for (let iter = 0; iter < 50; iter++) {
    let npvAtRate = -systemCost;
    let derivativeNpv = 0;
    for (let y = 1; y <= projectLifeYears; y++) {
      const df = Math.pow(1 + irr, y);
      npvAtRate += annualSavings / df;
      derivativeNpv -= y * annualSavings / Math.pow(1 + irr, y + 1);
    }
    if (Math.abs(derivativeNpv) < 1e-10) break;
    const newIrr = irr - npvAtRate / derivativeNpv;
    if (Math.abs(newIrr - irr) < 1e-6) break;
    irr = newIrr;
  }

  // ── MIRR (proper separation of finance & reinvestment rates) ──
  // PV of negative cash flows at finance rate (borrowing cost)
  const pvNegative = -systemCost; // Year 0 outflow discounted at t=0 = systemCost
  // FV of positive cash flows at reinvestment rate
  let fvPositive = 0;
  for (let y = 1; y <= projectLifeYears; y++) {
    fvPositive += annualSavings * Math.pow(1 + reinvestmentRate, projectLifeYears - y);
  }
  const mirr = (pvNegative !== 0 && fvPositive > 0)
    ? Math.pow(fvPositive / Math.abs(pvNegative), 1 / projectLifeYears) - 1
    : 0;

  // ── LCOE (with actual year-by-year degradation) ──
  const degradationRate = input.annualDegradationRate ?? 0.005; // default 0.5%/yr
  const maintenance = input.maintenancePerYear ?? 0;
  let totalDiscountedGeneration = 0;
  let totalDiscountedCosts = systemCost; // initial capital
  for (let y = 1; y <= projectLifeYears; y++) {
    const yearEfficiency = Math.max(0, 1 - degradationRate * (y - 1));
    const yearGeneration = annualGeneration * yearEfficiency;
    const df = Math.pow(1 + discountRate, y);
    totalDiscountedGeneration += yearGeneration / df;
    totalDiscountedCosts += maintenance / df;
  }
  const lcoe = totalDiscountedGeneration > 0 ? totalDiscountedCosts / totalDiscountedGeneration : 0;

  return {
    npv,
    irr: irr * 100,
    mirr: mirr * 100,
    lcoe,
    projectLifeYears,
    discountRate: discountRate * 100,
  };
}
