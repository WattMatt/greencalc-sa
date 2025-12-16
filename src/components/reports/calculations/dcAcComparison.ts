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
 * Calculate hourly solar production curve (normalized)
 * Based on HelioScope data: PV arrays rarely produce above 80% of rated capacity
 * Peak is normalized to typical real-world conditions, not STC
 */
function getHourlySolarCurve(): number[] {
  // Realistic solar curve for South Africa - peaks at ~80% of STC rating
  // This matches industry data showing panels rarely reach nameplate capacity
  return [
    0, 0, 0, 0, 0, 0,             // 00:00-05:00 (night)
    0.02, 0.10, 0.28, 0.48,       // 06:00-09:00 (morning ramp)
    0.65, 0.75, 0.80, 0.78,       // 10:00-13:00 (midday peak ~80% of STC)
    0.70, 0.55, 0.38, 0.18,       // 14:00-17:00 (afternoon decline)
    0.05, 0, 0, 0, 0, 0           // 18:00-23:00 (evening/night)
  ];
}

/**
 * Calculate annual operating hours at each power level
 * Based on HelioScope: ~4500 operating hours, with very few above 80%
 */
function getAnnualHoursDistribution(): { powerLevel: number; hours: number }[] {
  // Distribution of annual operating hours at different power levels
  // This is key for accurate clipping calculations
  return [
    { powerLevel: 0.95, hours: 10 },    // Very rare - only 10 hours/year above 95%
    { powerLevel: 0.90, hours: 50 },    // Rare - 50 hours above 90%
    { powerLevel: 0.85, hours: 150 },   // Uncommon - 150 hours above 85%
    { powerLevel: 0.80, hours: 350 },   // ~350 hours above 80%
    { powerLevel: 0.70, hours: 600 },   // ~600 hours above 70%
    { powerLevel: 0.60, hours: 700 },   // ~700 hours above 60%
    { powerLevel: 0.50, hours: 750 },   // ~750 hours above 50%
    { powerLevel: 0.40, hours: 700 },   // ~700 hours at 40-50%
    { powerLevel: 0.30, hours: 550 },   // ~550 hours at 30-40%
    { powerLevel: 0.20, hours: 400 },   // ~400 hours at 20-30%
    { powerLevel: 0.10, hours: 240 },   // ~240 hours at 10-20%
  ];
}

/**
 * Calculate DC/AC ratio analysis comparing 1:1 baseline to oversized array
 * Based on industry data: 1.3:1 ratio yields ~12% more energy with 1-3% clipping
 */
export function calculateDcAcAnalysis(
  solarCapacityKwp: number,
  dcAcRatio: number,
  annualIrradianceKwhPerKwp: number = 1800 // Default for South Africa
): DcAcAnalysis {
  const hourlyCurve = getHourlySolarCurve();
  const hoursDistribution = getAnnualHoursDistribution();
  
  // DC capacity based on ratio
  const dcCapacityKwp = solarCapacityKwp * dcAcRatio;
  const acCapacityKw = solarCapacityKwp; // AC limited to inverter size
  
  // Baseline (1:1 ratio) capacity
  const baselineCapacityKwp = solarCapacityKwp;
  
  // Calculate hourly comparison for a typical peak day
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
  
  // Calculate annual energy using hours distribution method (more accurate)
  let baselineAnnualKwh = 0;
  let oversizedAnnualKwh = 0;
  let clippingLossKwh = 0;
  
  hoursDistribution.forEach(({ powerLevel, hours }) => {
    // Baseline energy at this power level
    const baselinePowerKw = baselineCapacityKwp * powerLevel;
    baselineAnnualKwh += baselinePowerKw * hours;
    
    // Oversized DC output at this power level
    const oversizedDcKw = dcCapacityKwp * powerLevel;
    
    // AC output is capped at inverter capacity
    const oversizedAcKw = Math.min(oversizedDcKw, acCapacityKw);
    oversizedAnnualKwh += oversizedAcKw * hours;
    
    // Clipping occurs when DC > AC capacity
    if (oversizedDcKw > acCapacityKw) {
      clippingLossKwh += (oversizedDcKw - acCapacityKw) * hours;
    }
  });
  
  // Scale to match expected specific yield (kWh/kWp)
  const scaleFactor = annualIrradianceKwhPerKwp / (baselineAnnualKwh / baselineCapacityKwp);
  baselineAnnualKwh *= scaleFactor;
  oversizedAnnualKwh *= scaleFactor;
  clippingLossKwh *= scaleFactor;
  
  // Calculate net gain
  const netGainKwh = oversizedAnnualKwh - baselineAnnualKwh;
  const netGainPercent = baselineAnnualKwh > 0 ? (netGainKwh / baselineAnnualKwh) * 100 : 0;
  
  // Calculate theoretical DC output (without clipping)
  const theoreticalDcAnnualKwh = baselineAnnualKwh * dcAcRatio;
  const additionalCaptureKwh = theoreticalDcAnnualKwh - baselineAnnualKwh;
  const clippingPercent = theoreticalDcAnnualKwh > 0 ? (clippingLossKwh / theoreticalDcAnnualKwh) * 100 : 0;
  
  // Calculate monthly comparison (distribute annual across months)
  const monthlyComparison: MonthlyComparison[] = MONTH_NAMES.map((month, idx) => {
    const irradianceFactor = MONTHLY_IRRADIANCE_FACTORS[idx];
    const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][idx];
    const monthFraction = (irradianceFactor * daysInMonth) / 365;
    
    // Annual totals distributed by month
    const baselineKwh = baselineAnnualKwh * monthFraction * (12 / MONTHLY_IRRADIANCE_FACTORS.reduce((a, b) => a + b, 0));
    const oversizedKwh = oversizedAnnualKwh * monthFraction * (12 / MONTHLY_IRRADIANCE_FACTORS.reduce((a, b) => a + b, 0));
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
    clipping_percent: Math.round(clippingPercent * 10) / 10,
    hourly_comparison: hourlyComparison,
    monthly_comparison: monthlyComparison
  };
}

/**
 * Get recommendation text based on DC/AC analysis
 */
export function getDcAcRecommendation(analysis: DcAcAnalysis, dcAcRatio: number): string {
  // Industry benchmarks:
  // 1.2:1 → ~5-8% gain, <1% clipping
  // 1.3:1 → ~10-15% gain, 1-3% clipping  
  // 1.5:1 → ~15-20% gain, 3-6% clipping
  
  if (analysis.clipping_percent < 2 && analysis.net_gain_percent > 8) {
    return `A ${dcAcRatio.toFixed(2)}:1 DC/AC ratio delivers ${analysis.net_gain_percent}% more energy annually with only ${analysis.clipping_percent}% clipping losses. This is an optimal oversizing strategy that aligns with industry best practices.`;
  } else if (analysis.clipping_percent < 5 && analysis.net_gain_percent > 5) {
    return `A ${dcAcRatio.toFixed(2)}:1 DC/AC ratio provides ${analysis.net_gain_percent}% additional energy capture. The ${analysis.clipping_percent}% clipping losses are within acceptable industry norms for this ratio.`;
  } else if (analysis.clipping_percent > 5) {
    return `At ${dcAcRatio.toFixed(2)}:1, clipping losses of ${analysis.clipping_percent}% are higher than industry recommendations. Consider reducing the DC/AC ratio to optimize cost-effectiveness.`;
  } else {
    return `The ${dcAcRatio.toFixed(2)}:1 ratio shows a ${analysis.net_gain_percent}% improvement with minimal clipping. Evaluate if additional panel cost justifies this gain for your specific project economics.`;
  }
}
