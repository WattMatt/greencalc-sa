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
  moduleConfigId?: string; // Reference to SolarModuleConfig template
}

export interface SupplyLine {
  id: string;
  name: string;
  type: 'dc' | 'ac';
  points: Point[];
  length: number;
  from?: string;
  to?: string;
  thickness?: number; // Cable thickness in mm (e.g., 6, 10, 16, 25)
  configId?: string; // Reference to DCCableConfig or ACCableConfig template
  material?: CableMaterial; // Cable material (copper or aluminum)
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
  configId?: string; // Reference to InverterLayoutConfig (for Inverters)
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
  PLACE_INVERTER = 'place_inverter',
  PLACE_DC_COMBINER = 'place_dc_combiner',
  PLACE_AC_DISCONNECT = 'place_ac_disconnect',
  PLACE_MAIN_BOARD = 'place_main_board',
  PLACE_WALKWAY = 'place_walkway',
  PLACE_CABLE_TRAY = 'place_cable_tray',
  DIMENSION = 'dimension', // Set distance between two objects
  ALIGN_EDGES = 'align_edges', // Align edges of two objects
}

// Placed instance of a walkway on the canvas/project
export interface PlacedWalkway {
  id: string;
  configId: string;  // Reference to WalkwayConfig template
  name: string;
  width: number;     // meters
  length: number;    // meters (specific to this placement)
  position: Point;   // Canvas position (required for placed items)
  rotation: number;  // Rotation in degrees
  minSpacing?: number; // Minimum spacing in meters
}

// Cable tray type designation (AC or DC)
export type CableTrayType = 'ac' | 'dc';

// Placed instance of a cable tray on the canvas/project
export interface PlacedCableTray {
  id: string;
  configId: string;  // Reference to CableTrayConfig template
  name: string;
  width: number;     // meters
  length: number;    // meters (specific to this placement)
  position: Point;   // Canvas position (required for placed items)
  rotation: number;  // Rotation in degrees
  minSpacing?: number; // Minimum spacing in meters
  cableType?: CableTrayType; // Designates AC or DC cable tray for snapping
}

export interface DesignState {
  equipment: EquipmentItem[];
  lines: SupplyLine[];
  roofMasks: RoofMask[];
  pvArrays: PVArrayItem[];
  placedWalkways: PlacedWalkway[];
  placedCableTrays: PlacedCableTray[];
}

export const initialDesignState: DesignState = {
  equipment: [],
  lines: [],
  roofMasks: [],
  pvArrays: [],
  placedWalkways: [],
  placedCableTrays: [],
};

// Batch placement configuration for multi-copy
export interface BatchPVArrayConfig {
  items: Array<{
    offset: Point; // Relative to group center
    config: {
      rows: number;
      columns: number;
      orientation: PanelOrientation;
      minSpacing?: number;
    };
    rotation: number;
  }>;
}

export interface BatchMaterialConfig {
  items: Array<{
    offset: Point;
    rotation: number;
    minSpacing: number;
    configId: string;
    width: number;
    length: number;
    name: string;
  }>;
}

export interface BatchEquipmentConfig {
  items: Array<{
    offset: Point;
    rotation: number;
    type: EquipmentType;
  }>;
}

// Item types in batch placement
export type BatchPlacementItemType = 'pvArray' | 'equipment' | 'walkway' | 'cableTray';

// Individual item in a mixed batch placement
export interface BatchPlacementItem {
  id: string; // Temporary ID for reference
  type: BatchPlacementItemType;
  offset: Point; // Relative to batch center
  rotation: number;
  // Type-specific data
  pvArrayConfig?: {
    rows: number;
    columns: number;
    orientation: PanelOrientation;
    minSpacing?: number;
    roofMaskId?: string;
  };
  equipmentConfig?: {
    equipmentType: EquipmentType;
    name?: string;
  };
  walkwayConfig?: {
    configId: string;
    name: string;
    width: number;
    length: number;
    minSpacing?: number;
  };
  cableTrayConfig?: {
    configId: string;
    name: string;
    width: number;
    length: number;
    minSpacing?: number;
  };
}

// Unified batch placement configuration for multi-copy of mixed types
export interface BatchPlacementConfig {
  items: BatchPlacementItem[];
  groupCenter: Point; // Original group center for reference
}

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
  width?: number;     // meters (for layout sizing)
  height?: number;    // meters (for layout sizing)
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

// Cable material options
export type CableMaterial = 'copper' | 'aluminum';

export interface DCCableConfig {
  id: string;
  name: string;
  diameter: number;   // mm (e.g., 4, 6, 10, 16)
  material: CableMaterial;
  isDefault?: boolean;
}

export interface ACCableConfig {
  id: string;
  name: string;
  diameter: number;   // mm (e.g., 16, 25, 35, 50, 70, 95)
  material: CableMaterial;
  isDefault?: boolean;
}

export interface PlantSetupConfig {
  solarModules: SolarModuleConfig[];
  inverters: InverterLayoutConfig[];
  walkways: WalkwayConfig[];           // Templates
  cableTrays: CableTrayConfig[];       // Templates
  dcCables: DCCableConfig[];           // DC cable templates
  acCables: ACCableConfig[];           // AC cable templates
  placedWalkways?: PlacedWalkway[];    // Actual placed instances
  placedCableTrays?: PlacedCableTray[]; // Actual placed instances
}

export const defaultPlantSetupConfig: PlantSetupConfig = {
  solarModules: [],
  inverters: [],
  walkways: [],
  cableTrays: [],
  dcCables: [],
  acCables: [],
};

// Subgroup visibility for walkways, cable trays, and cables by configId/thickness
export interface SubgroupVisibility {
  walkwaySubgroups: Record<string, boolean>;
  cableTraySubgroups: Record<string, boolean>;
  dcCableThicknesses: Record<number, boolean>; // Visibility by thickness in mm
  acCableThicknesses: Record<number, boolean>; // Visibility by thickness in mm
}

export const defaultSubgroupVisibility: SubgroupVisibility = {
  walkwaySubgroups: {},
  cableTraySubgroups: {},
  dcCableThicknesses: {},
  acCableThicknesses: {},
};

// Layer visibility state for canvas rendering
export interface LayerVisibility {
  roofMasks: boolean;
  pvArrays: boolean;
  equipment: boolean;      // Generic equipment (DC Combiner, AC Disconnect, Sub Board)
  mainBoards: boolean;     // Separate visibility for Main Boards
  inverters: boolean;      // Separate visibility for Inverters
  walkways: boolean;
  cableTrays: boolean;
  cables: boolean;
}

export const defaultLayerVisibility: LayerVisibility = {
  roofMasks: true,
  pvArrays: true,
  equipment: true,
  mainBoards: true,
  inverters: true,
  walkways: true,
  cableTrays: true,
  cables: true,
};

// Per-item visibility - tracks individual items that are hidden
// When an item's ID maps to false, it's hidden; true or undefined means visible
export type ItemVisibility = Record<string, boolean>;
