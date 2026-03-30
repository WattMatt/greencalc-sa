/**
 * Layered SVG Export Utility
 * 
 * Renders each PV layout layer to its own offscreen canvas, then assembles them
 * as named <g> groups in a single SVG file. This allows draughting personnel to
 * toggle, reorder, or isolate layers in Inkscape, Illustrator, or AutoCAD.
 */

import { 
  PVArrayItem, PVPanelConfig, RoofMask, ScaleInfo, 
  EquipmentItem, SupplyLine, EquipmentType, PlantSetupConfig,
  PlacedWalkway, PlacedCableTray
} from '../types';
import { 
  drawRoofMask, drawPvArray, drawSupplyLine, drawEquipmentIcon, 
  drawWalkway, drawCableTray 
} from './drawing';

export interface LayeredExportData {
  backgroundCanvas: HTMLCanvasElement | null;
  width: number;
  height: number;
  roofMasks: RoofMask[];
  pvArrays: PVArrayItem[];
  pvPanelConfig: PVPanelConfig | null;
  equipment: EquipmentItem[];
  lines: SupplyLine[];
  placedWalkways: PlacedWalkway[];
  placedCableTrays: PlacedCableTray[];
  scaleInfo: ScaleInfo;
  plantSetupConfig?: PlantSetupConfig;
}

interface LayerDef {
  id: string;
  label: string;
  render: (ctx: CanvasRenderingContext2D, zoom: number) => void;
}

function createOffscreenCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  return { canvas, ctx };
}

export function exportLayeredSVG(data: LayeredExportData): string {
  const { width, height } = data;
  const zoom = 1; // Export at 1:1

  // Define each layer and its rendering function
  const layers: LayerDef[] = [];

  // 1. Background (floor plan / satellite image)
  if (data.backgroundCanvas) {
    layers.push({
      id: 'background',
      label: 'Background - Floor Plan',
      render: (ctx) => {
        ctx.drawImage(data.backgroundCanvas!, 0, 0, width, height);
      },
    });
  }

  // 2. Roof Masks
  if (data.roofMasks.length > 0) {
    layers.push({
      id: 'roof-masks',
      label: 'Roof Masks',
      render: (ctx) => {
        for (const mask of data.roofMasks) {
          drawRoofMask(ctx, mask, zoom, false);
        }
      },
    });
  }

  // 3. Walkways
  if (data.placedWalkways.length > 0) {
    layers.push({
      id: 'walkways',
      label: 'Walkways',
      render: (ctx) => {
        for (const walkway of data.placedWalkways) {
          drawWalkway(ctx, walkway, false, false, zoom, data.scaleInfo);
        }
      },
    });
  }

  // 4. Cable Trays (Trunking)
  if (data.placedCableTrays.length > 0) {
    layers.push({
      id: 'cable-trays',
      label: 'Cable Trays / Trunking',
      render: (ctx) => {
        for (const tray of data.placedCableTrays) {
          drawCableTray(ctx, tray, false, false, zoom, data.scaleInfo);
        }
      },
    });
  }

  // 5. PV Panels / Arrays
  if (data.pvArrays.length > 0 && data.pvPanelConfig) {
    layers.push({
      id: 'pv-panels',
      label: 'PV Panels',
      render: (ctx) => {
        for (const array of data.pvArrays) {
          drawPvArray(ctx, array, false, data.pvPanelConfig!, data.scaleInfo, data.roofMasks, zoom, false);
        }
      },
    });
  }

  // 6. DC Cables (Strings)
  const dcLines = data.lines.filter(l => l.type === 'dc');
  if (dcLines.length > 0) {
    layers.push({
      id: 'dc-cables',
      label: 'DC Cables / Strings',
      render: (ctx) => {
        for (const line of dcLines) {
          drawSupplyLine(ctx, line, zoom, false);
        }
      },
    });
  }

  // 7. AC Cables
  const acLines = data.lines.filter(l => l.type === 'ac');
  if (acLines.length > 0) {
    layers.push({
      id: 'ac-cables',
      label: 'AC Cables',
      render: (ctx) => {
        for (const line of acLines) {
          drawSupplyLine(ctx, line, zoom, false);
        }
      },
    });
  }

  // 8. Inverters
  const inverters = data.equipment.filter(e => e.type === EquipmentType.INVERTER);
  if (inverters.length > 0) {
    layers.push({
      id: 'inverters',
      label: 'Inverters',
      render: (ctx) => {
        for (const item of inverters) {
          drawEquipmentIcon(ctx, item, false, zoom, data.scaleInfo, data.plantSetupConfig);
        }
      },
    });
  }

  // 9. Distribution Equipment (DB, Combiner, Disconnect)
  const distEquip = data.equipment.filter(e => 
    e.type === EquipmentType.MAIN_BOARD || 
    e.type === EquipmentType.SUB_BOARD || 
    e.type === EquipmentType.DC_COMBINER || 
    e.type === EquipmentType.AC_DISCONNECT
  );
  if (distEquip.length > 0) {
    layers.push({
      id: 'distribution',
      label: 'Distribution Boards & Equipment',
      render: (ctx) => {
        for (const item of distEquip) {
          drawEquipmentIcon(ctx, item, false, zoom, data.scaleInfo, data.plantSetupConfig);
        }
      },
    });
  }

  // Render each layer to its own canvas and collect data URLs
  const layerImages: Array<{ id: string; label: string; dataUrl: string }> = [];
  
  for (const layer of layers) {
    const { canvas, ctx } = createOffscreenCanvas(width, height);
    layer.render(ctx, zoom);
    layerImages.push({
      id: layer.id,
      label: layer.label,
      dataUrl: canvas.toDataURL('image/png'),
    });
  }

  // XML-escape helper for attribute values
  const escXml = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Assemble SVG with named groups (Inkscape/Illustrator layer format)
  const layerGroups = layerImages.map(l => 
    `  <g id="${escXml(l.id)}" inkscape:groupmode="layer" inkscape:label="${escXml(l.label)}" style="display:inline">
    <image width="${width}" height="${height}" href="${l.dataUrl}" />
  </g>`
  ).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" 
     xmlns:xlink="http://www.w3.org/1999/xlink"
     xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
     width="${width}" height="${height}" 
     viewBox="0 0 ${width} ${height}">
  <title>PV Layout - Layered Export</title>
  <desc>Layers: ${escXml(layerImages.map(l => l.label).join(', '))}</desc>
${layerGroups}
</svg>`;
}
