import { DcAcAnalysis, HourlyComparison, MonthlyComparison } from "../types";

// ============= REGIONAL IRRADIANCE PRESETS =============

export type RegionalPreset = 'high-sun' | 'moderate' | 'cloudy';

export interface RegionalConfig {
  name: string;
  description: string;
  annualIrradianceKwhPerKwp: number;
  recommendedDcAcMin: number;
  recommendedDcAcMax: number;
  monthlyFactors: number[];
}

/**
 * Regional irradiance presets based on industry research
 * 
 * High-sun regions (SA, Middle East, deserts): 1800-2200 kWh/kWp, conservative ratios
 * Moderate regions (Mediterranean, temperate): 1400-1800 kWh/kWp, moderate ratios
 * Cloudy regions (Northern Europe, UK): 900-1400 kWh/kWp, higher ratios beneficial
 */
export const REGIONAL_PRESETS: Record<RegionalPreset, RegionalConfig> = {
  'high-sun': {
    name: 'High Irradiance (South Africa, Middle East)',
    description: 'High solar resource areas benefit from conservative DC/AC ratios (1.1-1.35) to minimize clipping losses and reduce inverter thermal stress.',
    annualIrradianceKwhPerKwp: 1864, // SA benchmark from research
    recommendedDcAcMin: 1.10,
    recommendedDcAcMax: 1.35,
    monthlyFactors: [
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
    ]
  },
  'moderate': {
    name: 'Moderate Irradiance (Mediterranean, US Average)',
    description: 'Temperate regions can support moderate oversizing (1.2-1.4) with good cost-benefit balance.',
    annualIrradianceKwhPerKwp: 1600,
    recommendedDcAcMin: 1.20,
    recommendedDcAcMax: 1.40,
    monthlyFactors: [
      0.70,  // January
      0.80,  // February
      0.95,  // March
      1.05,  // April
      1.15,  // May
      1.20,  // June (summer peak)
      1.20,  // July
      1.10,  // August
      1.00,  // September
      0.85,  // October
      0.70,  // November
      0.65,  // December
    ]
  },
  'cloudy': {
    name: 'Low Irradiance (Northern Europe, UK)',
    description: 'Low irradiance regions benefit from higher ratios (1.3-1.5) to maximize energy capture during fluctuating light conditions.',
    annualIrradianceKwhPerKwp: 1100,
    recommendedDcAcMin: 1.30,
    recommendedDcAcMax: 1.50,
    monthlyFactors: [
      0.40,  // January
      0.55,  // February
      0.80,  // March
      1.00,  // April
      1.20,  // May
      1.30,  // June (summer peak)
      1.25,  // July
      1.10,  // August
      0.90,  // September
      0.65,  // October
      0.45,  // November
      0.35,  // December
    ]
  }
};

// ============= BESS CONFIGURATION =============

export interface BESSConfig {
  enabled: boolean;
  capacityKwh: number;
  powerKw: number;
  roundTripEfficiency: number; // 0-1, typically 0.85-0.92
}

export interface BESSAdjustedAnalysis extends DcAcAnalysis {
  bess_enabled: boolean;
  clipped_energy_stored_kwh: number;
  clipped_energy_lost_kwh: number;
  storage_utilization_percent: number;
  effective_clipping_percent: number;
  bess_recommendation: string;
}

// ============= CONSTANTS =============

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Calculate hourly solar production curve (normalized to STC)
 * Based on clear-sky irradiance model for South Africa (~26° latitude)
 */
function getHourlySolarCurve(): number[] {
  return [
    0, 0, 0, 0, 0, 0.02,          // 00:00-05:00 (night/dawn)
    0.08, 0.25, 0.45, 0.65,       // 06:00-09:00 (morning ramp)
    0.82, 0.94, 1.00, 0.97,       // 10:00-13:00 (midday peak)
    0.88, 0.72, 0.50, 0.28,       // 14:00-17:00 (afternoon decline)
    0.10, 0.02, 0, 0, 0, 0        // 18:00-23:00 (evening/night)
  ];
}

/**
 * Industry-validated clipping model based on published research
 * 
 * Key benchmarks from research:
 * - DC/AC 1.0 → 0% clipping
 * - DC/AC 1.2 → <0.25% clipping
 * - DC/AC 1.3 → 0.9% clipping  
 * - DC/AC 1.4 → ~3% clipping
 * - DC/AC 1.5 → 4.9% clipping (2-5% range)
 * - DC/AC 2.0 → can reach nearly 20%
 */
function calculateClippingLoss(dcAcRatio: number): { clippingPercent: number; yieldGainPercent: number } {
  if (dcAcRatio <= 1.0) {
    return { clippingPercent: 0, yieldGainPercent: 0 };
  }
  
  // Power law model fitted to industry data points:
  // 1.3 → 0.9%, 1.5 → 4.9%
  // clipping = 47.6 * x^3.31 where x = (ratio - 1)
  const oversizeAmount = dcAcRatio - 1.0;
  
  const coefficient = 47.6;
  const exponent = 3.31;
  const clippingPercent = coefficient * Math.pow(oversizeAmount, exponent);
  
  // Yield gain model: diminishing returns as ratio increases
  // Research shows 1.3 ratio can increase annual production by 5-15%
  // Real case: 1.3 ratio achieved 12% yield increase with only 2% clipping
  const utilizationFactor = 1 - (clippingPercent / 100 / oversizeAmount);
  const grossGain = oversizeAmount * 100;
  const yieldGainPercent = grossGain * utilizationFactor;
  
  return {
    clippingPercent: Math.round(clippingPercent * 10) / 10,
    yieldGainPercent: Math.round(yieldGainPercent * 10) / 10
  };
}

/**
 * Calculate how much clipped energy can be stored in BESS
 * 
 * With BESS, priorities shift:
 * 1. Charge the battery
 * 2. Power active loads
 * 3. Export to grid
 * 
 * This justifies DC/AC ratios up to 2.0 (200%) because "clipped" energy
 * can be stored rather than lost.
 */
function calculateBESSStoredEnergy(
  hourlyClippingKw: number[],
  bessConfig: BESSConfig
): { storedKwh: number; lostKwh: number } {
  if (!bessConfig.enabled || bessConfig.capacityKwh <= 0) {
    const totalClipped = hourlyClippingKw.reduce((sum, kw) => sum + kw, 0);
    return { storedKwh: 0, lostKwh: totalClipped };
  }
  
  let batteryStateKwh = 0;
  let totalStored = 0;
  let totalLost = 0;
  
  const maxChargeRate = bessConfig.powerKw;
  const maxCapacity = bessConfig.capacityKwh;
  const efficiency = bessConfig.roundTripEfficiency;
  
  for (const clippedKw of hourlyClippingKw) {
    // Energy available to store (per hour, so kW = kWh)
    const availableToStore = clippedKw;
    
    // Limited by charge rate
    const chargeRateLimited = Math.min(availableToStore, maxChargeRate);
    
    // Limited by remaining capacity
    const remainingCapacity = maxCapacity - batteryStateKwh;
    const actualStored = Math.min(chargeRateLimited, remainingCapacity);
    
    // Apply efficiency loss on charging
    const effectiveStored = actualStored * Math.sqrt(efficiency); // Half of RT losses on charge
    
    batteryStateKwh += effectiveStored;
    totalStored += actualStored;
    totalLost += (availableToStore - actualStored);
  }
  
  return {
    storedKwh: Math.round(totalStored * 10) / 10,
    lostKwh: Math.round(totalLost * 10) / 10
  };
}

/**
 * Calculate DC/AC ratio analysis with optional regional preset and BESS
 */
export function calculateDcAcAnalysis(
  solarCapacityKwp: number,
  dcAcRatio: number,
  annualIrradianceKwhPerKwp: number = 1864, // SA benchmark
  regionalPreset?: RegionalPreset,
  bessConfig?: BESSConfig
): BESSAdjustedAnalysis {
  // Use regional preset if provided
  const config = regionalPreset ? REGIONAL_PRESETS[regionalPreset] : null;
  const irradiance = config?.annualIrradianceKwhPerKwp ?? annualIrradianceKwhPerKwp;
  const monthlyFactors = config?.monthlyFactors ?? REGIONAL_PRESETS['high-sun'].monthlyFactors;
  
  const hourlyCurve = getHourlySolarCurve();
  
  // DC capacity based on ratio
  const dcCapacityKwp = solarCapacityKwp * dcAcRatio;
  const acCapacityKw = solarCapacityKwp;
  
  // Baseline (1:1 ratio) capacity
  const baselineCapacityKwp = solarCapacityKwp;
  
  // Get industry-validated clipping and yield values
  const { clippingPercent, yieldGainPercent } = calculateClippingLoss(dcAcRatio);
  
  // Calculate baseline annual production
  const baselineAnnualKwh = baselineCapacityKwp * irradiance;
  
  // Calculate theoretical DC production
  const theoreticalDcAnnualKwh = dcCapacityKwp * irradiance;
  
  // Calculate clipping loss
  const clippingLossKwh = (clippingPercent / 100) * theoreticalDcAnnualKwh;
  
  // Calculate hourly comparison for a typical peak day
  const hourlyComparison: HourlyComparison[] = hourlyCurve.map((factor, hour) => {
    const baselineKw = baselineCapacityKwp * factor;
    const oversizedDcKw = dcCapacityKwp * factor;
    const oversizedAcKw = Math.min(oversizedDcKw, acCapacityKw);
    const clippingKw = Math.max(0, oversizedDcKw - acCapacityKw);
    
    return {
      hour,
      baseline_kw: Math.round(baselineKw * 100) / 100,
      oversized_dc_kw: Math.round(oversizedDcKw * 100) / 100,
      oversized_ac_kw: Math.round(oversizedAcKw * 100) / 100,
      clipping_kw: Math.round(clippingKw * 100) / 100
    };
  });
  
  // Calculate BESS storage of clipped energy
  const hourlyClippingKw = hourlyComparison.map(h => h.clipping_kw);
  const dailyClippingKwh = hourlyClippingKw.reduce((sum, kw) => sum + kw, 0);
  
  // Scale daily clipping to annual (rough estimate: ~300 sun days equivalent)
  const annualClippingEvents = 300;
  const scaledHourlyClipping = hourlyClippingKw.map(kw => kw * annualClippingEvents);
  
  const bessResult = bessConfig 
    ? calculateBESSStoredEnergy(scaledHourlyClipping, bessConfig)
    : { storedKwh: 0, lostKwh: clippingLossKwh };
  
  // With BESS, effective clipping is reduced
  const effectiveClippingLossKwh = bessConfig?.enabled 
    ? bessResult.lostKwh 
    : clippingLossKwh;
  
  const effectiveClippingPercent = theoreticalDcAnnualKwh > 0 
    ? (effectiveClippingLossKwh / theoreticalDcAnnualKwh) * 100 
    : 0;
  
  // Oversized output now includes recovered energy from BESS
  const oversizedAnnualKwh = theoreticalDcAnnualKwh - effectiveClippingLossKwh;
  
  // Net gain
  const netGainKwh = oversizedAnnualKwh - baselineAnnualKwh;
  const netGainPercent = baselineAnnualKwh > 0 ? (netGainKwh / baselineAnnualKwh) * 100 : 0;
  
  const additionalCaptureKwh = theoreticalDcAnnualKwh - baselineAnnualKwh;
  
  // Calculate monthly comparison
  const totalIrradianceWeight = monthlyFactors.reduce((a, b) => a + b, 0);
  const monthlyComparison: MonthlyComparison[] = MONTH_NAMES.map((month, idx) => {
    const irradianceFactor = monthlyFactors[idx];
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
  
  // BESS recommendation
  const storageUtilization = clippingLossKwh > 0 
    ? (bessResult.storedKwh / clippingLossKwh) * 100 
    : 0;
  
  const bessRecommendation = getBESSRecommendation(
    dcAcRatio, 
    bessConfig, 
    storageUtilization, 
    bessResult.storedKwh
  );
  
  return {
    baseline_annual_kwh: Math.round(baselineAnnualKwh),
    oversized_annual_kwh: Math.round(oversizedAnnualKwh),
    clipping_loss_kwh: Math.round(clippingLossKwh),
    additional_capture_kwh: Math.round(additionalCaptureKwh),
    net_gain_kwh: Math.round(netGainKwh),
    net_gain_percent: Math.round(netGainPercent * 10) / 10,
    clipping_percent: clippingPercent,
    hourly_comparison: hourlyComparison,
    monthly_comparison: monthlyComparison,
    // BESS-specific fields
    bess_enabled: bessConfig?.enabled ?? false,
    clipped_energy_stored_kwh: Math.round(bessResult.storedKwh),
    clipped_energy_lost_kwh: Math.round(bessResult.lostKwh),
    storage_utilization_percent: Math.round(storageUtilization * 10) / 10,
    effective_clipping_percent: Math.round(effectiveClippingPercent * 10) / 10,
    bess_recommendation: bessRecommendation
  };
}

/**
 * Generate BESS-specific recommendation
 */
function getBESSRecommendation(
  dcAcRatio: number,
  bessConfig?: BESSConfig,
  storageUtilization?: number,
  storedKwh?: number
): string {
  if (!bessConfig?.enabled) {
    if (dcAcRatio > 1.5) {
      return `Without battery storage, ${dcAcRatio.toFixed(2)}:1 DC/AC ratio results in significant clipping losses. Consider adding BESS to capture excess energy - ratios up to 2.0 become viable with storage.`;
    }
    return "No battery storage configured. Adding BESS can recover clipped energy and justify higher DC/AC ratios (up to 200%).";
  }
  
  if ((storageUtilization ?? 0) > 90) {
    return `Battery storage is capturing ${storedKwh?.toLocaleString()} kWh of clipped energy annually (${storageUtilization?.toFixed(0)}% utilization). Consider increasing battery capacity to capture remaining clipped energy.`;
  }
  
  if ((storageUtilization ?? 0) > 50) {
    return `Battery storage is effectively recovering ${storedKwh?.toLocaleString()} kWh annually. The ${dcAcRatio.toFixed(2)}:1 ratio is well-suited for this BESS configuration.`;
  }
  
  return `Battery storage utilization is ${storageUtilization?.toFixed(0)}%. Consider a higher DC/AC ratio to better utilize available storage capacity.`;
}

/**
 * Get recommendation text based on DC/AC analysis
 * Updated with SA-specific benchmarks from research:
 * 
 * SA Case Study (75 kWp system):
 * - Annual yield: 1,864.29 kWh/kWp
 * - Performance Ratio: 80%
 * - Capacity Utilization Factor: 21.29%
 * - Simple Payback: 7.34 years
 * 
 * Industry benchmarks:
 * - DC/AC 1.2 → <0.25% clipping, 5-8% yield gain
 * - DC/AC 1.3 → 0.9% clipping, 12% yield increase (real case)
 * - DC/AC 1.4 → ~3% clipping
 * - DC/AC 1.5 → 2-5% clipping
 * - DC/AC 2.0 → up to 20% clipping (only viable with BESS)
 */
export function getDcAcRecommendation(
  analysis: BESSAdjustedAnalysis | DcAcAnalysis, 
  dcAcRatio: number,
  regionalPreset?: RegionalPreset
): string {
  const config = regionalPreset ? REGIONAL_PRESETS[regionalPreset] : null;
  
  // Check if within recommended range for region
  const withinRange = config 
    ? dcAcRatio >= config.recommendedDcAcMin && dcAcRatio <= config.recommendedDcAcMax
    : true;
  
  const regionNote = config && !withinRange
    ? ` Note: For ${config.name.toLowerCase()}, the recommended range is ${config.recommendedDcAcMin.toFixed(2)}-${config.recommendedDcAcMax.toFixed(2)}:1.`
    : '';
  
  if (dcAcRatio <= 1.0) {
    return `A 1:1 DC/AC ratio provides no oversizing benefits. Research shows 1.3:1 can achieve 12% yield increase with only 0.9% clipping.${regionNote}`;
  }
  
  // High-sun regions (like SA) - conservative ratios
  if (regionalPreset === 'high-sun') {
    if (dcAcRatio <= 1.2) {
      return `For South African conditions (1,864 kWh/kWp benchmark), a ${dcAcRatio.toFixed(2)}:1 ratio delivers ${analysis.net_gain_percent.toFixed(1)}% more energy with minimal ${analysis.clipping_percent}% clipping. Conservative but safe in high-irradiance environments.${regionNote}`;
    }
    if (dcAcRatio <= 1.35) {
      return `A ${dcAcRatio.toFixed(2)}:1 ratio is optimal for high-irradiance regions like South Africa. Industry data shows 12% yield gain achievable with <1% clipping. This balances yield improvement with thermal stress management.${regionNote}`;
    }
    if (dcAcRatio > 1.35) {
      return `Caution: ${dcAcRatio.toFixed(2)}:1 may cause excessive clipping (${analysis.clipping_percent}%) and inverter thermal stress in high-sun environments. The recommended range for SA is 1.10-1.35:1.${regionNote}`;
    }
  }
  
  // Cloudy regions - higher ratios beneficial
  if (regionalPreset === 'cloudy') {
    if (dcAcRatio < 1.3) {
      return `In low-irradiance regions, consider increasing to 1.3-1.5:1. Higher ratios maximize energy capture during fluctuating light conditions where clipping is minimal.${regionNote}`;
    }
    if (dcAcRatio <= 1.5) {
      return `A ${dcAcRatio.toFixed(2)}:1 ratio is well-suited for cloudy regions. The ${analysis.net_gain_percent.toFixed(1)}% yield gain with ${analysis.clipping_percent}% clipping represents optimal value extraction.${regionNote}`;
    }
  }
  
  // Default recommendations (moderate or no preset)
  if (dcAcRatio <= 1.25 && analysis.clipping_percent < 0.5) {
    return `A ${dcAcRatio.toFixed(2)}:1 DC/AC ratio delivers ${analysis.net_gain_percent.toFixed(1)}% more annual energy with negligible clipping (<0.25% at 1.2:1). This conservative approach suits premium module installations.${regionNote}`;
  }
  
  if (dcAcRatio <= 1.35 && analysis.clipping_percent < 1.5) {
    return `A ${dcAcRatio.toFixed(2)}:1 DC/AC ratio is optimal based on industry research. Real-world data shows 12% yield increase with only 0.9% clipping at 1.3:1 - excellent cost-benefit balance.${regionNote}`;
  }
  
  if (dcAcRatio <= 1.5 && analysis.clipping_percent < 6) {
    return `A ${dcAcRatio.toFixed(2)}:1 ratio provides ${analysis.net_gain_percent.toFixed(1)}% additional yield with ${analysis.clipping_percent}% clipping. Industry benchmarks show 2-5% clipping at 1.5:1 is acceptable when module costs are low.${regionNote}`;
  }
  
  if (dcAcRatio > 1.5) {
    // Check for BESS
    const bessAnalysis = analysis as BESSAdjustedAnalysis;
    if (bessAnalysis.bess_enabled) {
      return `With battery storage, ${dcAcRatio.toFixed(2)}:1 is viable. BESS captures ${bessAnalysis.clipped_energy_stored_kwh.toLocaleString()} kWh of clipped energy, reducing effective losses to ${bessAnalysis.effective_clipping_percent}%. Hybrid systems support ratios up to 2.0:1.${regionNote}`;
    }
    return `At ${dcAcRatio.toFixed(2)}:1 without storage, clipping losses of ${analysis.clipping_percent}% significantly reduce marginal benefit. Industry data shows up to 20% clipping at 2.0:1. Consider adding BESS or reducing ratio to 1.3-1.4:1.${regionNote}`;
  }
  
  return `The ${dcAcRatio.toFixed(2)}:1 ratio provides ${analysis.net_gain_percent.toFixed(1)}% yield improvement with ${analysis.clipping_percent}% clipping. Evaluate project economics against the 7.34-year payback benchmark from SA case studies.${regionNote}`;
}

/**
 * Get regional preset recommendation based on location
 */
export function getRecommendedPreset(latitude: number): RegionalPreset {
  const absLat = Math.abs(latitude);
  
  // Tropical/subtropical (high sun)
  if (absLat < 35) return 'high-sun';
  
  // Temperate (moderate)
  if (absLat < 50) return 'moderate';
  
  // High latitude (cloudy)
  return 'cloudy';
}
