/**
 * TMY Solar Conversion Utility
 * 
 * Converts 8,760 hourly GHI values (W/m²) from a Typical Meteorological Year
 * into 8,760 hourly inverter output values (kWh), applying the full PVsyst
 * loss chain.
 * 
 * Pure function — no UI, no side effects.
 */

import type { PVsystLossChainConfig } from "@/lib/pvsystLossChain";

export interface TMYConversionParams {
  hourlyGhiWm2: number[];        // 8,760 GHI values in W/m²
  collectorAreaM2: number;        // Physical collector area from module dimensions
  stcEfficiency: number;          // Module STC efficiency (e.g. 0.2149)
  pvsystConfig: PVsystLossChainConfig;
  reductionFactor: number;        // Production reduction (e.g. 0.85 for 15% reduction)
  maxAcOutputKw?: number;         // Inverter AC limit for clipping (kW)
}

export interface TMYConversionResult {
  dcOutput: number[];             // 8,760 hourly DC values (pre-clipping, kWh)
  acOutput: number[];             // 8,760 hourly AC values (post-clipping, kWh)
}

/**
 * Calculate the combined PVsyst loss multiplier from a config.
 * 
 * Each loss percentage is applied multiplicatively:
 *   result = (1 - loss1/100) * (1 - loss2/100) * ...
 */
function calculateCombinedLossMultiplier(config: PVsystLossChainConfig): number {
  const { irradiance, array, system, lossesAfterInverter } = config;

  // Irradiance losses (optical only — spectral & electrical shading are array-level)
  const irradianceFactor =
    (1 - irradiance.transpositionLoss / 100) *
    (1 - irradiance.nearShadingLoss / 100) *
    (1 - irradiance.iamLoss / 100) *
    (1 - irradiance.soilingLoss / 100);

  // Array losses (including spectral & electrical shading moved here)
  const arrayFactor =
    (1 - irradiance.spectralLoss / 100) *
    (1 - irradiance.electricalShadingLoss / 100) *
    (1 - array.irradianceLevelLoss / 100) *
    (1 - array.temperatureLoss / 100) *
    (1 - array.moduleQualityLoss / 100) *
    (1 - array.lidLoss / 100) *
    (1 - array.moduleDegradationLoss / 100) *
    (1 - array.mismatchLoss / 100) *
    (1 - array.ohmicLoss / 100);

  // Inverter losses
  const inv = system.inverter;
  const inverterFactor =
    (1 - inv.operationEfficiency / 100) *
    (1 - inv.overNominalPower / 100) *
    (1 - inv.maxInputCurrent / 100) *
    (1 - inv.overNominalVoltage / 100) *
    (1 - inv.powerThreshold / 100) *
    (1 - inv.voltageThreshold / 100);

  // Post-inverter losses
  const postInverterFactor = 1 - (lossesAfterInverter?.availabilityLoss ?? 0) / 100;

  return irradianceFactor * arrayFactor * inverterFactor * postInverterFactor;
}

/**
 * Convert 8,760 hourly GHI values (W/m²) to inverter output (kWh).
 * 
 * For each hour:
 *   1. GHI (W/m²) × 1h = Wh/m²  →  /1000 = kWh/m²
 *   2. × collector area = energy on collectors (kWh)
 *   3. × STC efficiency = array nominal (kWh)
 *   4. × combined PVsyst loss multiplier
 *   5. × production reduction factor
 */
export function convertTMYToSolarGeneration(params: TMYConversionParams): TMYConversionResult {
  const {
    hourlyGhiWm2,
    collectorAreaM2,
    stcEfficiency,
    pvsystConfig,
    reductionFactor,
    maxAcOutputKw,
  } = params;

  const lossMultiplier = calculateCombinedLossMultiplier(pvsystConfig);
  const combinedFactor = (collectorAreaM2 * stcEfficiency * lossMultiplier * reductionFactor) / 1000;

  const dcOutput: number[] = new Array(hourlyGhiWm2.length);
  const acOutput: number[] = new Array(hourlyGhiWm2.length);

  for (let i = 0; i < hourlyGhiWm2.length; i++) {
    const ghiWm2 = hourlyGhiWm2[i];
    if (ghiWm2 <= 0) {
      dcOutput[i] = 0;
      acOutput[i] = 0;
    } else {
      const dc = ghiWm2 * combinedFactor;
      dcOutput[i] = dc;
      acOutput[i] = maxAcOutputKw != null ? Math.min(dc, maxAcOutputKw) : dc;
    }
  }

  return { dcOutput, acOutput };
}
