// PVsyst-style loss chain calculation module
// Matches the detailed methodology from industry-standard PVsyst simulations

// ============================================================================
// Loss Chain Interfaces
// ============================================================================

export interface IrradianceLosses {
  nearShadingLoss: number;    // Near Shadings: irradiance loss (e.g., 0.94)
  iamLoss: number;            // IAM factor on global (e.g., 2.57)
  soilingLoss: number;        // Soiling loss factor (e.g., 3.00)
  spectralLoss: number;       // Spectral correction (e.g., 1.05)
  electricalShadingLoss: number; // Shadings: Electrical Loss detailed module calc (e.g., 0.23)
}

export interface ArrayLosses {
  irradianceLevelLoss: number;  // PV loss due to irradiance level (e.g., 0.80)
  temperatureLoss: number;      // PV loss due to temperature (e.g., 8.00)
  moduleQualityLoss: number;    // Module quality loss (e.g., 0.50)
  lidLoss: number;              // Light-Induced Degradation first year (e.g., 2.00)
  annualDegradation: number;    // % per year (e.g., 0.50)
  mismatchLoss: number;         // Module mismatch incl. degradation dispersion (e.g., 3.68)
  ohmicLoss: number;            // DC wiring losses (e.g., 1.10)
}

export interface InverterLosses {
  operationEfficiency: number;     // Inverter Loss during operation (efficiency)
  overNominalPower: number;        // Inverter Loss over nominal inv. power
  maxInputCurrent: number;         // Inverter Loss due to max. input current
  overNominalVoltage: number;      // Inverter Loss over nominal inv. voltage
  powerThreshold: number;          // Inverter Loss due to power threshold
  voltageThreshold: number;        // Inverter Loss due to voltage threshold
  nightConsumption: number;        // Night consumption
}

export interface SystemLosses {
  inverter: InverterLosses;   // Detailed inverter losses
}

export interface LossesAfterInverter {
  availabilityLoss: number;   // System unavailability / Downtime (e.g., 1.76)
}

export interface PVsystLossChainConfig {
  irradiance: IrradianceLosses;
  array: ArrayLosses;
  system: SystemLosses;
  lossesAfterInverter: LossesAfterInverter;
  operationYear: number;       // Year of operation (1-25) for degradation
  transpositionFactor: number; // POA gain from tilted surface (e.g., 1.08)
  stcEfficiency: number;       // Module STC efficiency (e.g., 0.2149 for 21.49%)
  collectorAreaM2?: number;    // Optional: actual physical collector area from module dimensions
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
    nearShadingLoss: 0.9400,       // Near Shadings: irradiance loss
    iamLoss: 2.5700,               // IAM factor on global
    soilingLoss: 3.0000,           // Soiling loss factor
    spectralLoss: 1.0500,          // Spectral correction
    electricalShadingLoss: 0.2300, // Shadings: Electrical Loss detailed module calc
  },
  array: {
    irradianceLevelLoss: 0.4170,   // PV loss due to irradiance level
    temperatureLoss: 4.9160,       // PV loss due to temperature
    moduleQualityLoss: -0.7500,    // Module quality loss (gain)
    lidLoss: 2.0000,               // LID - Light induced degradation
    annualDegradation: 0.2000,     // For cumulative calculation (3.80% at year 10 = 2% LID + 9*0.2%)
    mismatchLoss: 3.3960,          // Including 1.4% for degradation dispersion
    ohmicLoss: 1.0610,             // Ohmic wiring loss
  },
  system: {
    inverter: {
      operationEfficiency: 1.5300,   // Inverter Loss during operation (efficiency)
      overNominalPower: 1.0370,      // Inverter Loss over nominal inv. power
      maxInputCurrent: 0.0000,       // Inverter Loss due to max. input current
      overNominalVoltage: 0.0000,    // Inverter Loss over nominal inv. voltage
      powerThreshold: 0.0040,        // Inverter Loss due to power threshold
      voltageThreshold: 0.0010,      // Inverter Loss due to voltage threshold
      nightConsumption: 0.0090,      // Night consumption
    },
  },
  lossesAfterInverter: {
    availabilityLoss: 2.0710,      // System unavailability
  },
  operationYear: 10,               // Default to year 10 to match 3.80% degradation
  transpositionFactor: 1.0013,     // Global incident in coll. plane (0.13% gain)
  stcEfficiency: 0.2149,           // Module STC efficiency (21.49% for typical 450W panels)
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
  // ========================================
  // Step 1: Calculate Collector Area (PVsyst methodology)
  // Use provided area from module dimensions, OR calculate from capacity/efficiency
  // ========================================
  const collectorAreaM2 = config.collectorAreaM2 ?? (capacityKwp * 1000) / (config.stcEfficiency * 1000);
  
  // ========================================
  // Step 2: GHI to POA (transposition gain)
  // ========================================
  const poaIrradiance = dailyGHI * config.transpositionFactor;
  
  // ========================================
  // Step 3: Effective Irradiance (optical losses only - no spectral here)
  // ========================================
  const opticalFactor = 
    (1 - config.irradiance.nearShadingLoss / 100) *
    (1 - config.irradiance.iamLoss / 100) *
    (1 - config.irradiance.soilingLoss / 100);
  const effectiveIrradiance = poaIrradiance * opticalFactor;
  
  // ========================================
  // Step 4: Total Energy on Collectors (kWh)
  // ========================================
  const totalEnergyOnCollectors = effectiveIrradiance * collectorAreaM2;
  
  // ========================================
  // Step 5: Array Nominal at STC (EArrNom)
  // EArrNom = Total Energy × STC Efficiency
  // ========================================
  const arrayNominalSTC = totalEnergyOnCollectors * config.stcEfficiency;
  
  // Theoretical output at STC (reference for PR calculation)
  const theoreticalOutput = dailyGHI * capacityKwp;
  
  // ========================================
  // Step 6: Temperature Loss (from config)
  // ========================================
  const temperatureLoss = config.array.temperatureLoss;
  
  // ========================================
  // Step 7: Degradation (cumulative)
  // ========================================
  const cumulativeDegradation = calculateCumulativeDegradation(
    config.operationYear,
    config.array.lidLoss,
    config.array.annualDegradation
  );
  
  // ========================================
  // Step 8: Array at MPP (EArrMPP - after all array losses)
  // Apply losses sequentially from EArrNom
  // ========================================
  const arrayFactor = 
    (1 - cumulativeDegradation / 100) *
    (1 - config.array.irradianceLevelLoss / 100) *
    (1 - temperatureLoss / 100) *
    (1 - config.irradiance.spectralLoss / 100) *
    (1 - config.irradiance.electricalShadingLoss / 100) *
    (1 - config.array.moduleQualityLoss / 100) *
    (1 - config.array.mismatchLoss / 100) *
    (1 - config.array.ohmicLoss / 100);
  const arrayMPP = arrayNominalSTC * arrayFactor;
  
  // ========================================
  // Step 9: Inverter Output (EOutInv)
  // ========================================
  const totalInverterLoss = 
    config.system.inverter.operationEfficiency +
    config.system.inverter.overNominalPower +
    config.system.inverter.maxInputCurrent +
    config.system.inverter.overNominalVoltage +
    config.system.inverter.powerThreshold +
    config.system.inverter.voltageThreshold +
    config.system.inverter.nightConsumption;
  
  const inverterFactor = (1 - totalInverterLoss / 100);
  const eOutInv = arrayMPP * inverterFactor;
  
  // ========================================
  // Step 10: E_Grid (after system unavailability)
  // ========================================
  const systemFactor = (1 - config.lossesAfterInverter.availabilityLoss / 100);
  const eGrid = eOutInv * systemFactor;
  
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
    { stage: "Shading Electrical", lossPercent: config.irradiance.electricalShadingLoss, energyAfter: 0 },
    { stage: "Module Quality", lossPercent: config.array.moduleQualityLoss, energyAfter: 0 },
    { stage: "LID", lossPercent: config.array.lidLoss, energyAfter: 0 },
    { stage: "Mismatch", lossPercent: config.array.mismatchLoss, energyAfter: 0 },
    { stage: "Ohmic Wiring", lossPercent: config.array.ohmicLoss, energyAfter: arrayMPP },
    // System losses - Inverter sub-losses:
    { stage: "Inverter (Efficiency)", lossPercent: config.system.inverter.operationEfficiency, energyAfter: 0 },
    { stage: "Inverter (Over Nominal Power)", lossPercent: config.system.inverter.overNominalPower, energyAfter: 0 },
    { stage: "Inverter (Max Input Current)", lossPercent: config.system.inverter.maxInputCurrent, energyAfter: 0 },
    { stage: "Inverter (Over Nominal Voltage)", lossPercent: config.system.inverter.overNominalVoltage, energyAfter: 0 },
    { stage: "Inverter (Power Threshold)", lossPercent: config.system.inverter.powerThreshold, energyAfter: 0 },
    { stage: "Inverter (Voltage Threshold)", lossPercent: config.system.inverter.voltageThreshold, energyAfter: 0 },
    { stage: "Night Consumption", lossPercent: config.system.inverter.nightConsumption, energyAfter: eOutInv },
    // Losses after inverter:
    { stage: "System Unavailability", lossPercent: config.lossesAfterInverter.availabilityLoss, energyAfter: eGrid },
  ];
  
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
  
  // Calculate collector area once - use provided area OR calculate from capacity/efficiency
  const collectorAreaM2 = config.collectorAreaM2 ?? (capacityKwp * 1000) / (config.stcEfficiency * 1000);
  
  // Pre-calculate cumulative degradation (same for all hours)
  const cumulativeDegradation = calculateCumulativeDegradation(
    config.operationYear,
    config.array.lidLoss,
    config.array.annualDegradation
  );
  
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
    
    // Use configured temperature loss
    const tempLoss = config.array.temperatureLoss;
    const cellTemp = ambientTemp + 20; // Approximate cell temp for display
    
    // Step 1: Apply transposition factor
    const poaIrradiance = hourlyGhiKwhM2 * config.transpositionFactor;
    
    // Step 2: Apply optical losses (no spectral here - it's in array losses)
    const opticalFactor = 
      (1 - config.irradiance.nearShadingLoss / 100) *
      (1 - config.irradiance.iamLoss / 100) *
      (1 - config.irradiance.soilingLoss / 100);
    const effectiveIrradiance = poaIrradiance * opticalFactor;
    
    // Step 3: Total energy on collectors (kWh for this hour)
    const totalEnergyOnCollectors = effectiveIrradiance * collectorAreaM2;
    
    // Step 4: Array Nominal at STC (EArrNom)
    const arrayNominalSTC = totalEnergyOnCollectors * config.stcEfficiency;
    
    // Step 5: Apply array losses sequentially
    const arrayFactor =
      (1 - cumulativeDegradation / 100) *
      (1 - config.array.irradianceLevelLoss / 100) *
      (1 - tempLoss / 100) *
      (1 - config.irradiance.spectralLoss / 100) *
      (1 - config.irradiance.electricalShadingLoss / 100) *
      (1 - config.array.moduleQualityLoss / 100) *
      (1 - config.array.mismatchLoss / 100) *
      (1 - config.array.ohmicLoss / 100);
    const arrayMPP = arrayNominalSTC * arrayFactor;
    
    // Step 6: Calculate total inverter loss and apply
    const totalInverterLoss = 
      config.system.inverter.operationEfficiency +
      config.system.inverter.overNominalPower +
      config.system.inverter.maxInputCurrent +
      config.system.inverter.overNominalVoltage +
      config.system.inverter.powerThreshold +
      config.system.inverter.voltageThreshold +
      config.system.inverter.nightConsumption;
    const eOutInv = arrayMPP * (1 - totalInverterLoss / 100);
    
    // Step 7: Apply system unavailability
    const eGridKwh = eOutInv * (1 - config.lossesAfterInverter.availabilityLoss / 100);
    
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
