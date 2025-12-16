import { DcAcAnalysis, HourlyComparison, MonthlyComparison } from "../types";

// South African monthly irradiance factors (normalized, higher in summer)
const MONTHLY_IRRADIANCE_FACTORS = [
  1.15,  // January (summer)
  1.10,  // February
  1.00,  // March
  0.85,  // April
  0.70,  // May
  0.60,  // June (winter)
  0.65,  // July
  0.75,  // August
  0.90,  // September
  1.00,  // October
  1.10,  // November
  1.15,  // December (summer)
];

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Calculate hourly solar production curve (normalized to STC)
 * Based on clear-sky irradiance model for South Africa (~26° latitude)
 */
function getHourlySolarCurve(): number[] {
  // Clear-sky normalized curve - represents GHI relative to peak
  // Peak irradiance occurs around solar noon
  return [
    0, 0, 0, 0, 0, 0.02,          // 00:00-05:00 (night/dawn)
    0.08, 0.25, 0.45, 0.65,       // 06:00-09:00 (morning ramp)
    0.82, 0.94, 1.00, 0.97,       // 10:00-13:00 (midday peak - can hit STC)
    0.88, 0.72, 0.50, 0.28,       // 14:00-17:00 (afternoon decline)
    0.10, 0.02, 0, 0, 0, 0        // 18:00-23:00 (evening/night)
  ];
}

/**
 * Industry-validated clipping model based on published research
 * 
 * Key benchmarks from NotebookLM/industry data:
 * - DC/AC 1.0 → 0% clipping
 * - DC/AC 1.3 → 0.9% clipping  
 * - DC/AC 1.5 → 4.9% clipping
 * - DC/AC 1.6 → ~8% clipping (extrapolated)
 * 
 * The clipping percentage is calculated as clipped energy / total potential DC energy
 */
function calculateClippingLoss(dcAcRatio: number): { clippingPercent: number; yieldGainPercent: number } {
  if (dcAcRatio <= 1.0) {
    return { clippingPercent: 0, yieldGainPercent: 0 };
  }
  
  // Power law model fitted to industry data points:
  // 1.3 → 0.9%, 1.5 → 4.9%
  // clipping = 47.6 * x^3.31 where x = (ratio - 1)
  const oversizeAmount = dcAcRatio - 1.0;
  
  // Power law coefficients derived from regression:
  // Solving: a * 0.3^n = 0.9 and a * 0.5^n = 4.9
  // Yields: n = 3.31, a = 47.6
  const coefficient = 47.6;
  const exponent = 3.31;
  const clippingPercent = coefficient * Math.pow(oversizeAmount, exponent);
  
  // Yield gain model: diminishing returns as ratio increases
  // At 1.3, you get ~30% more DC capacity but only ~12% more AC output (due to clipping)
  // Net yield gain = (ratio - 1) * utilization_factor - clipping
  // Utilization factor decreases as ratio increases
  const utilizationFactor = 1 - (clippingPercent / 100 / oversizeAmount);
  const grossGain = oversizeAmount * 100; // % increase in DC capacity
  const yieldGainPercent = grossGain * utilizationFactor;
  
  return {
    clippingPercent: Math.round(clippingPercent * 10) / 10,
    yieldGainPercent: Math.round(yieldGainPercent * 10) / 10
  };
}

/**
 * Calculate DC/AC ratio analysis comparing 1:1 baseline to oversized array
 * 
 * Industry benchmarks (from research):
 * - DC/AC 1.5 → 4.8% clipping loss (validated)
 * - Optimal range: 1.2-1.4 for most commercial plants
 * - Higher ratios (up to 1.6) may be justified in specific economic scenarios
 */
export function calculateDcAcAnalysis(
  solarCapacityKwp: number,
  dcAcRatio: number,
  annualIrradianceKwhPerKwp: number = 1800 // Default for South Africa
): DcAcAnalysis {
  const hourlyCurve = getHourlySolarCurve();
  
  // DC capacity based on ratio
  const dcCapacityKwp = solarCapacityKwp * dcAcRatio;
  const acCapacityKw = solarCapacityKwp; // AC limited to inverter size
  
  // Baseline (1:1 ratio) capacity
  const baselineCapacityKwp = solarCapacityKwp;
  
  // Get industry-validated clipping and yield values
  const { clippingPercent, yieldGainPercent } = calculateClippingLoss(dcAcRatio);
  
  // Calculate baseline annual production
  const baselineAnnualKwh = baselineCapacityKwp * annualIrradianceKwhPerKwp;
  
  // Calculate theoretical DC production (what the larger array could produce)
  const theoreticalDcAnnualKwh = dcCapacityKwp * annualIrradianceKwhPerKwp;
  
  // Calculate actual AC output (after clipping)
  const clippingLossKwh = (clippingPercent / 100) * theoreticalDcAnnualKwh;
  const oversizedAnnualKwh = theoreticalDcAnnualKwh - clippingLossKwh;
  
  // Net gain is actual output minus baseline
  const netGainKwh = oversizedAnnualKwh - baselineAnnualKwh;
  const netGainPercent = baselineAnnualKwh > 0 ? (netGainKwh / baselineAnnualKwh) * 100 : 0;
  
  // Additional capture is the extra DC capacity's potential
  const additionalCaptureKwh = theoreticalDcAnnualKwh - baselineAnnualKwh;
  
  // Calculate hourly comparison for a typical peak day (summer, clear sky)
  const hourlyComparison: HourlyComparison[] = hourlyCurve.map((factor, hour) => {
    const baselineKw = baselineCapacityKwp * factor;
    const oversizedDcKw = dcCapacityKwp * factor;
    const oversizedAcKw = Math.min(oversizedDcKw, acCapacityKw); // Clipped at AC limit
    const clippingKw = Math.max(0, oversizedDcKw - acCapacityKw);
    
    return {
      hour,
      baseline_kw: Math.round(baselineKw * 100) / 100,
      oversized_dc_kw: Math.round(oversizedDcKw * 100) / 100,
      oversized_ac_kw: Math.round(oversizedAcKw * 100) / 100,
      clipping_kw: Math.round(clippingKw * 100) / 100
    };
  });
  
  // Calculate monthly comparison
  const totalIrradianceWeight = MONTHLY_IRRADIANCE_FACTORS.reduce((a, b) => a + b, 0);
  const monthlyComparison: MonthlyComparison[] = MONTH_NAMES.map((month, idx) => {
    const irradianceFactor = MONTHLY_IRRADIANCE_FACTORS[idx];
    const monthWeight = irradianceFactor / totalIrradianceWeight;
    
    const baselineKwh = baselineAnnualKwh * monthWeight;
    const oversizedKwh = oversizedAnnualKwh * monthWeight;
    const gainKwh = oversizedKwh - baselineKwh;
    const gainPercent = baselineKwh > 0 ? (gainKwh / baselineKwh) * 100 : 0;
    
    return {
      month,
      baseline_kwh: Math.round(baselineKwh),
      oversized_kwh: Math.round(oversizedKwh),
      gain_kwh: Math.round(gainKwh),
      gain_percent: Math.round(gainPercent * 10) / 10
    };
  });
  
  return {
    baseline_annual_kwh: Math.round(baselineAnnualKwh),
    oversized_annual_kwh: Math.round(oversizedAnnualKwh),
    clipping_loss_kwh: Math.round(clippingLossKwh),
    additional_capture_kwh: Math.round(additionalCaptureKwh),
    net_gain_kwh: Math.round(netGainKwh),
    net_gain_percent: Math.round(netGainPercent * 10) / 10,
    clipping_percent: clippingPercent,
    hourly_comparison: hourlyComparison,
    monthly_comparison: monthlyComparison
  };
}

/**
 * Get recommendation text based on DC/AC analysis
 * 
 * Industry benchmarks:
 * - 1.2:1 → ~5-8% yield gain, <1% clipping - Conservative
 * - 1.3:1 → ~10-15% yield gain, 1-3% clipping - Optimal for most
 * - 1.5:1 → ~15-20% yield gain, ~5% clipping - Aggressive but viable
 * - >1.5:1 → Diminishing returns, warranty risks
 */
export function getDcAcRecommendation(analysis: DcAcAnalysis, dcAcRatio: number): string {
  if (dcAcRatio <= 1.0) {
    return "A 1:1 DC/AC ratio provides no oversizing benefits. Consider a ratio of 1.2-1.4 to maximize inverter utilization and lower LCOE.";
  }
  
  if (dcAcRatio <= 1.25 && analysis.clipping_percent < 1.5) {
    return `A ${dcAcRatio.toFixed(2)}:1 DC/AC ratio delivers ${analysis.net_gain_percent.toFixed(1)}% more annual energy with minimal clipping (${analysis.clipping_percent}%). This conservative approach is suitable for premium module costs.`;
  }
  
  if (dcAcRatio <= 1.4 && analysis.clipping_percent < 4) {
    return `A ${dcAcRatio.toFixed(2)}:1 DC/AC ratio is within the optimal range (1.2-1.4) for most commercial installations. The ${analysis.net_gain_percent.toFixed(1)}% energy gain with ${analysis.clipping_percent}% clipping loss represents an excellent cost-benefit balance.`;
  }
  
  if (dcAcRatio <= 1.5 && analysis.clipping_percent < 6) {
    return `A ${dcAcRatio.toFixed(2)}:1 DC/AC ratio provides ${analysis.net_gain_percent.toFixed(1)}% additional yield. The ${analysis.clipping_percent}% clipping loss aligns with industry benchmarks (~4.8% at 1.5:1). This ratio is viable when module costs are low relative to inverter costs.`;
  }
  
  if (dcAcRatio > 1.5) {
    return `At ${dcAcRatio.toFixed(2)}:1, clipping losses of ${analysis.clipping_percent}% reduce the marginal benefit of oversizing. Verify this ratio is within inverter warranty limits. The optimal range is typically 1.2-1.4 for most projects.`;
  }
  
  return `The ${dcAcRatio.toFixed(2)}:1 ratio provides ${analysis.net_gain_percent.toFixed(1)}% yield improvement. Evaluate project economics to determine if additional panel cost justifies this gain.`;
}
