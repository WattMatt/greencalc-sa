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

  // ── MIRR ──
  let fvPositive = 0;
  for (let y = 1; y <= projectLifeYears; y++) {
    fvPositive += annualSavings * Math.pow(1 + reinvestmentRate, projectLifeYears - y);
  }
  const mirr = systemCost > 0 ? Math.pow(fvPositive / systemCost, 1 / projectLifeYears) - 1 : 0;

  // ── LCOE ──
  const lifetimeGeneration = annualGeneration * projectLifeYears * 0.9;
  const lcoe = lifetimeGeneration > 0 ? systemCost / lifetimeGeneration : 0;

  return {
    npv,
    irr: irr * 100,
    mirr: mirr * 100,
    lcoe,
    projectLifeYears,
    discountRate: discountRate * 100,
  };
}
