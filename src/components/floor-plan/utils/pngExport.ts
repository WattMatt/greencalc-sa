/**
 * Production PNG Export with Legend Panel
 * 
 * Composites all PV layout layers onto a high-res canvas with a right-side
 * legend panel showing colour-coded keys, item counts, and project stats.
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
import { calculateTotalPVCapacity } from './geometry';

export interface PngExportData {
  backgroundCanvas: HTMLCanvasElement | null;
  drawingCanvas: HTMLCanvasElement | null;
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
  projectName?: string;
  layoutName?: string;
}

interface LegendEntry {
  color: string;
  label: string;
  value: string;
}

function computeStats(data: PngExportData): LegendEntry[] {
  const entries: LegendEntry[] = [];

  // Roof masks
  if (data.roofMasks.length > 0) {
    const totalArea = data.roofMasks.reduce((sum, m) => sum + (m.area || 0), 0);
    entries.push({
      color: 'rgba(255, 165, 0, 0.5)',
      label: 'Roof Areas',
      value: totalArea > 0 ? `${data.roofMasks.length} (${totalArea.toFixed(0)} m²)` : `${data.roofMasks.length}`,
    });
  }

  // PV Panels
  if (data.pvArrays.length > 0 && data.pvPanelConfig) {
    const { panelCount: totalPanels, capacityKwp } = calculateTotalPVCapacity(data.pvArrays, data.pvPanelConfig!);
    entries.push({
      color: '#3b82f6',
      label: 'PV Modules',
      value: `${totalPanels} (${capacityKwp.toFixed(1)} kWp)`,
    });
  }

  // Inverters
  const inverters = data.equipment.filter(e => e.type === EquipmentType.INVERTER);
  if (inverters.length > 0) {
    entries.push({ color: '#f59e0b', label: 'Inverters', value: `${inverters.length}` });
  }

  // Main Boards
  const mainBoards = data.equipment.filter(e => e.type === EquipmentType.MAIN_BOARD);
  if (mainBoards.length > 0) {
    entries.push({ color: '#ef4444', label: 'Main Boards', value: `${mainBoards.length}` });
  }

  // DC Combiners
  const dcCombiners = data.equipment.filter(e => e.type === EquipmentType.DC_COMBINER);
  if (dcCombiners.length > 0) {
    entries.push({ color: '#8b5cf6', label: 'DC Combiners', value: `${dcCombiners.length}` });
  }

  // AC Disconnects
  const acDisconnects = data.equipment.filter(e => e.type === EquipmentType.AC_DISCONNECT);
  if (acDisconnects.length > 0) {
    entries.push({ color: '#06b6d4', label: 'AC Disconnects', value: `${acDisconnects.length}` });
  }

  // Walkways
  if (data.placedWalkways.length > 0) {
    const totalLength = data.placedWalkways.reduce((s, w) => s + w.length, 0);
    entries.push({
      color: '#a3a3a3',
      label: 'Walkways',
      value: `${totalLength.toFixed(0)} m`,
    });
  }

  // Cable Trays
  if (data.placedCableTrays.length > 0) {
    const totalLength = data.placedCableTrays.reduce((s, t) => s + t.length, 0);
    entries.push({
      color: '#78716c',
      label: 'Cable Trays',
      value: `${totalLength.toFixed(0)} m`,
    });
  }

  // DC Cables
  const dcLines = data.lines.filter(l => l.type === 'dc');
  if (dcLines.length > 0) {
    const totalLength = dcLines.reduce((s, l) => s + (l.length || 0), 0);
    entries.push({
      color: '#ef4444',
      label: 'DC Cables',
      value: `${dcLines.length} runs (${totalLength.toFixed(0)} m)`,
    });
  }

  // AC Cables
  const acLines = data.lines.filter(l => l.type === 'ac');
  if (acLines.length > 0) {
    const totalLength = acLines.reduce((s, l) => s + (l.length || 0), 0);
    entries.push({
      color: '#22c55e',
      label: 'AC Cables',
      value: `${acLines.length} runs (${totalLength.toFixed(0)} m)`,
    });
  }

  return entries;
}

export function exportProductionPNG(data: PngExportData): HTMLCanvasElement {
  const scale = 2; // 2× for high-res
  const legendWidth = 320 * scale;
  const padding = 20 * scale;
  const layoutW = data.width * scale;
  const layoutH = data.height * scale;
  const totalW = layoutW + legendWidth;
  const totalH = Math.max(layoutH, 600 * scale);

  const canvas = document.createElement('canvas');
  canvas.width = totalW;
  canvas.height = totalH;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, totalW, totalH);

  // Draw layout area -------------------------------------------------------
  // Composite background + all layers onto layout area
  const layoutCanvas = document.createElement('canvas');
  layoutCanvas.width = data.width;
  layoutCanvas.height = data.height;
  const lCtx = layoutCanvas.getContext('2d')!;

  // Background image
  if (data.backgroundCanvas) {
    lCtx.drawImage(data.backgroundCanvas, 0, 0, data.width, data.height);
  }

  // Roof masks
  for (const mask of data.roofMasks) {
    drawRoofMask(lCtx, mask, 1, false);
  }

  // Walkways
  for (const w of data.placedWalkways) {
    drawWalkway(lCtx, w, false, false, 1, data.scaleInfo);
  }

  // Cable trays
  for (const t of data.placedCableTrays) {
    drawCableTray(lCtx, t, false, false, 1, data.scaleInfo);
  }

  // PV arrays
  if (data.pvPanelConfig) {
    for (const arr of data.pvArrays) {
      drawPvArray(lCtx, arr, false, data.pvPanelConfig, data.scaleInfo, data.roofMasks, 1, false);
    }
  }

  // Cables
  for (const line of data.lines) {
    drawSupplyLine(lCtx, line, 1, false);
  }

  // Equipment
  for (const item of data.equipment) {
    drawEquipmentIcon(lCtx, item, false, 1, data.scaleInfo, data.plantSetupConfig);
  }

  // Draw composite onto export canvas (scaled)
  ctx.drawImage(layoutCanvas, 0, 0, data.width, data.height, 0, 0, layoutW, layoutH);

  // Border around layout
  ctx.strokeStyle = '#d4d4d4';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, layoutW, layoutH);

  // Draw legend panel ------------------------------------------------------
  const lx = layoutW; // legend x origin
  ctx.fillStyle = '#fafafa';
  ctx.fillRect(lx, 0, legendWidth, totalH);
  ctx.strokeStyle = '#e5e5e5';
  ctx.lineWidth = 2;
  ctx.strokeRect(lx, 0, legendWidth, totalH);

  let y = padding;
  const textX = lx + padding;
  const swatchSize = 16 * scale;
  const lineHeight = 28 * scale;

  // Title
  ctx.fillStyle = '#171717';
  ctx.font = `bold ${16 * scale}px sans-serif`;
  const projectTitle = data.projectName || 'PV Layout';
  ctx.fillText(projectTitle, textX, y + 16 * scale);
  y += 24 * scale;

  if (data.layoutName) {
    ctx.fillStyle = '#525252';
    ctx.font = `${12 * scale}px sans-serif`;
    ctx.fillText(data.layoutName, textX, y + 12 * scale);
    y += 20 * scale;
  }

  // Date
  ctx.fillStyle = '#737373';
  ctx.font = `${10 * scale}px sans-serif`;
  ctx.fillText(new Date().toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' }), textX, y + 10 * scale);
  y += 24 * scale;

  // Divider
  ctx.strokeStyle = '#d4d4d4';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(textX, y);
  ctx.lineTo(lx + legendWidth - padding, y);
  ctx.stroke();
  y += 16 * scale;

  // Legend heading
  ctx.fillStyle = '#171717';
  ctx.font = `bold ${13 * scale}px sans-serif`;
  ctx.fillText('LEGEND', textX, y + 13 * scale);
  y += 24 * scale;

  // Legend entries
  const entries = computeStats(data);
  ctx.font = `${11 * scale}px sans-serif`;

  for (const entry of entries) {
    // Colour swatch
    ctx.fillStyle = entry.color;
    ctx.fillRect(textX, y, swatchSize, swatchSize);
    ctx.strokeStyle = '#a3a3a3';
    ctx.lineWidth = 1;
    ctx.strokeRect(textX, y, swatchSize, swatchSize);

    // Label
    ctx.fillStyle = '#171717';
    ctx.fillText(entry.label, textX + swatchSize + 8 * scale, y + 12 * scale);

    // Value (right-aligned)
    const valueWidth = ctx.measureText(entry.value).width;
    ctx.fillStyle = '#525252';
    ctx.fillText(entry.value, lx + legendWidth - padding - valueWidth, y + 12 * scale);

    y += lineHeight;
  }

  // Scale info at bottom
  if (data.scaleInfo.ratio) {
    y = totalH - padding - 14 * scale;
    ctx.fillStyle = '#737373';
    ctx.font = `${10 * scale}px sans-serif`;
    ctx.fillText(`Scale: 1px = ${(data.scaleInfo.ratio * 1000).toFixed(1)} mm`, textX, y);
  }

  return canvas;
}

export function downloadCanvasAsPNG(canvas: HTMLCanvasElement, filename: string): boolean {
  const dataUrl = canvas.toDataURL('image/png');
  
  // Try window.open for sandboxed iframes
  const newWindow = window.open('', '_blank');
  if (newWindow) {
    newWindow.document.write(`
      <!DOCTYPE html>
      <html><head><title>${filename}</title></head>
      <body style="margin:0;background:#1a1a1a;display:flex;justify-content:center;align-items:flex-start;min-height:100vh;">
        <img src="${dataUrl}" style="max-width:100%;height:auto;" />
      </body></html>
    `);
    newWindow.document.close();
    return true;
  }

  // Fallback: anchor download
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  return true;
}
