import { EquipmentType } from './types';

export const TOOL_COLORS = {
  LINE_DC: '#f97316', // Orange for DC
  LINE_AC: '#4d4dff', // Blue for AC
  SCALE: '#39e600',   // Green for scale
  ROOF_MASK: 'rgba(148, 112, 216, 0.3)', // Purple for roof masks
  ROOF_MASK_STROKE: '#9470d8',
};

// Defines the approximate real-world size (diameter/width) of equipment in meters.
export const EQUIPMENT_REAL_WORLD_SIZES: Record<EquipmentType, number> = {
  [EquipmentType.INVERTER]: 0.7,
  [EquipmentType.DC_COMBINER]: 0.4,
  [EquipmentType.AC_DISCONNECT]: 0.3,
  [EquipmentType.MAIN_BOARD]: 1.2,
  [EquipmentType.SUB_BOARD]: 0.8,
};

export const DEFAULT_PV_PANEL_CONFIG = {
  width: 1.134,  // Standard panel width in meters
  length: 2.278, // Standard panel length in meters
  wattage: 550,  // Watts peak
};

export const DIRECTION_LABELS: Record<number, string> = {
  0: 'N',
  45: 'NE',
  90: 'E',
  135: 'SE',
  180: 'S',
  225: 'SW',
  270: 'W',
  315: 'NW',
};

export const getDirectionLabel = (degrees: number): string => {
  // Normalize to 0-360
  const normalized = ((degrees % 360) + 360) % 360;
  // Find closest cardinal/ordinal direction
  const directions = [0, 45, 90, 135, 180, 225, 270, 315];
  const closest = directions.reduce((prev, curr) => 
    Math.abs(curr - normalized) < Math.abs(prev - normalized) ? curr : prev
  );
  return DIRECTION_LABELS[closest] || `${Math.round(normalized)}°`;
};
