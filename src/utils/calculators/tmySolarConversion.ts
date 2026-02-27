/**
 * TMY Solar Conversion Utility
 * 
 * Converts 8,760 hourly GHI values (W/m²) from a Typical Meteorological Year
 * into 8,760 hourly inverter output values (kWh), applying the full PVsyst
 * loss chain split into DC and AC stages.
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
  dcOutput: number[];             // 8,760 hourly DC values (after irradiance + array losses)
  acOutput: number[];             // 8,760 hourly AC values (after inverter losses + clipping)
  inverterLossMultiplier: number; // For 1:1 baseline calculation by caller
}

/**
 * Calculate the DC-stage loss multiplier (irradiance + array losses).
 * Represents losses from GHI to the DC bus (panel/string level).
 */
function calculateDcLossMultiplier(config: PVsystLossChainConfig): number {
  const { irradiance, array } = config;

  // Irradiance losses (optical)
  const irradianceFactor =
    (1 - irradiance.transpositionLoss / 100) *
    (1 - irradiance.nearShadingLoss / 100) *
    (1 - irradiance.iamLoss / 100) *
    (1 - irradiance.soilingLoss / 100);

  // Array losses (including spectral & electrical shading)
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

  return irradianceFactor * arrayFactor;
}

/**
 * Calculate the inverter-stage loss multiplier (inverter + post-inverter losses).
 * Represents the DC-to-AC conversion efficiency.
 */
function calculateInverterLossMultiplier(config: PVsystLossChainConfig): number {
  const inv = config.system.inverter;
  const inverterFactor =
    (1 - inv.operationEfficiency / 100) *
    (1 - inv.overNominalPower / 100) *
    (1 - inv.maxInputCurrent / 100) *
    (1 - inv.overNominalVoltage / 100) *
    (1 - inv.powerThreshold / 100) *
    (1 - inv.voltageThreshold / 100);

  const postInverterFactor = 1 - (config.lossesAfterInverter?.availabilityLoss ?? 0) / 100;

  return inverterFactor * postInverterFactor;
}

/**
 * Convert 8,760 hourly GHI values (W/m²) to inverter output (kWh).
 * 
 * For each hour:
 *   1. GHI (W/m²) × 1h = Wh/m²  →  /1000 = kWh/m²
 *   2. × collector area = energy on collectors (kWh)
 *   3. × STC efficiency = array nominal (kWh)
 *   4. × DC loss multiplier (irradiance + array losses)
 *   5. × production reduction factor
 *   → dcOutput
 *   6. × inverter loss multiplier (inverter + post-inverter losses)
 *   7. Clip at inverter AC limit
 *   → acOutput
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

  const dcLossMult = calculateDcLossMultiplier(pvsystConfig);
  const invLossMult = calculateInverterLossMultiplier(pvsystConfig);
  const dcFactor = (collectorAreaM2 * stcEfficiency * dcLossMult * reductionFactor) / 1000;

  const dcOutput: number[] = new Array(hourlyGhiWm2.length);
  const acOutput: number[] = new Array(hourlyGhiWm2.length);

  for (let i = 0; i < hourlyGhiWm2.length; i++) {
    const ghiWm2 = hourlyGhiWm2[i];
    if (ghiWm2 <= 0) {
      dcOutput[i] = 0;
      acOutput[i] = 0;
    } else {
      const dc = ghiWm2 * dcFactor;
      dcOutput[i] = dc;
      const acBeforeClip = dc * invLossMult;
      acOutput[i] = maxAcOutputKw != null ? Math.min(acBeforeClip, maxAcOutputKw) : acBeforeClip;
    }
  }

  return { dcOutput, acOutput, inverterLossMultiplier: invLossMult };
}
