/**
 * Layered A0 Drawing Sheet Export (High-Res PNG)
 *
 * Renders each layer type into its own dedicated viewport so that
 * overlapping elements are clearly separated.  All viewports are
 * composited onto a single A0 landscape canvas with a legend card.
 *
 * Viewports:
 *  1. Background + Roof Masks
 *  2. PV Arrays
 *  3. Equipment (inverters, boards, combiners, disconnects)
 *  4. DC & AC Cables
 *  5. Walkways & Cable Trays
 *  6. Combined (all layers)
 */

import {
  PVArrayItem, PVPanelConfig, RoofMask, ScaleInfo,
  EquipmentItem, SupplyLine, EquipmentType, PlantSetupConfig,
  PlacedWalkway, PlacedCableTray,
} from '../types';
import {
  drawRoofMask, drawPvArray, drawSupplyLine, drawEquipmentIcon,
  drawWalkway, drawCableTray,
} from './drawing';
import { calculateTotalPVCapacity } from './geometry';

/* ------------------------------------------------------------------ */
/*  Public interface                                                    */
/* ------------------------------------------------------------------ */

export interface A0ExportData {
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

/* ------------------------------------------------------------------ */
/*  Legend types                                                        */
/* ------------------------------------------------------------------ */

interface LegendEntry {
  color: string;
  label: string;
  value: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                           */
/* ------------------------------------------------------------------ */

// A0 landscape at 150 DPI  ≈  7016 × 4961 px
const A0_W = 7016;
const A0_H = 4961;
const PAD = 80;
const LEGEND_W = 900;      // right-side legend card width
const TITLE_H = 140;       // bottom title strip height
const HEADER_H = 60;       // per-viewport header

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Render background at reduced opacity so layer content stands out. */
function drawFaintBackground(
  ctx: CanvasRenderingContext2D,
  bg: HTMLCanvasElement | null,
  w: number,
  h: number,
) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  if (bg) {
    ctx.globalAlpha = 0.25;
    ctx.drawImage(bg, 0, 0, w, h);
    ctx.globalAlpha = 1;
  }
}

function collectLegend(data: A0ExportData): LegendEntry[] {
  const entries: LegendEntry[] = [];

  if (data.roofMasks.length > 0) {
    const area = data.roofMasks.reduce((s, m) => s + (m.area || 0), 0);
    entries.push({ color: '#FFA500', label: 'Roof Areas', value: area > 0 ? `${data.roofMasks.length} (${area.toFixed(0)} m²)` : `${data.roofMasks.length}` });
  }

  if (data.pvArrays.length > 0 && data.pvPanelConfig) {
    const { panelCount, capacityKwp } = calculateTotalPVCapacity(data.pvArrays, data.pvPanelConfig);
    entries.push({ color: '#3B82F6', label: 'PV Modules', value: `${panelCount} (${capacityKwp.toFixed(1)} kWp)` });
  }

  const inv = data.equipment.filter(e => e.type === EquipmentType.INVERTER);
  if (inv.length) entries.push({ color: '#F59E0B', label: 'Inverters', value: `${inv.length}` });

  const mb = data.equipment.filter(e => e.type === EquipmentType.MAIN_BOARD);
  if (mb.length) entries.push({ color: '#EF4444', label: 'Main Boards', value: `${mb.length}` });

  const dc = data.equipment.filter(e => e.type === EquipmentType.DC_COMBINER);
  if (dc.length) entries.push({ color: '#8B5CF6', label: 'DC Combiners', value: `${dc.length}` });

  const acD = data.equipment.filter(e => e.type === EquipmentType.AC_DISCONNECT);
  if (acD.length) entries.push({ color: '#06B6D4', label: 'AC Disconnects', value: `${acD.length}` });

  if (data.placedWalkways.length > 0) {
    const len = data.placedWalkways.reduce((s, w) => s + w.length, 0);
    entries.push({ color: '#A3A3A3', label: 'Walkways', value: `${len.toFixed(0)} m` });
  }

  if (data.placedCableTrays.length > 0) {
    const len = data.placedCableTrays.reduce((s, t) => s + t.length, 0);
    entries.push({ color: '#78716C', label: 'Cable Trays', value: `${len.toFixed(0)} m` });
  }

  const dcLines = data.lines.filter(l => l.type === 'dc');
  if (dcLines.length) {
    const len = dcLines.reduce((s, l) => s + (l.length || 0), 0);
    entries.push({ color: '#EF4444', label: 'DC Cables', value: `${dcLines.length} runs (${len.toFixed(0)} m)` });
  }

  const acLines = data.lines.filter(l => l.type === 'ac');
  if (acLines.length) {
    const len = acLines.reduce((s, l) => s + (l.length || 0), 0);
    entries.push({ color: '#22C55E', label: 'AC Cables', value: `${acLines.length} runs (${len.toFixed(0)} m)` });
  }

  return entries;
}

/* ------------------------------------------------------------------ */
/*  Viewport renderers                                                  */
/* ------------------------------------------------------------------ */

interface ViewportDef {
  title: string;
  render: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
}

function buildViewports(data: A0ExportData): ViewportDef[] {
  const bg = data.backgroundCanvas;
  const views: ViewportDef[] = [];

  // 1 — Roof Masks
  if (data.roofMasks.length > 0) {
    views.push({
      title: '1. ROOF AREAS',
      render(ctx, w, h) {
        drawFaintBackground(ctx, bg, w, h);
        for (const mask of data.roofMasks) drawRoofMask(ctx, mask, 1, false);
      },
    });
  }

  // 2 — PV Arrays
  if (data.pvArrays.length > 0 && data.pvPanelConfig) {
    const cfg = data.pvPanelConfig;
    const si = data.scaleInfo;
    const masks = data.roofMasks;
    views.push({
      title: '2. PV MODULES',
      render(ctx, w, h) {
        drawFaintBackground(ctx, bg, w, h);
        for (const arr of data.pvArrays) drawPvArray(ctx, arr, false, cfg, si, masks, 1, false);
      },
    });
  }

  // 3 — Equipment
  if (data.equipment.length > 0) {
    const si = data.scaleInfo;
    const ps = data.plantSetupConfig;
    views.push({
      title: '3. EQUIPMENT',
      render(ctx, w, h) {
        drawFaintBackground(ctx, bg, w, h);
        for (const item of data.equipment) drawEquipmentIcon(ctx, item, false, 1, si, ps);
      },
    });
  }

  // 4 — Cables (DC + AC)
  if (data.lines.length > 0) {
    views.push({
      title: '4. CABLES (DC & AC)',
      render(ctx, w, h) {
        drawFaintBackground(ctx, bg, w, h);
        for (const line of data.lines) drawSupplyLine(ctx, line, 1, false);
      },
    });
  }

  // 5 — Walkways & Cable Trays
  if (data.placedWalkways.length > 0 || data.placedCableTrays.length > 0) {
    const si = data.scaleInfo;
    views.push({
      title: '5. WALKWAYS & CABLE TRAYS',
      render(ctx, w, h) {
        drawFaintBackground(ctx, bg, w, h);
        for (const wk of data.placedWalkways) drawWalkway(ctx, wk, false, false, 1, si);
        for (const ct of data.placedCableTrays) drawCableTray(ctx, ct, false, false, 1, si);
      },
    });
  }

  // 6 — Combined (always)
  views.push({
    title: 'COMBINED LAYOUT',
    render(ctx, w, h) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      if (bg) ctx.drawImage(bg, 0, 0, w, h);
      for (const mask of data.roofMasks) drawRoofMask(ctx, mask, 1, false);
      for (const wk of data.placedWalkways) drawWalkway(ctx, wk, false, false, 1, data.scaleInfo);
      for (const ct of data.placedCableTrays) drawCableTray(ctx, ct, false, false, 1, data.scaleInfo);
      if (data.pvPanelConfig) {
        for (const arr of data.pvArrays) drawPvArray(ctx, arr, false, data.pvPanelConfig!, data.scaleInfo, data.roofMasks, 1, false);
      }
      for (const line of data.lines) drawSupplyLine(ctx, line, 1, false);
      for (const item of data.equipment) drawEquipmentIcon(ctx, item, false, 1, data.scaleInfo, data.plantSetupConfig);
    },
  });

  return views;
}

/* ------------------------------------------------------------------ */
/*  Grid layout calculator                                              */
/* ------------------------------------------------------------------ */

function gridLayout(count: number): { cols: number; rows: number } {
  if (count <= 2) return { cols: 2, rows: 1 };
  if (count <= 4) return { cols: 2, rows: 2 };
  if (count <= 6) return { cols: 3, rows: 2 };
  return { cols: 3, rows: Math.ceil(count / 3) };
}

/* ------------------------------------------------------------------ */
/*  Main export function                                                */
/* ------------------------------------------------------------------ */

export function exportLayeredA0(data: A0ExportData): HTMLCanvasElement {
  const viewports = buildViewports(data);
  const legend = collectLegend(data);
  const { cols, rows } = gridLayout(viewports.length);

  const canvas = document.createElement('canvas');
  canvas.width = A0_W;
  canvas.height = A0_H;
  const ctx = canvas.getContext('2d')!;

  // White background
  ctx.fillStyle = '#f8f8f8';
  ctx.fillRect(0, 0, A0_W, A0_H);

  // Available area for viewports
  const contentW = A0_W - LEGEND_W - PAD * 2 - PAD; // extra pad between grid & legend
  const contentH = A0_H - TITLE_H - PAD * 2;

  const cellW = Math.floor((contentW - (cols - 1) * PAD / 2) / cols);
  const cellH = Math.floor((contentH - (rows - 1) * PAD / 2) / rows);
  const vpW = cellW;
  const vpH = cellH - HEADER_H;

  // Scale source layout to fit viewport
  const srcAspect = data.width / data.height;

  for (let i = 0; i < viewports.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = PAD + col * (cellW + PAD / 2);
    const y = PAD + row * (cellH + PAD / 2);

    const vp = viewports[i];

    // Header
    ctx.fillStyle = '#262626';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(vp.title, x + 8, y + 36);

    // Viewport border
    const vpX = x;
    const vpY = y + HEADER_H;

    ctx.save();
    ctx.strokeStyle = '#d4d4d4';
    ctx.lineWidth = 2;
    ctx.strokeRect(vpX, vpY, vpW, vpH);
    ctx.restore();

    // Render layer into offscreen canvas at source resolution, then draw scaled
    const offscreen = document.createElement('canvas');
    offscreen.width = data.width;
    offscreen.height = data.height;
    const oCtx = offscreen.getContext('2d')!;
    vp.render(oCtx, data.width, data.height);

    // Fit into viewport area
    const vpAspect = vpW / vpH;
    let dw: number, dh: number, dx: number, dy: number;
    if (srcAspect > vpAspect) {
      dw = vpW;
      dh = vpW / srcAspect;
      dx = vpX;
      dy = vpY + (vpH - dh) / 2;
    } else {
      dh = vpH;
      dw = vpH * srcAspect;
      dx = vpX + (vpW - dw) / 2;
      dy = vpY;
    }
    ctx.drawImage(offscreen, 0, 0, data.width, data.height, dx, dy, dw, dh);
  }

  // ---- Legend Card ----
  const lx = A0_W - LEGEND_W - PAD;
  const ly = PAD;
  const lh = A0_H - TITLE_H - PAD * 2;

  // Card background
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#d4d4d4';
  ctx.lineWidth = 2;
  roundRect(ctx, lx, ly, LEGEND_W, lh, 12);
  ctx.fill();
  ctx.stroke();

  let textY = ly + 50;
  const textX = lx + 40;

  // Project title
  ctx.fillStyle = '#171717';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText(data.projectName || 'PV Layout', textX, textY);
  textY += 48;

  if (data.layoutName) {
    ctx.fillStyle = '#525252';
    ctx.font = '24px sans-serif';
    ctx.fillText(data.layoutName, textX, textY);
    textY += 36;
  }

  // Date
  ctx.fillStyle = '#737373';
  ctx.font = '20px sans-serif';
  ctx.fillText(new Date().toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' }), textX, textY);
  textY += 40;

  // Divider
  ctx.strokeStyle = '#e5e5e5';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(textX, textY);
  ctx.lineTo(lx + LEGEND_W - 40, textY);
  ctx.stroke();
  textY += 30;

  // LEGEND heading
  ctx.fillStyle = '#171717';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('LEGEND', textX, textY);
  textY += 44;

  // Entries
  const swatchSize = 28;
  const entrySpacing = 52;

  for (const entry of legend) {
    // Colour swatch
    ctx.fillStyle = entry.color;
    roundRect(ctx, textX, textY - 20, swatchSize, swatchSize, 4);
    ctx.fill();
    ctx.strokeStyle = '#a3a3a3';
    ctx.lineWidth = 1;
    roundRect(ctx, textX, textY - 20, swatchSize, swatchSize, 4);
    ctx.stroke();

    // Label
    ctx.fillStyle = '#171717';
    ctx.font = '22px sans-serif';
    ctx.fillText(entry.label, textX + swatchSize + 16, textY);

    // Value (right-aligned)
    ctx.fillStyle = '#525252';
    ctx.font = '20px sans-serif';
    const valW = ctx.measureText(entry.value).width;
    ctx.fillText(entry.value, lx + LEGEND_W - 40 - valW, textY);

    textY += entrySpacing;
  }

  // Scale info at bottom of legend
  if (data.scaleInfo.ratio) {
    const scaleY = ly + lh - 50;
    ctx.fillStyle = '#737373';
    ctx.font = '18px sans-serif';
    ctx.fillText(`Scale: 1 px = ${(data.scaleInfo.ratio * 1000).toFixed(1)} mm`, textX, scaleY);
  }

  // ---- Title Strip ----
  const tsY = A0_H - TITLE_H - PAD;
  const tsW = A0_W - PAD * 2;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#d4d4d4';
  ctx.lineWidth = 2;
  ctx.fillRect(PAD, tsY, tsW, TITLE_H);
  ctx.strokeRect(PAD, tsY, tsW, TITLE_H);

  ctx.fillStyle = '#171717';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText(data.projectName || 'PV Layout', PAD + 30, tsY + 50);

  ctx.fillStyle = '#525252';
  ctx.font = '24px sans-serif';
  ctx.fillText(data.layoutName || '', PAD + 30, tsY + 90);

  ctx.fillStyle = '#737373';
  ctx.font = '22px sans-serif';
  const dateStr = new Date().toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' });
  const dateW = ctx.measureText(dateStr).width;
  ctx.fillText(dateStr, PAD + tsW - 30 - dateW, tsY + 50);
  ctx.fillText('A0 DRAWING SHEET', PAD + tsW - 30 - ctx.measureText('A0 DRAWING SHEET').width, tsY + 90);

  return canvas;
}

/* ------------------------------------------------------------------ */
/*  Rounded rectangle helper                                            */
/* ------------------------------------------------------------------ */

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/* ------------------------------------------------------------------ */
/*  Download helper                                                     */
/* ------------------------------------------------------------------ */

export function downloadA0PNG(canvas: HTMLCanvasElement, filename: string): boolean {
  const dataUrl = canvas.toDataURL('image/png');

  // Open in new tab (bypass sandbox restrictions)
  const newWindow = window.open('', '_blank');
  if (newWindow) {
    newWindow.document.write(`
      <!DOCTYPE html>
      <html><head><title>${filename}</title></head>
      <body style="margin:0;background:#1a1a1a;display:flex;justify-content:center;align-items:flex-start;min-height:100vh;overflow:auto;">
        <img src="${dataUrl}" style="max-width:100%;height:auto;" />
      </body></html>
    `);
    newWindow.document.close();
    return true;
  }

  // Fallback
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  return true;
}
