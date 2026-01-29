// PV-focused Floor Plan Markup Types

export interface Point {
  x: number;
  y: number;
}

export interface ViewState {
  zoom: number;
  offset: Point;
}

export interface ScaleInfo {
  pixelDistance: number | null;
  realDistance: number | null;
  ratio: number | null; // meters per pixel
}

export interface PVPanelConfig {
  width: number;  // in meters
  length: number; // in meters
  wattage: number; // in watts peak
}

export interface RoofMask {
  id: string;
  points: Point[];
  pitch: number;    // in degrees
  direction: number; // azimuth in degrees (0=North, 90=East, 180=South, 270=West)
  area?: number;    // in square meters
}

export type PanelOrientation = 'portrait' | 'landscape';

export interface PVArrayItem {
  id: string;
  position: Point;
  rows: number;
  columns: number;
  orientation: PanelOrientation;
  rotation: number; // in degrees
  roofMaskId?: string;
  minSpacing?: number; // meters - spacing used when placing this array
}

export interface SupplyLine {
  id: string;
  name: string;
  type: 'dc' | 'ac';
  points: Point[];
  length: number;
  from?: string;
  to?: string;
}

export enum EquipmentType {
  INVERTER = 'Inverter',
  DC_COMBINER = 'DC Combiner Box',
  AC_DISCONNECT = 'AC Disconnect',
  MAIN_BOARD = 'Main Board',
  SUB_BOARD = 'Sub Board',
}

export interface EquipmentItem {
  id: string;
  type: EquipmentType;
  position: Point;
  rotation: number;
  name?: string;
}

export enum Tool {
  SELECT = 'select',
  PAN = 'pan',
  SCALE = 'scale',
  LINE_DC = 'line_dc',
  LINE_AC = 'line_ac',
  ROOF_MASK = 'roof_mask',
  ROOF_DIRECTION = 'roof_direction',
  PV_ARRAY = 'pv_array',
  COPY_ROOF_MASK = 'copy_roof_mask',
  COPY_PV_ARRAY = 'copy_pv_array',
  PLACE_INVERTER = 'place_inverter',
  PLACE_DC_COMBINER = 'place_dc_combiner',
  PLACE_AC_DISCONNECT = 'place_ac_disconnect',
  PLACE_MAIN_BOARD = 'place_main_board',
}

export interface DesignState {
  equipment: EquipmentItem[];
  lines: SupplyLine[];
  roofMasks: RoofMask[];
  pvArrays: PVArrayItem[];
}

export const initialDesignState: DesignState = {
  equipment: [],
  lines: [],
  roofMasks: [],
  pvArrays: [],
};

// Plant Setup Configuration Types
export interface SolarModuleConfig {
  id: string;
  name: string;
  width: number;      // meters
  length: number;     // meters
  wattage: number;    // Wp
  isDefault?: boolean;
}

export interface InverterLayoutConfig {
  id: string;
  name: string;
  acCapacity: number; // kW
  count: number;
  isDefault?: boolean;
}

export interface WalkwayConfig {
  id: string;
  name: string;
  width: number;      // meters (default 0.6m)
  length: number;     // meters
}

export interface CableTrayConfig {
  id: string;
  name: string;
  width: number;      // meters (default 0.3m)
  length: number;     // meters
}

export interface PlantSetupConfig {
  solarModules: SolarModuleConfig[];
  inverters: InverterLayoutConfig[];
  walkways: WalkwayConfig[];
  cableTrays: CableTrayConfig[];
}

export const defaultPlantSetupConfig: PlantSetupConfig = {
  solarModules: [],
  inverters: [],
  walkways: [{ id: 'default-walkway', name: 'Standard', width: 0.6, length: 10 }],
  cableTrays: [{ id: 'default-tray', name: 'Standard', width: 0.3, length: 10 }],
};
