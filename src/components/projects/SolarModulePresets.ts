// Solar Module Presets - Common solar modules with specifications
// Used for accurate collector area and module count calculations

export interface SolarModulePreset {
  id: string;
  name: string;
  manufacturer: string;
  power_wp: number;       // Maximum power in Wp
  width_m: number;        // Module width in meters
  length_m: number;       // Module length in meters
  efficiency: number;     // Nameplate efficiency (e.g., 21.1 for 21.1%)
  temp_coefficient: number; // Power temperature coefficient (%/°C), typically negative
}

// Common solar modules available in the South African market
export const SOLAR_MODULE_PRESETS: SolarModulePreset[] = [
  {
    id: "ja_545",
    name: "JA Solar 545W Bifacial",
    manufacturer: "JA Solar",
    power_wp: 545,
    width_m: 1.134,
    length_m: 2.278,
    efficiency: 21.1,
    temp_coefficient: -0.35,
  },
  {
    id: "longi_550",
    name: "LONGi 550W Hi-MO 5",
    manufacturer: "LONGi",
    power_wp: 550,
    width_m: 1.134,
    length_m: 2.278,
    efficiency: 21.3,
    temp_coefficient: -0.34,
  },
  {
    id: "canadian_545",
    name: "Canadian Solar 545W BiHiKu",
    manufacturer: "Canadian Solar",
    power_wp: 545,
    width_m: 1.134,
    length_m: 2.278,
    efficiency: 21.1,
    temp_coefficient: -0.36,
  },
  {
    id: "trina_550",
    name: "Trina Solar 550W Vertex",
    manufacturer: "Trina Solar",
    power_wp: 550,
    width_m: 1.134,
    length_m: 2.278,
    efficiency: 21.3,
    temp_coefficient: -0.34,
  },
  {
    id: "jinko_545",
    name: "Jinko 545W Tiger Neo",
    manufacturer: "Jinko",
    power_wp: 545,
    width_m: 1.134,
    length_m: 2.278,
    efficiency: 21.1,
    temp_coefficient: -0.35,
  },
  {
    id: "suntech_450",
    name: "Suntech 450W",
    manufacturer: "Suntech",
    power_wp: 450,
    width_m: 1.038,
    length_m: 2.094,
    efficiency: 20.7,
    temp_coefficient: -0.37,
  },
  {
    id: "ja_410",
    name: "JA Solar 410W Mono",
    manufacturer: "JA Solar",
    power_wp: 410,
    width_m: 1.052,
    length_m: 1.722,
    efficiency: 20.7,
    temp_coefficient: -0.35,
  },
  {
    id: "longi_455",
    name: "LONGi 455W Hi-MO 4",
    manufacturer: "LONGi",
    power_wp: 455,
    width_m: 1.038,
    length_m: 2.094,
    efficiency: 20.9,
    temp_coefficient: -0.34,
  },
  {
    id: "custom",
    name: "Custom Module",
    manufacturer: "Custom",
    power_wp: 450,
    width_m: 1.038,
    length_m: 2.094,
    efficiency: 21.49,
    temp_coefficient: -0.40,
  },
];

/**
 * Get the default module preset
 */
export function getDefaultModulePreset(): SolarModulePreset {
  return SOLAR_MODULE_PRESETS.find(m => m.id === "ja_545") || SOLAR_MODULE_PRESETS[0];
}

/**
 * Find a module preset by ID
 */
export function getModulePresetById(id: string): SolarModulePreset | undefined {
  return SOLAR_MODULE_PRESETS.find(m => m.id === id);
}

/**
 * Calculate the area of a single module in m²
 */
export function calculateModuleArea(module: SolarModulePreset): number {
  return module.width_m * module.length_m;
}

/**
 * Calculate the number of modules needed for a given DC capacity
 * @param dcCapacityKwp DC capacity in kWp
 * @param modulePowerWp Module power in Wp
 * @returns Number of modules (rounded up)
 */
export function calculateModuleCount(dcCapacityKwp: number, modulePowerWp: number): number {
  if (modulePowerWp <= 0) return 0;
  return Math.ceil((dcCapacityKwp * 1000) / modulePowerWp);
}

/**
 * Calculate the actual DC capacity based on module count
 * @param moduleCount Number of modules
 * @param modulePowerWp Module power in Wp
 * @returns Actual DC capacity in kWp
 */
export function calculateActualDcCapacity(moduleCount: number, modulePowerWp: number): number {
  return (moduleCount * modulePowerWp) / 1000;
}

/**
 * Calculate total collector area from module count and dimensions
 * @param moduleCount Number of modules
 * @param moduleWidth Module width in meters
 * @param moduleLength Module length in meters
 * @returns Total collector area in m²
 */
export function calculateCollectorArea(
  moduleCount: number,
  moduleWidth: number,
  moduleLength: number
): number {
  return moduleCount * moduleWidth * moduleLength;
}

/**
 * Calculate all module-related metrics
 * @param acCapacityKw AC system size in kW
 * @param dcAcRatio DC/AC ratio
 * @param module Selected module preset
 * @returns Object with all calculated metrics
 */
export function calculateModuleMetrics(
  acCapacityKw: number,
  dcAcRatio: number,
  module: SolarModulePreset
): {
  dcCapacityKwp: number;
  moduleCount: number;
  actualDcCapacityKwp: number;
  moduleAreaM2: number;
  collectorAreaM2: number;
  stcEfficiency: number;
} {
  const dcCapacityKwp = acCapacityKw * dcAcRatio;
  const moduleCount = calculateModuleCount(dcCapacityKwp, module.power_wp);
  const actualDcCapacityKwp = calculateActualDcCapacity(moduleCount, module.power_wp);
  const moduleAreaM2 = calculateModuleArea(module);
  const collectorAreaM2 = calculateCollectorArea(moduleCount, module.width_m, module.length_m);
  const stcEfficiency = module.efficiency / 100;

  return {
    dcCapacityKwp,
    moduleCount,
    actualDcCapacityKwp,
    moduleAreaM2,
    collectorAreaM2,
    stcEfficiency,
  };
}
