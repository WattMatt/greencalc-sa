// PVsyst-style loss chain calculation module
// Matches the detailed methodology from industry-standard PVsyst simulations

// ============================================================================
// Loss Chain Interfaces
// ============================================================================

export interface IrradianceLosses {
  shadingLoss: number;        // % (e.g., 3.78)
  iamLoss: number;            // Incidence Angle Modifier (e.g., 2.29)
  soilingLoss: number;        // % (e.g., 3.00)
  spectralLoss: number;       // % (e.g., 0.5)
}

export interface ArrayLosses {
  irradianceLevelLoss: number;  // PV loss due to irradiance level (e.g., 0.80)
  moduleQualityLoss: number;    // Module quality loss (e.g., 0.50)
  lidLoss: number;              // Light-Induced Degradation first year (e.g., 2.00)
  annualDegradation: number;    // % per year (e.g., 0.50)
  mismatchLoss: number;         // Module mismatch incl. degradation dispersion (e.g., 3.68)
  ohmicLoss: number;            // DC wiring losses (e.g., 1.10)
}

export interface SystemLosses {
  inverterLoss: number;       // Inverter efficiency loss (e.g., 1.55)
  acWiringLoss: number;       // AC cable losses (e.g., 0.50)
  transformerLoss: number;    // If applicable (e.g., 0.50)
  availabilityLoss: number;   // Downtime (e.g., 1.76)
}

export interface PVsystLossChainConfig {
  irradiance: IrradianceLosses;
  array: ArrayLosses;
  system: SystemLosses;
  operationYear: number;       // Year of operation (1-25) for degradation
  cellTempCoefficient: number; // %/°C (typically -0.35 to -0.45)
  noct: number;                // Nominal Operating Cell Temperature (typically 45°C)
  transpositionFactor: number; // POA gain from tilted surface (e.g., 1.08)
}

export interface LossBreakdownItem {
  stage: string;
  lossPercent: number;
  energyAfter: number;
  isGain?: boolean;
}

export interface LossChainResult {
  // Sequential chain values
  ghiInput: number;           // kWh/m²/day input
  poaIrradiance: number;      // After transposition
  effectiveIrradiance: number; // After shading, IAM, soiling
  arrayNominalSTC: number;     // At STC conditions
  arrayMPP: number;            // After temperature, degradation
  eGrid: number;               // Final AC output (kWh/day)
  
  // Loss breakdown for waterfall chart
  lossBreakdown: LossBreakdownItem[];
  
  // Summary metrics
  performanceRatio: number;    // PR = E_Grid / (GHI × Capacity) × 100
  specificYield: number;       // kWh/kWp/year
  totalLossPercent: number;    // Combined losses
  temperatureLoss: number;     // Dynamic temp loss %
  cumulativeDegradation: number; // Total degradation at this year
}

export interface HourlyLossResult {
  hour: number;
  eGridKwh: number;
  temperatureLoss: number;
  cellTemp: number;
}

// ============================================================================
// Default Configuration (matching Excel spreadsheet values)
// ============================================================================

export const DEFAULT_PVSYST_CONFIG: PVsystLossChainConfig = {
  irradiance: {
    shadingLoss: 3.78,
    iamLoss: 2.29,
    soilingLoss: 3.00,
    spectralLoss: 0.5,
  },
  array: {
    irradianceLevelLoss: 0.80,   // PV loss due to irradiance level
    moduleQualityLoss: 0.50,     // Module quality loss
    lidLoss: 2.00,               // LID - Light induced degradation
    annualDegradation: 0.50,     // For cumulative calculation
    mismatchLoss: 3.68,          // Including 1.7% for degradation dispersion
    ohmicLoss: 1.10,             // Ohmic wiring loss
  },
  system: {
    inverterLoss: 1.55,
    acWiringLoss: 0.50,
    transformerLoss: 0,
    availabilityLoss: 1.76,
  },
  operationYear: 1,
  cellTempCoefficient: -0.40, // %/°C for typical mono-Si
  noct: 45,
  transpositionFactor: 1.08, // Typical gain from tilted surface in SA
};

// ============================================================================
// Core Calculation Functions
// ============================================================================

/**
 * Calculate cell temperature based on ambient temp and irradiance
 */
export function calculateCellTemperature(
  ambientTemp: number,
  irradianceWm2: number,
  noct: number = 45
): number {
  // NOCT-based cell temperature calculation
  // Tcell = Tamb + (NOCT - 20) × (G / 800)
  return ambientTemp + (noct - 20) * (irradianceWm2 / 800);
}

/**
 * Calculate temperature loss based on cell temperature and coefficient
 */
export function calculateTemperatureLoss(
  cellTemp: number,
  tempCoefficient: number = -0.40
): number {
  // Temperature loss = (Tcell - 25) × |coefficient|
  // Only applies when cell is above 25°C
  return Math.max(0, (cellTemp - 25) * Math.abs(tempCoefficient));
}

/**
 * Calculate cumulative degradation for a given operation year
 */
export function calculateCumulativeDegradation(
  operationYear: number,
  lidLoss: number,
  annualDegradation: number
): number {
  // Year 1: LID only
  // Year 2+: LID + (year - 1) × annual degradation
  if (operationYear <= 1) {
    return lidLoss;
  }
  return lidLoss + (operationYear - 1) * annualDegradation;
}

/**
 * Main PVsyst loss chain calculation
 * Calculates energy output following the PVsyst methodology
 */
export function calculatePVsystLossChain(
  dailyGHI: number,           // kWh/m²/day
  capacityKwp: number,
  ambientTemp: number,        // Average daily temperature °C
  config: PVsystLossChainConfig
): LossChainResult {
  // Theoretical output at STC (reference for PR calculation)
  const theoreticalOutput = dailyGHI * capacityKwp;
  
  // ========================================
  // Step 1: GHI to POA (transposition gain)
  // ========================================
  const poaIrradiance = dailyGHI * config.transpositionFactor;
  
  // ========================================
  // Step 2: Effective Irradiance (optical losses)
  // ========================================
  const opticalFactor = 
    (1 - config.irradiance.shadingLoss / 100) *
    (1 - config.irradiance.iamLoss / 100) *
    (1 - config.irradiance.soilingLoss / 100) *
    (1 - config.irradiance.spectralLoss / 100);
  const effectiveIrradiance = poaIrradiance * opticalFactor;
  
  // ========================================
  // Step 3: Array Nominal at STC
  // ========================================
  const arrayNominalSTC = effectiveIrradiance * capacityKwp;
  
  // ========================================
  // Step 4: Temperature Loss (dynamic calculation)
  // ========================================
  // Approximate peak irradiance for temp calculation (W/m²)
  const peakIrradianceWm2 = (dailyGHI * 1000) / 5; // Rough estimate: spread over 5 peak hours
  const cellTemp = calculateCellTemperature(ambientTemp, peakIrradianceWm2, config.noct);
  const temperatureLoss = calculateTemperatureLoss(cellTemp, config.cellTempCoefficient);
  
  // ========================================
  // Step 5: Degradation (cumulative)
  // ========================================
  const cumulativeDegradation = calculateCumulativeDegradation(
    config.operationYear,
    config.array.lidLoss,
    config.array.annualDegradation
  );
  
  // ========================================
  // Step 6: Array at MPP (after all array losses)
  // ========================================
  const arrayFactor = 
    (1 - temperatureLoss / 100) *
    (1 - cumulativeDegradation / 100) *
    (1 - config.array.irradianceLevelLoss / 100) *
    (1 - config.array.moduleQualityLoss / 100) *
    (1 - config.array.mismatchLoss / 100) *
    (1 - config.array.ohmicLoss / 100);
  const arrayMPP = arrayNominalSTC * arrayFactor;
  
  // ========================================
  // Step 7: E_Grid (after system losses)
  // ========================================
  const systemFactor = 
    (1 - config.system.inverterLoss / 100) *
    (1 - config.system.acWiringLoss / 100) *
    (1 - config.system.transformerLoss / 100) *
    (1 - config.system.availabilityLoss / 100);
  const eGrid = arrayMPP * systemFactor;
  
  // ========================================
  // Calculate Performance Ratio
  // ========================================
  const performanceRatio = theoreticalOutput > 0 
    ? (eGrid / theoreticalOutput) * 100 
    : 0;
  
  // ========================================
  // Build loss breakdown for waterfall visualization
  // ========================================
  const startEnergy = theoreticalOutput;
  const transpositionGain = (config.transpositionFactor - 1) * 100;
  
  const lossBreakdown: LossBreakdownItem[] = [
    { stage: "GHI Input", lossPercent: 0, energyAfter: startEnergy },
    { stage: "Transposition", lossPercent: -transpositionGain, energyAfter: poaIrradiance * capacityKwp, isGain: true },
    { stage: "IAM", lossPercent: config.irradiance.iamLoss, energyAfter: 0 },
    { stage: "Soiling", lossPercent: config.irradiance.soilingLoss, energyAfter: effectiveIrradiance * capacityKwp },
    // Array losses in Excel order:
    { stage: `Module Degradation (Yr ${config.operationYear})`, lossPercent: cumulativeDegradation, energyAfter: 0 },
    { stage: "Irradiance Level", lossPercent: config.array.irradianceLevelLoss, energyAfter: 0 },
    { stage: "Temperature", lossPercent: temperatureLoss, energyAfter: 0 },
    { stage: "Spectral Correction", lossPercent: config.irradiance.spectralLoss, energyAfter: 0 },
    { stage: "Shading Electrical", lossPercent: config.irradiance.shadingLoss, energyAfter: 0 },
    { stage: "Module Quality", lossPercent: config.array.moduleQualityLoss, energyAfter: 0 },
    { stage: "LID", lossPercent: config.array.lidLoss, energyAfter: 0 },
    { stage: "Mismatch", lossPercent: config.array.mismatchLoss, energyAfter: 0 },
    { stage: "Ohmic Wiring", lossPercent: config.array.ohmicLoss, energyAfter: arrayMPP },
    // System losses:
    { stage: "Inverter", lossPercent: config.system.inverterLoss, energyAfter: 0 },
    { stage: "AC Wiring", lossPercent: config.system.acWiringLoss, energyAfter: 0 },
    { stage: "Availability", lossPercent: config.system.availabilityLoss, energyAfter: eGrid },
  ];
  
  // Filter out zero transformer loss if not applicable
  if (config.system.transformerLoss > 0) {
    lossBreakdown.splice(lossBreakdown.length - 1, 0, {
      stage: "Transformer",
      lossPercent: config.system.transformerLoss,
      energyAfter: 0,
    });
  }
  
  return {
    ghiInput: dailyGHI,
    poaIrradiance,
    effectiveIrradiance,
    arrayNominalSTC,
    arrayMPP,
    eGrid,
    lossBreakdown,
    performanceRatio,
    specificYield: (eGrid * 365) / capacityKwp,
    totalLossPercent: 100 - performanceRatio,
    temperatureLoss,
    cumulativeDegradation,
  };
}

/**
 * Calculate hourly energy output with PVsyst loss chain
 * Used for detailed simulation with hourly GHI and temperature data
 */
export function calculateHourlyPVsystOutput(
  hourlyGhi: number[],        // 24-hour GHI in W/m²
  hourlyTemp: number[],       // 24-hour ambient temperature °C
  capacityKwp: number,
  config: PVsystLossChainConfig
): HourlyLossResult[] {
  const results: HourlyLossResult[] = [];
  
  for (let hour = 0; hour < 24; hour++) {
    const ghiWm2 = hourlyGhi[hour] ?? 0;
    const ambientTemp = hourlyTemp[hour] ?? 25;
    
    if (ghiWm2 <= 0) {
      results.push({
        hour,
        eGridKwh: 0,
        temperatureLoss: 0,
        cellTemp: ambientTemp,
      });
      continue;
    }
    
    // Convert W/m² to kWh/m² for this hour
    const hourlyGhiKwhM2 = ghiWm2 / 1000;
    
    // Cell temperature for this hour
    const cellTemp = calculateCellTemperature(ambientTemp, ghiWm2, config.noct);
    const tempLoss = calculateTemperatureLoss(cellTemp, config.cellTempCoefficient);
    
    // Cumulative degradation
    const cumulativeDegradation = calculateCumulativeDegradation(
      config.operationYear,
      config.array.lidLoss,
      config.array.annualDegradation
    );
    
    // Apply full loss chain
    const poaFactor = config.transpositionFactor;
    const opticalFactor = 
      (1 - config.irradiance.shadingLoss / 100) *
      (1 - config.irradiance.iamLoss / 100) *
      (1 - config.irradiance.soilingLoss / 100) *
      (1 - config.irradiance.spectralLoss / 100);
    const arrayFactor = 
      (1 - tempLoss / 100) *
      (1 - cumulativeDegradation / 100) *
      (1 - config.array.irradianceLevelLoss / 100) *
      (1 - config.array.moduleQualityLoss / 100) *
      (1 - config.array.mismatchLoss / 100) *
      (1 - config.array.ohmicLoss / 100);
    const systemFactor = 
      (1 - config.system.inverterLoss / 100) *
      (1 - config.system.acWiringLoss / 100) *
      (1 - config.system.transformerLoss / 100) *
      (1 - config.system.availabilityLoss / 100);
    
    const eGridKwh = hourlyGhiKwhM2 * capacityKwp * poaFactor * opticalFactor * arrayFactor * systemFactor;
    
    results.push({
      hour,
      eGridKwh: Math.max(0, eGridKwh),
      temperatureLoss: tempLoss,
      cellTemp,
    });
  }
  
  return results;
}

/**
 * Generate 20-year degradation projection
 */
export function generate20YearProjection(
  dailyGHI: number,
  capacityKwp: number,
  ambientTemp: number,
  config: PVsystLossChainConfig
): Array<{
  year: number;
  cumulativeDegradation: number;
  performanceRatio: number;
  annualEGridKwh: number;
  specificYield: number;
}> {
  const projection: Array<{
    year: number;
    cumulativeDegradation: number;
    performanceRatio: number;
    annualEGridKwh: number;
    specificYield: number;
  }> = [];
  
  for (let year = 1; year <= 25; year++) {
    const yearConfig = { ...config, operationYear: year };
    const result = calculatePVsystLossChain(dailyGHI, capacityKwp, ambientTemp, yearConfig);
    
    projection.push({
      year,
      cumulativeDegradation: result.cumulativeDegradation,
      performanceRatio: result.performanceRatio,
      annualEGridKwh: result.eGrid * 365,
      specificYield: result.specificYield,
    });
  }
  
  return projection;
}

// ============================================================================
// Loss Mode Types
// ============================================================================

export type LossCalculationMode = "simplified" | "pvsyst";

export interface LossCalculationConfig {
  mode: LossCalculationMode;
  pvsystConfig?: PVsystLossChainConfig;
  simplifiedEfficiency?: number; // 0-1 value for simplified mode
}
