/**
 * Tariff Calculations Utility
 * 
 * Provides blended solar rate calculations for financial modeling.
 * The blended rate represents the effective tariff during sunshine hours,
 * weighted by actual solar production (peaks at noon).
 */

// Sunshine hours for South Africa (approximate solar production hours)
// Summer: 06:00-19:00 (13 hours), Winter: 07:00-17:00 (10 hours)
export const SUNSHINE_HOURS = {
  summer: { start: 6, end: 19 }, // Low/Summer season
  winter: { start: 7, end: 17 }, // High/Winter season
};

// TOU period definitions (SA standard weekday)
export const TOU_PERIODS = {
  peak: [7, 8, 9, 18, 19], // 07:00-10:00, 18:00-20:00
  standard: [6, 10, 11, 12, 13, 14, 15, 16, 17, 20, 21], // 06:00-07:00, 10:00-18:00, 20:00-22:00
  offPeak: [0, 1, 2, 3, 4, 5, 22, 23], // 22:00-06:00
};

// Solar production curve (relative output per hour, peaks at noon)
// Values represent typical PV output as a fraction of peak capacity
export const SOLAR_CURVE: Record<number, number> = {
  5: 0.05, 6: 0.15, 7: 0.35, 8: 0.55, 9: 0.75, 10: 0.88, 11: 0.95,
  12: 1.0, 13: 0.98, 14: 0.92, 15: 0.82, 16: 0.68, 17: 0.50, 18: 0.30, 19: 0.10,
};

export interface BlendedRateCalculation {
  blendedRate: number;
  peakHours: number;
  standardHours: number;
  offPeakHours: number;
  peakEnergy: number;
  standardEnergy: number;
  offPeakEnergy: number;
  totalEnergy: number;
  breakdown: {
    period: string;
    hours: number;
    energyPercent: number;
    rate: number;
    contribution: number;
  }[];
}

export interface TariffRate {
  id?: string;
  rate_per_kwh: number;
  time_of_use: string;
  season: string;
}

/**
 * Calculate blended solar rate for a specific season
 * 
 * This calculates the effective tariff rate during sunshine hours,
 * weighted by the solar production curve. Solar produces most energy
 * during Standard TOU periods (10:00-18:00), so this typically results
 * in a rate lower than the simple average of all TOU rates.
 * 
 * @param rates - Array of tariff rates with time_of_use and season
 * @param season - 'summer' (Low/Summer) or 'winter' (High/Winter)
 * @returns BlendedRateCalculation with detailed breakdown
 */
export function calculateBlendedSolarRate(rates: TariffRate[], season: 'summer' | 'winter'): BlendedRateCalculation {
  const sunHours = season === 'summer' ? SUNSHINE_HOURS.summer : SUNSHINE_HOURS.winter;
  const seasonFilter = season === 'summer' ? 'Low/Summer' : 'High/Winter';
  
  // Get rates for this season (fallback to 0 if not found)
  const peakRate = rates.find(r => r.time_of_use === 'Peak' && r.season === seasonFilter)?.rate_per_kwh || 0;
  const standardRate = rates.find(r => r.time_of_use === 'Standard' && r.season === seasonFilter)?.rate_per_kwh || 0;
  const offPeakRate = rates.find(r => r.time_of_use === 'Off-Peak' && r.season === seasonFilter)?.rate_per_kwh || 0;
  
  // Calculate energy-weighted hours during sunshine
  let peakEnergy = 0, standardEnergy = 0, offPeakEnergy = 0;
  let peakHours = 0, standardHours = 0, offPeakHours = 0;
  
  for (let hour = sunHours.start; hour < sunHours.end; hour++) {
    const solarOutput = SOLAR_CURVE[hour] || 0;
    
    if (TOU_PERIODS.peak.includes(hour)) {
      peakEnergy += solarOutput;
      peakHours++;
    } else if (TOU_PERIODS.standard.includes(hour)) {
      standardEnergy += solarOutput;
      standardHours++;
    } else {
      offPeakEnergy += solarOutput;
      offPeakHours++;
    }
  }
  
  const totalEnergy = peakEnergy + standardEnergy + offPeakEnergy;
  
  // Calculate blended rate weighted by solar production
  const blendedRate = totalEnergy > 0
    ? (peakEnergy * peakRate + standardEnergy * standardRate + offPeakEnergy * offPeakRate) / totalEnergy
    : 0;
  
  const breakdown = [
    {
      period: 'Peak',
      hours: peakHours,
      energyPercent: totalEnergy > 0 ? (peakEnergy / totalEnergy) * 100 : 0,
      rate: Number(peakRate),
      contribution: totalEnergy > 0 ? (peakEnergy * peakRate) / totalEnergy : 0,
    },
    {
      period: 'Standard',
      hours: standardHours,
      energyPercent: totalEnergy > 0 ? (standardEnergy / totalEnergy) * 100 : 0,
      rate: Number(standardRate),
      contribution: totalEnergy > 0 ? (standardEnergy * standardRate) / totalEnergy : 0,
    },
    {
      period: 'Off-Peak',
      hours: offPeakHours,
      energyPercent: totalEnergy > 0 ? (offPeakEnergy / totalEnergy) * 100 : 0,
      rate: Number(offPeakRate),
      contribution: totalEnergy > 0 ? (offPeakEnergy * offPeakRate) / totalEnergy : 0,
    },
  ];
  
  return {
    blendedRate,
    peakHours, standardHours, offPeakHours,
    peakEnergy, standardEnergy, offPeakEnergy,
    totalEnergy,
    breakdown,
  };
}

/**
 * Calculate annual blended solar rate
 * 
 * Weighted average of summer and winter blended rates:
 * - 9 months Low/Summer (September - May)
 * - 3 months High/Winter (June - August)
 * 
 * @param rates - Array of tariff rates
 * @returns Annual blended rate in R/kWh, or null if no valid rates
 */
export function calculateAnnualBlendedRate(rates: TariffRate[] | null | undefined): number | null {
  if (!rates || rates.length === 0) return null;
  
  const summerCalc = calculateBlendedSolarRate(rates, 'summer');
  const winterCalc = calculateBlendedSolarRate(rates, 'winter');
  
  // If both calculations returned 0, rates may not be TOU structure
  if (summerCalc.blendedRate === 0 && winterCalc.blendedRate === 0) {
    // Fallback: check for "Any" time_of_use or "All Year" season (fixed rate)
    const fixedRate = rates.find(r => 
      r.time_of_use === 'Any' || r.season === 'All Year'
    );
    if (fixedRate) return Number(fixedRate.rate_per_kwh);
    
    // Last fallback: simple average
    const avgRate = rates.reduce((sum, r) => sum + Number(r.rate_per_kwh), 0) / rates.length;
    return avgRate > 0 ? avgRate : null;
  }
  
  // Weighted annual average: 9 months summer + 3 months winter
  return (summerCalc.blendedRate * 9 + winterCalc.blendedRate * 3) / 12;
}

/**
 * Get full blended rate breakdown for both seasons
 * Useful for storing in simulation results and displaying in reports
 */
export function getBlendedRateBreakdown(rates: TariffRate[] | null | undefined): {
  annual: number | null;
  summer: BlendedRateCalculation | null;
  winter: BlendedRateCalculation | null;
} {
  if (!rates || rates.length === 0) {
    return { annual: null, summer: null, winter: null };
  }
  
  const summer = calculateBlendedSolarRate(rates, 'summer');
  const winter = calculateBlendedSolarRate(rates, 'winter');
  const annual = calculateAnnualBlendedRate(rates);
  
  return { annual, summer, winter };
}
