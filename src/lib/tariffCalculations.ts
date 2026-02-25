/**
 * Tariff Calculations Utility
 * 
 * Provides blended rate calculations for financial modeling.
 * TOU hour distributions are now dynamically derived from the user's
 * TOU Settings (stored in localStorage) instead of being hardcoded.
 * 
 * Two blended rate methodologies:
 * 1. All Hours (24/7/365): 8,760 hours annual
 * 2. Solar Sun Hours (6h window): 2,190 hours annual - Core solar generation window
 */

import { TOUSettings, TOUHourMap, DEFAULT_TOU_SETTINGS } from "@/components/projects/load-profile/types";

// ============================================================================
// READ STORED TOU SETTINGS (inline to avoid circular deps with hooks)
// ============================================================================
function readStoredTOUSettings(): TOUSettings {
  try {
    const raw = localStorage.getItem("tou-settings");
    if (raw) return JSON.parse(raw) as TOUSettings;
  } catch { /* ignore */ }
  return DEFAULT_TOU_SETTINGS;
}

// ============================================================================
// SEASONAL DAY DISTRIBUTION (from Eskom tariff schedule)
// ============================================================================
export const SEASONAL_DAYS = {
  high: { weekdays: 66, saturdays: 13, sundays: 13, total: 92 },   // Jun-Aug
  low: { weekdays: 195, saturdays: 39, sundays: 39, total: 273 },  // Sep-May
};

// ============================================================================
// DYNAMIC TOU HOUR COUNTING (derives from stored TOU settings)
// ============================================================================

/** Count peak/standard/offPeak hours from a TOUHourMap */
function countTOUHours(hourMap: TOUHourMap): { peak: number; standard: number; offPeak: number } {
  let peak = 0, standard = 0, offPeak = 0;
  for (let h = 0; h < 24; h++) {
    const p = hourMap[h] || 'off-peak';
    if (p === 'peak') peak++;
    else if (p === 'standard') standard++;
    else offPeak++;
  }
  return { peak, standard, offPeak };
}

/** Count TOU hours within a solar window (default 6h: 09:00–15:00) */
function countSolarTOUHours(hourMap: TOUHourMap, start = 9, end = 15): { peak: number; standard: number; offPeak: number } {
  let peak = 0, standard = 0, offPeak = 0;
  for (let h = start; h < end; h++) {
    const p = hourMap[h] || 'off-peak';
    if (p === 'peak') peak++;
    else if (p === 'standard') standard++;
    else offPeak++;
  }
  return { peak, standard, offPeak };
}

/** Get dynamic TOU hours per day type for 24h window */
export function getTOUHours24H(settings?: TOUSettings) {
  const s = settings || readStoredTOUSettings();
  // Use a representative season (low season is 9/12 months, dominant)
  // But the actual blended rate functions use per-season hour counts
  return {
    weekday: countTOUHours(s.lowSeason.weekday),
    saturday: countTOUHours(s.lowSeason.saturday),
    sunday: countTOUHours(s.lowSeason.sunday),
  };
}

/** Get dynamic TOU hours per day type for solar window */
export function getTOUHoursSolar(settings?: TOUSettings) {
  const s = settings || readStoredTOUSettings();
  return {
    weekday: countSolarTOUHours(s.lowSeason.weekday),
    saturday: countSolarTOUHours(s.lowSeason.saturday),
    sunday: countSolarTOUHours(s.lowSeason.sunday),
  };
}

/** Calculate annual hour totals from TOU settings for a given season */
function calcSeasonalAnnualHours(
  seasonConfig: { weekday: TOUHourMap; saturday: TOUHourMap; sunday: TOUHourMap },
  seasonDays: { weekdays: number; saturdays: number; sundays: number },
  counter: (map: TOUHourMap) => { peak: number; standard: number; offPeak: number }
) {
  const wd = counter(seasonConfig.weekday);
  const sat = counter(seasonConfig.saturday);
  const sun = counter(seasonConfig.sunday);
  return {
    peak: wd.peak * seasonDays.weekdays + sat.peak * seasonDays.saturdays + sun.peak * seasonDays.sundays,
    standard: wd.standard * seasonDays.weekdays + sat.standard * seasonDays.saturdays + sun.standard * seasonDays.sundays,
    offPeak: wd.offPeak * seasonDays.weekdays + sat.offPeak * seasonDays.saturdays + sun.offPeak * seasonDays.sundays,
    total: (wd.peak + wd.standard + wd.offPeak) * seasonDays.weekdays +
           (sat.peak + sat.standard + sat.offPeak) * seasonDays.saturdays +
           (sun.peak + sun.standard + sun.offPeak) * seasonDays.sundays,
  };
}

/** Get dynamic annual hour totals for 24h window */
export function getAnnualHours24H(settings?: TOUSettings) {
  const s = settings || readStoredTOUSettings();
  const high = calcSeasonalAnnualHours(s.highSeason, SEASONAL_DAYS.high, countTOUHours);
  const low = calcSeasonalAnnualHours(s.lowSeason, SEASONAL_DAYS.low, countTOUHours);
  return {
    high,
    low,
    annual: {
      peak: high.peak + low.peak,
      standard: high.standard + low.standard,
      offPeak: high.offPeak + low.offPeak,
      total: high.total + low.total,
    },
  };
}

/** Get dynamic annual hour totals for solar window */
export function getAnnualHoursSolar(settings?: TOUSettings) {
  const s = settings || readStoredTOUSettings();
  const high = calcSeasonalAnnualHours(s.highSeason, SEASONAL_DAYS.high, (m) => countSolarTOUHours(m));
  const low = calcSeasonalAnnualHours(s.lowSeason, SEASONAL_DAYS.low, (m) => countSolarTOUHours(m));
  return {
    high,
    low,
    annual: {
      peak: high.peak + low.peak,
      standard: high.standard + low.standard,
      offPeak: high.offPeak + low.offPeak,
      total: high.total + low.total,
    },
  };
}

// Legacy static exports for backward compatibility (now dynamic getters)
export const TOU_HOURS_24H = {
  get weekday() { return getTOUHours24H().weekday; },
  get saturday() { return getTOUHours24H().saturday; },
  get sunday() { return getTOUHours24H().sunday; },
};

export const TOU_HOURS_SOLAR = {
  get weekday() { return getTOUHoursSolar().weekday; },
  get saturday() { return getTOUHoursSolar().saturday; },
  get sunday() { return getTOUHoursSolar().sunday; },
};

export const ANNUAL_HOURS_24H = {
  get high() { return getAnnualHours24H().high; },
  get low() { return getAnnualHours24H().low; },
  get annual() { return getAnnualHours24H().annual; },
};

export const ANNUAL_HOURS_SOLAR = {
  get high() { return getAnnualHoursSolar().high; },
  get low() { return getAnnualHoursSolar().low; },
  get annual() { return getAnnualHoursSolar().annual; },
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================
export interface TariffRate {
  id?: string;
  rate_per_kwh: number;
  time_of_use: string;
  season: string;
  network_charge_per_kwh?: number;
  ancillary_charge_per_kwh?: number;
  electrification_rural_per_kwh?: number;
  affordability_subsidy_per_kwh?: number;
}

export interface BlendedRateResult {
  high: number;
  low: number;
  annual: number;
}

export interface BlendedRatesBreakdown {
  allHours: BlendedRateResult & { hourBreakdown: { peak: number; standard: number; offPeak: number } };
  solarHours: BlendedRateResult & { hourBreakdown: { peak: number; standard: number; offPeak: number } };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if tariff rates are flat-rate (no TOU/seasonal variation)
 */
export function isFlatRateTariff(rates: TariffRate[] | null | undefined): boolean {
  if (!rates || rates.length === 0) return false;
  
  return rates.every(r => 
    (r.season === 'All Year' || !r.season) && 
    (r.time_of_use === 'Any' || !r.time_of_use)
  );
}

/**
 * Get flat rate from tariff rates (for fixed/conventional tariffs)
 */
export function getFlatRate(
  rates: TariffRate[], 
  tariff?: { legacy_charge_per_kwh?: number }
): number {
  const rate = rates.find(r => 
    (r.time_of_use === 'Any' || !r.time_of_use) &&
    (r.season === 'All Year' || !r.season)
  );
  
  if (!rate) return 0;
  
  const base = Number(rate.rate_per_kwh) || 0;
  const legacy = Number(tariff?.legacy_charge_per_kwh) || 0;
  const network = Number(rate.network_charge_per_kwh) || 0;
  const ancillary = Number(rate.ancillary_charge_per_kwh) || 0;
  const elecRural = Number(rate.electrification_rural_per_kwh) || 0;
  const affordability = Number(rate.affordability_subsidy_per_kwh) || 0;
  
  return base + legacy + network + ancillary + elecRural + affordability;
}

/**
 * Get combined rate including all unbundled charges for a specific TOU period and season
 */
export function getCombinedRate(
  rates: TariffRate[], 
  timeOfUse: 'Peak' | 'Standard' | 'Off-Peak', 
  season: 'high' | 'low',
  tariff?: { legacy_charge_per_kwh?: number }
): number {
  const seasonFilter = season === 'high' ? 'High/Winter' : 'Low/Summer';
  
  // 1. First try: TOU-specific rate for the season
  let rate = rates.find(r => 
    r.time_of_use === timeOfUse && 
    (r.season === seasonFilter || r.season?.includes(season === 'high' ? 'High' : 'Low'))
  );
  
  // 2. Fallback to "Any" TOU rate for the same season (seasonal non-TOU tariffs)
  if (!rate) {
    rate = rates.find(r => 
      (r.time_of_use === 'Any' || !r.time_of_use) &&
      (r.season === seasonFilter || r.season?.includes(season === 'high' ? 'High' : 'Low'))
    );
  }
  
  // 3. Final fallback: flat rate (All Year + Any TOU)
  if (!rate) {
    rate = rates.find(r => 
      (r.time_of_use === 'Any' || !r.time_of_use) &&
      (r.season === 'All Year' || !r.season)
    );
  }
  
  if (!rate) return 0;
  
  const base = Number(rate.rate_per_kwh) || 0;
  const legacy = Number(tariff?.legacy_charge_per_kwh) || 0;
  const network = Number(rate.network_charge_per_kwh) || 0;
  const ancillary = Number(rate.ancillary_charge_per_kwh) || 0;
  const elecRural = Number(rate.electrification_rural_per_kwh) || 0;
  const affordability = Number(rate.affordability_subsidy_per_kwh) || 0;
  
  return base + legacy + network + ancillary + elecRural + affordability;
}

// ============================================================================
// BLENDED RATE CALCULATIONS
// ============================================================================

/**
 * Calculate blended rate for 24-hour window (All Hours)
 * Uses the exact annual hour distribution from Eskom tariff schedule
 */
export function calculateAllHoursBlendedRate(
  rates: TariffRate[], 
  season: 'high' | 'low',
  tariff?: { legacy_charge_per_kwh?: number }
): number {
  const hours = ANNUAL_HOURS_24H[season];
  
  const peakRate = getCombinedRate(rates, 'Peak', season, tariff);
  const standardRate = getCombinedRate(rates, 'Standard', season, tariff);
  const offPeakRate = getCombinedRate(rates, 'Off-Peak', season, tariff);
  
  if (hours.total === 0) return 0;
  
  return (
    hours.peak * peakRate +
    hours.standard * standardRate +
    hours.offPeak * offPeakRate
  ) / hours.total;
}

/**
 * Calculate blended rate for 6-hour solar window (Solar Sun Hours)
 * Core solar generation window with ZERO Peak TOU exposure
 */
export function calculateSolarHoursBlendedRate(
  rates: TariffRate[], 
  season: 'high' | 'low',
  tariff?: { legacy_charge_per_kwh?: number }
): number {
  const hours = ANNUAL_HOURS_SOLAR[season];
  
  // Note: Peak = 0 for solar window, so we only need Standard and Off-Peak
  const standardRate = getCombinedRate(rates, 'Standard', season, tariff);
  const offPeakRate = getCombinedRate(rates, 'Off-Peak', season, tariff);
  
  if (hours.total === 0) return 0;
  
  return (
    hours.standard * standardRate +
    hours.offPeak * offPeakRate
  ) / hours.total;
}

/**
 * Calculate annual blended rates for both 24h and solar windows
 * Annual = (High Season Rate × High Season Hours + Low Season Rate × Low Season Hours) / Total Annual Hours
 */
export function calculateAnnualBlendedRates(
  rates: TariffRate[] | null | undefined,
  tariff?: { legacy_charge_per_kwh?: number }
): BlendedRatesBreakdown | null {
  if (!rates || rates.length === 0) return null;
  
  // Calculate seasonal rates for 24h window
  const allHoursHigh = calculateAllHoursBlendedRate(rates, 'high', tariff);
  const allHoursLow = calculateAllHoursBlendedRate(rates, 'low', tariff);
  const allHoursAnnual = ANNUAL_HOURS_24H.annual.total > 0
    ? (allHoursHigh * ANNUAL_HOURS_24H.high.total + allHoursLow * ANNUAL_HOURS_24H.low.total) / ANNUAL_HOURS_24H.annual.total
    : 0;
  
  // Calculate seasonal rates for solar window
  const solarHoursHigh = calculateSolarHoursBlendedRate(rates, 'high', tariff);
  const solarHoursLow = calculateSolarHoursBlendedRate(rates, 'low', tariff);
  const solarHoursAnnual = ANNUAL_HOURS_SOLAR.annual.total > 0
    ? (solarHoursHigh * ANNUAL_HOURS_SOLAR.high.total + solarHoursLow * ANNUAL_HOURS_SOLAR.low.total) / ANNUAL_HOURS_SOLAR.annual.total
    : 0;
  
  return {
    allHours: {
      high: allHoursHigh,
      low: allHoursLow,
      annual: allHoursAnnual,
      hourBreakdown: ANNUAL_HOURS_24H.annual,
    },
    solarHours: {
      high: solarHoursHigh,
      low: solarHoursLow,
      annual: solarHoursAnnual,
      hourBreakdown: ANNUAL_HOURS_SOLAR.annual,
    },
  };
}

// ============================================================================
// LEGACY EXPORTS (for backward compatibility)
// ============================================================================

// Sunshine hours for South Africa (approximate solar production hours)
// Summer: 06:00-19:00 (13 hours), Winter: 07:00-17:00 (10 hours)
export const SUNSHINE_HOURS = {
  summer: { start: 6, end: 19 }, // Low/Summer season
  winter: { start: 7, end: 17 }, // High/Winter season
};

// TOU period definitions - dynamically derived from stored TOU settings
function buildTOUPeriodArrays(): { peak: number[]; standard: number[]; offPeak: number[] } {
  const s = readStoredTOUSettings();
  const hourMap = s.lowSeason.weekday; // Use low-season weekday as primary reference
  const peak: number[] = [], standard: number[] = [], offPeak: number[] = [];
  for (let h = 0; h < 24; h++) {
    const p = hourMap[h] || 'off-peak';
    if (p === 'peak') peak.push(h);
    else if (p === 'standard') standard.push(h);
    else offPeak.push(h);
  }
  return { peak, standard, offPeak };
}

export const TOU_PERIODS = {
  get peak() { return buildTOUPeriodArrays().peak; },
  get standard() { return buildTOUPeriodArrays().standard; },
  get offPeak() { return buildTOUPeriodArrays().offPeak; },
};

// Solar production curve (relative output per hour, peaks at noon)
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

/**
 * @deprecated Use calculateAnnualBlendedRates() instead for accurate hour-based calculations
 * Legacy function maintained for backward compatibility
 */
export function calculateBlendedSolarRate(rates: TariffRate[], season: 'summer' | 'winter'): BlendedRateCalculation {
  const sunHours = season === 'summer' ? SUNSHINE_HOURS.summer : SUNSHINE_HOURS.winter;
  const seasonFilter = season === 'summer' ? 'Low/Summer' : 'High/Winter';
  
  const peakRate = rates.find(r => r.time_of_use === 'Peak' && r.season === seasonFilter)?.rate_per_kwh || 0;
  const standardRate = rates.find(r => r.time_of_use === 'Standard' && r.season === seasonFilter)?.rate_per_kwh || 0;
  const offPeakRate = rates.find(r => r.time_of_use === 'Off-Peak' && r.season === seasonFilter)?.rate_per_kwh || 0;
  
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
  const blendedEnergy = standardEnergy + offPeakEnergy;
  
  const blendedRate = blendedEnergy > 0
    ? (standardEnergy * standardRate + offPeakEnergy * offPeakRate) / blendedEnergy
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
 * @deprecated Use calculateAnnualBlendedRates() instead
 */
export function calculateAnnualBlendedRate(rates: TariffRate[] | null | undefined): number | null {
  if (!rates || rates.length === 0) return null;
  
  const summerCalc = calculateBlendedSolarRate(rates, 'summer');
  const winterCalc = calculateBlendedSolarRate(rates, 'winter');
  
  if (summerCalc.blendedRate === 0 && winterCalc.blendedRate === 0) {
    const fixedRate = rates.find(r => 
      r.time_of_use === 'Any' || r.season === 'All Year'
    );
    if (fixedRate) return Number(fixedRate.rate_per_kwh);
    
    const avgRate = rates.reduce((sum, r) => sum + Number(r.rate_per_kwh), 0) / rates.length;
    return avgRate > 0 ? avgRate : null;
  }
  
  return (summerCalc.blendedRate * 9 + winterCalc.blendedRate * 3) / 12;
}

/**
 * @deprecated Use calculateAnnualBlendedRates() instead
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
