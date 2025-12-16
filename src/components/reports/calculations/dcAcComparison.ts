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
 * Peak at solar noon, zero before sunrise and after sunset
 */
function getHourlySolarCurve(): number[] {
  // Approximate solar curve for South Africa (sunrise ~6am, sunset ~6pm)
  return [
    0, 0, 0, 0, 0, 0,           // 00:00-05:00 (night)
    0.05, 0.15, 0.35, 0.60,     // 06:00-09:00 (morning ramp)
    0.85, 0.95, 1.00, 0.98,     // 10:00-13:00 (midday peak)
    0.90, 0.75, 0.50, 0.25,     // 14:00-17:00 (afternoon decline)
    0.08, 0, 0, 0, 0, 0         // 18:00-23:00 (evening/night)
  ];
}

/**
 * Calculate DC/AC ratio analysis comparing 1:1 baseline to oversized array
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
  
  // Calculate hourly comparison for a typical day
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
  
  // Calculate daily totals
  const dailyBaselineKwh = hourlyComparison.reduce((sum, h) => sum + h.baseline_kw, 0);
  const dailyOversizedAcKwh = hourlyComparison.reduce((sum, h) => sum + h.oversized_ac_kw, 0);
  const dailyClippingKwh = hourlyComparison.reduce((sum, h) => sum + h.clipping_kw, 0);
  
  // Calculate monthly comparison
  const monthlyComparison: MonthlyComparison[] = MONTH_NAMES.map((month, idx) => {
    const irradianceFactor = MONTHLY_IRRADIANCE_FACTORS[idx];
    const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][idx];
    
    const baselineKwh = dailyBaselineKwh * irradianceFactor * daysInMonth;
    const oversizedKwh = dailyOversizedAcKwh * irradianceFactor * daysInMonth;
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
  
  // Calculate annual totals
  const baselineAnnualKwh = monthlyComparison.reduce((sum, m) => sum + m.baseline_kwh, 0);
  const oversizedAnnualKwh = monthlyComparison.reduce((sum, m) => sum + m.oversized_kwh, 0);
  const theoreticalDcAnnualKwh = baselineAnnualKwh * dcAcRatio;
  const clippingLossKwh = theoreticalDcAnnualKwh - oversizedAnnualKwh;
  const additionalCaptureKwh = theoreticalDcAnnualKwh - baselineAnnualKwh;
  const netGainKwh = oversizedAnnualKwh - baselineAnnualKwh;
  const netGainPercent = baselineAnnualKwh > 0 ? (netGainKwh / baselineAnnualKwh) * 100 : 0;
  const clippingPercent = theoreticalDcAnnualKwh > 0 ? (clippingLossKwh / theoreticalDcAnnualKwh) * 100 : 0;
  
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
  if (analysis.net_gain_percent > 8) {
    return `A ${dcAcRatio}:1 DC/AC ratio delivers ${analysis.net_gain_percent}% more energy annually with only ${analysis.clipping_percent}% clipping losses. This oversizing strategy is highly recommended for maximizing system output.`;
  } else if (analysis.net_gain_percent > 4) {
    return `A ${dcAcRatio}:1 DC/AC ratio provides a ${analysis.net_gain_percent}% net energy gain. The moderate clipping losses of ${analysis.clipping_percent}% are offset by increased morning and afternoon capture.`;
  } else if (analysis.net_gain_percent > 0) {
    return `The ${dcAcRatio}:1 ratio shows a modest ${analysis.net_gain_percent}% improvement. Consider evaluating if the additional panel cost justifies this marginal gain.`;
  } else {
    return `At ${dcAcRatio}:1, clipping losses exceed additional capture. A lower DC/AC ratio may be more cost-effective for this configuration.`;
  }
}
