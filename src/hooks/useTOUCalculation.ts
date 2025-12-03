import { useMemo } from "react";
import { getProfileData, ProfileType, RESIDENTIAL_PROFILE } from "@/components/calculator/ConsumptionProfile";

interface TOUPeriod {
  season: string;
  day_type: string;
  time_of_use: string;
  start_hour: number;
  end_hour: number;
  rate_per_kwh: number;
  demand_charge_per_kva?: number;
}

interface TariffRate {
  season: string;
  time_of_use: string;
  rate_per_kwh: number;
  block_start_kwh?: number;
  block_end_kwh?: number;
  demand_charge_per_kva?: number;
}

interface CalculationParams {
  monthlyConsumption: number;
  tariffType: string;
  rates: TariffRate[];
  touPeriods: TOUPeriod[];
  fixedMonthlyCharge: number;
  demandChargePerKva: number;
  maxDemand: number;
  profileType: ProfileType;
  customProfile: number[];
  weekdayPercentage: number;
  isHighDemandSeason: boolean;
  // Optional Critical Peak parameters
  criticalPeakRate?: number;
  criticalPeakHours?: number;
}

// Get the TOU type for a specific hour and day type
function getTOUForHour(
  hour: number,
  dayType: string,
  season: string,
  touPeriods: TOUPeriod[]
): TOUPeriod | undefined {
  return touPeriods.find(
    (p) =>
      p.season === season &&
      p.day_type === dayType &&
      hour >= p.start_hour &&
      hour < p.end_hour
  );
}

// Calculate weighted average rate for a consumption profile using TOU periods
// Now includes demand charge calculation based on Peak/Standard max demand (NERSA compliant)
function calculateTOUBill(
  consumption: number,
  touPeriods: TOUPeriod[],
  hourlyProfile: number[],
  weekdayPercentage: number,
  season: string,
  maxDemand: number,
  baseDemandCharge: number
): { energyCost: number; demandCost: number; breakdown: Record<string, number>; peakDemand: number } {
  const weekdayHours = 5; // Mon-Fri
  const saturdayHours = 1;
  const sundayHours = 1;
  const totalDays = 7;

  const weekdayWeight = (weekdayHours / totalDays) * (weekdayPercentage / 100);
  const saturdayWeight = (saturdayHours / totalDays) * ((100 - weekdayPercentage) / 100 / 2);
  const sundayWeight = (sundayHours / totalDays) * ((100 - weekdayPercentage) / 100 / 2);

  let totalCost = 0;
  const breakdown: Record<string, number> = { Peak: 0, Standard: 0, "Off-Peak": 0 };
  
  // Track maximum demand during Peak and Standard periods for NERSA-compliant billing
  let peakStandardMaxDemand = 0;
  let peakPeriodDemandCharge = baseDemandCharge;

  // Normalize profile to sum to 1
  const profileSum = hourlyProfile.reduce((a, b) => a + b, 0);
  const normalizedProfile = hourlyProfile.map((v) => v / profileSum);

  for (let hour = 0; hour < 24; hour++) {
    const hourlyConsumption = consumption * normalizedProfile[hour];
    // Estimate hourly demand as a fraction of max demand weighted by profile
    const hourlyDemand = maxDemand * normalizedProfile[hour] * 24;

    // Weekday consumption
    const weekdayPeriod = getTOUForHour(hour, "Weekday", season, touPeriods);
    if (weekdayPeriod) {
      const cost = hourlyConsumption * weekdayWeight * (weekdayPeriod.rate_per_kwh / 100);
      totalCost += cost;
      breakdown[weekdayPeriod.time_of_use] = (breakdown[weekdayPeriod.time_of_use] || 0) + 
        hourlyConsumption * weekdayWeight;
      
      // Track peak/standard demand for demand charge calculation
      if (weekdayPeriod.time_of_use === "Peak" || weekdayPeriod.time_of_use === "Standard") {
        peakStandardMaxDemand = Math.max(peakStandardMaxDemand, hourlyDemand);
        // Use period-specific demand charge if available
        if (weekdayPeriod.demand_charge_per_kva) {
          peakPeriodDemandCharge = Math.max(peakPeriodDemandCharge, weekdayPeriod.demand_charge_per_kva);
        }
      }
    }

    // Saturday consumption
    const satPeriod = getTOUForHour(hour, "Saturday", season, touPeriods);
    if (satPeriod) {
      const cost = hourlyConsumption * saturdayWeight * (satPeriod.rate_per_kwh / 100);
      totalCost += cost;
      breakdown[satPeriod.time_of_use] = (breakdown[satPeriod.time_of_use] || 0) + 
        hourlyConsumption * saturdayWeight;
    }

    // Sunday consumption
    const sunPeriod = getTOUForHour(hour, "Sunday", season, touPeriods);
    if (sunPeriod) {
      const cost = hourlyConsumption * sundayWeight * (sunPeriod.rate_per_kwh / 100);
      totalCost += cost;
      breakdown[sunPeriod.time_of_use] = (breakdown[sunPeriod.time_of_use] || 0) + 
        hourlyConsumption * sundayWeight;
    }
  }

  // NERSA-compliant demand charge: based on max demand during Peak/Standard periods
  const effectiveDemand = peakStandardMaxDemand > 0 ? peakStandardMaxDemand : maxDemand;
  const demandCost = effectiveDemand * peakPeriodDemandCharge;

  return { energyCost: totalCost, demandCost, breakdown, peakDemand: effectiveDemand };
}

// Calculate IBT (Inclining Block Tariff) bill
function calculateIBTBill(consumption: number, rates: TariffRate[]): number {
  const sortedRates = [...rates].sort((a, b) => (a.block_start_kwh || 0) - (b.block_start_kwh || 0));
  let remaining = consumption;
  let cost = 0;

  for (const rate of sortedRates) {
    if (remaining <= 0) break;
    const blockStart = rate.block_start_kwh || 0;
    const blockEnd = rate.block_end_kwh ?? Infinity;
    const blockSize = blockEnd - blockStart;
    const consumptionInBlock = Math.min(remaining, blockSize);
    cost += consumptionInBlock * (rate.rate_per_kwh / 100);
    remaining -= consumptionInBlock;
  }

  return cost;
}

export function useTOUCalculation(params: CalculationParams) {
  return useMemo(() => {
    const {
      monthlyConsumption,
      tariffType,
      rates,
      touPeriods,
      fixedMonthlyCharge,
      demandChargePerKva,
      maxDemand,
      profileType,
      customProfile,
      weekdayPercentage,
      isHighDemandSeason,
      criticalPeakRate,
      criticalPeakHours,
    } = params;

    if (monthlyConsumption === 0) return null;

    const profile = getProfileData(profileType, customProfile);
    const season = isHighDemandSeason ? "High Demand" : "Low Demand";

    let energyCost = 0;
    let demandCost = 0;
    let breakdown: Record<string, number> = {};
    let peakDemand = maxDemand;

    if (tariffType === "TOU" && touPeriods.length > 0) {
      // Use NERSA-compliant TOU calculation with Peak/Standard max demand
      const result = calculateTOUBill(
        monthlyConsumption,
        touPeriods,
        profile,
        weekdayPercentage,
        season,
        maxDemand,
        demandChargePerKva
      );
      energyCost = result.energyCost;
      demandCost = result.demandCost;
      breakdown = result.breakdown;
      peakDemand = result.peakDemand;
      
      // Add Critical Peak Pricing if applicable
      if (criticalPeakRate && criticalPeakHours && criticalPeakHours > 0) {
        const criticalPeakConsumption = (monthlyConsumption / 720) * criticalPeakHours; // Avg hourly * CPP hours
        const criticalPeakCost = criticalPeakConsumption * (criticalPeakRate / 100);
        energyCost += criticalPeakCost;
        breakdown["Critical Peak"] = criticalPeakConsumption;
      }
    } else if (tariffType === "IBT" && rates.length > 0) {
      energyCost = calculateIBTBill(monthlyConsumption, rates);
      demandCost = maxDemand * (demandChargePerKva || 0);
    } else if (rates.length > 0) {
      // Fixed rate
      energyCost = monthlyConsumption * (rates[0].rate_per_kwh / 100);
      demandCost = maxDemand * (demandChargePerKva || 0);
    }

    const fixedCost = fixedMonthlyCharge || 0;
    const totalBill = fixedCost + demandCost + energyCost;

    return {
      energyCost,
      fixedCost,
      demandCost,
      totalBill,
      breakdown,
      season,
      peakDemand,
    };
  }, [params]);
}
