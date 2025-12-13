import { 
  Point, PVArrayItem, PVPanelConfig, RoofMask, ScaleInfo, 
  EquipmentItem, SupplyLine, EquipmentType 
} from '../types';
import { TOOL_COLORS, EQUIPMENT_REAL_WORLD_SIZES, getDirectionLabel } from '../constants';
import { isPointInPolygon, getPolygonCenter } from './geometry';

/**
 * Draw equipment icon on canvas
 */
export const drawEquipmentIcon = (
  ctx: CanvasRenderingContext2D,
  item: { type: EquipmentType; position: Point; rotation: number },
  isSelected: boolean,
  zoom: number,
  scaleInfo: ScaleInfo
) => {
  ctx.save();
  ctx.translate(item.position.x, item.position.y);
  ctx.rotate(item.rotation * Math.PI / 180);

  const realSizeInMeters = EQUIPMENT_REAL_WORLD_SIZES[item.type] || 0.5;
  const fixedSize = 12 / zoom;
  
  let size: number;
  if (scaleInfo.ratio) {
    size = realSizeInMeters / scaleInfo.ratio;
  } else {
    size = fixedSize;
  }

  const baseLineWidth = 1.5 / zoom;
  ctx.lineWidth = baseLineWidth;
  ctx.strokeStyle = isSelected ? '#34D399' : '#000000';
  ctx.fillStyle = '#000000';

  const font = (fontSize: number) => `${fontSize / zoom}px sans-serif`;
  
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  switch (item.type) {
    case EquipmentType.INVERTER:
      ctx.strokeRect(-size/2, -size/2.5, size, size/1.25);
      ctx.font = font(size * 0.6);
      ctx.fillText('~', size * 0.1, 0);
      ctx.fillText('=', -size * 0.2, 0);
      break;
    case EquipmentType.DC_COMBINER:
      ctx.strokeRect(-size/2, -size/2, size, size);
      ctx.font = font(size);
      ctx.fillText('+', 0, 0);
      break;
    case EquipmentType.AC_DISCONNECT:
      ctx.strokeRect(-size/2, -size/2, size, size);
      ctx.beginPath();
      ctx.moveTo(-size/3, -size/3);
      ctx.lineTo(size/3, size/3);
      ctx.stroke();
      break;
    case EquipmentType.MAIN_BOARD:
      ctx.strokeRect(-size/2, -size/3, size, size * 0.66);
      ctx.beginPath();
      ctx.moveTo(-size/2, size/3);
      ctx.lineTo(size/2, -size/3);
      ctx.lineTo(size/2, size/3);
      ctx.closePath();
      ctx.fill();
      break;
    case EquipmentType.SUB_BOARD:
      ctx.strokeRect(-size/2, -size/3, size, size * 0.66);
      ctx.beginPath();
      ctx.moveTo(-size/2, size/3);
      ctx.lineTo(size/2, -size/3);
      ctx.stroke();
      break;
    default:
      ctx.strokeRect(-size/2, -size/2, size, size);
      ctx.font = font(size * 0.6);
      ctx.fillText('?', 0, 0);
  }
  
  ctx.restore();
};

/**
 * Draw a PV array on canvas
 */
export const drawPvArray = (
  ctx: CanvasRenderingContext2D,
  array: PVArrayItem,
  isPreview: boolean,
  pvPanelConfig: PVPanelConfig,
  scaleInfo: ScaleInfo,
  roofMasks: RoofMask[],
  zoom: number,
  isSelected: boolean = false
) => {
  if (!pvPanelConfig || !scaleInfo.ratio) return;

  ctx.save();
  if (isPreview) {
    ctx.globalAlpha = 0.6;
  }
  ctx.translate(array.position.x, array.position.y);
  ctx.rotate(array.rotation * Math.PI / 180);

  const panelIsOnMask = roofMasks.find(mask => isPointInPolygon(array.position, mask.points));
  const pitch = panelIsOnMask ? panelIsOnMask.pitch : 0;
  const pitchRad = pitch * Math.PI / 180;

  let panelW_px = pvPanelConfig.width / scaleInfo.ratio;
  let panelL_px = pvPanelConfig.length / scaleInfo.ratio;

  // Adjust for projection based on pitch
  panelL_px *= Math.cos(pitchRad);

  const arrayPanelW = array.orientation === 'portrait' ? panelW_px : panelL_px;
  const arrayPanelL = array.orientation === 'portrait' ? panelL_px : panelW_px;

  const totalWidth = array.columns * arrayPanelW;
  const totalHeight = array.rows * arrayPanelL;

  ctx.strokeStyle = isSelected ? '#34D399' : '#38bdf8';
  ctx.lineWidth = (isSelected ? 2.5 : 1.5) / zoom;

  for (let r = 0; r < array.rows; r++) {
    for (let c = 0; c < array.columns; c++) {
      const x = c * arrayPanelW - totalWidth / 2;
      const y = r * arrayPanelL - totalHeight / 2;
      ctx.strokeRect(x, y, arrayPanelW, arrayPanelL);
    }
  }

  ctx.restore();
};

/**
 * Draw a roof mask on canvas
 */
export const drawRoofMask = (
  ctx: CanvasRenderingContext2D,
  mask: RoofMask,
  zoom: number,
  isSelected: boolean = false
) => {
  if (mask.points.length < 3) return;

  ctx.save();
  
  // Fill
  ctx.fillStyle = TOOL_COLORS.ROOF_MASK;
  ctx.beginPath();
  ctx.moveTo(mask.points[0].x, mask.points[0].y);
  for (let i = 1; i < mask.points.length; i++) {
    ctx.lineTo(mask.points[i].x, mask.points[i].y);
  }
  ctx.closePath();
  ctx.fill();

  // Stroke
  ctx.strokeStyle = isSelected ? '#34D399' : TOOL_COLORS.ROOF_MASK_STROKE;
  ctx.lineWidth = (isSelected ? 3 : 2) / zoom;
  ctx.stroke();

  // Draw direction arrow if direction is set
  if (mask.direction !== undefined) {
    const center = getPolygonCenter(mask.points);
    const arrowLength = 30 / zoom;
    const angleRad = (mask.direction - 90) * Math.PI / 180; // Adjust for canvas coordinates
    
    const endX = center.x + Math.cos(angleRad) * arrowLength;
    const endY = center.y + Math.sin(angleRad) * arrowLength;
    
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2 / zoom;
    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    
    // Arrowhead
    const headLength = 8 / zoom;
    const headAngle = Math.PI / 6;
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - headLength * Math.cos(angleRad - headAngle),
      endY - headLength * Math.sin(angleRad - headAngle)
    );
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - headLength * Math.cos(angleRad + headAngle),
      endY - headLength * Math.sin(angleRad + headAngle)
    );
    ctx.stroke();
    
    // Direction label
    ctx.fillStyle = '#f97316';
    ctx.font = `${12 / zoom}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(getDirectionLabel(mask.direction), center.x, center.y - arrowLength - 5 / zoom);
  }

  ctx.restore();
};

/**
 * Draw supply lines (DC/AC cables)
 */
export const drawSupplyLine = (
  ctx: CanvasRenderingContext2D,
  line: SupplyLine,
  zoom: number,
  isSelected: boolean = false
) => {
  if (line.points.length < 2) return;

  ctx.save();
  
  ctx.strokeStyle = line.type === 'dc' ? TOOL_COLORS.LINE_DC : TOOL_COLORS.LINE_AC;
  ctx.lineWidth = (isSelected ? 4 : 2.5) / zoom;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(line.points[0].x, line.points[0].y);
  for (let i = 1; i < line.points.length; i++) {
    ctx.lineTo(line.points[i].x, line.points[i].y);
  }
  ctx.stroke();

  // Draw vertices
  const vertexRadius = 4 / zoom;
  ctx.fillStyle = line.type === 'dc' ? TOOL_COLORS.LINE_DC : TOOL_COLORS.LINE_AC;
  for (const point of line.points) {
    ctx.beginPath();
    ctx.arc(point.x, point.y, vertexRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
};

/**
 * Draw the scale indicator
 */
export const drawScaleIndicator = (
  ctx: CanvasRenderingContext2D,
  scaleLine: { start: Point; end: Point } | null,
  scaleInfo: ScaleInfo,
  zoom: number
) => {
  if (!scaleLine) return;

  ctx.save();
  
  ctx.strokeStyle = TOOL_COLORS.SCALE;
  ctx.lineWidth = 3 / zoom;
  ctx.setLineDash([10 / zoom, 5 / zoom]);
  
  ctx.beginPath();
  ctx.moveTo(scaleLine.start.x, scaleLine.start.y);
  ctx.lineTo(scaleLine.end.x, scaleLine.end.y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw endpoints
  const endpointRadius = 6 / zoom;
  ctx.fillStyle = TOOL_COLORS.SCALE;
  ctx.beginPath();
  ctx.arc(scaleLine.start.x, scaleLine.start.y, endpointRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(scaleLine.end.x, scaleLine.end.y, endpointRadius, 0, Math.PI * 2);
  ctx.fill();

  // Draw label
  if (scaleInfo.realDistance) {
    const midX = (scaleLine.start.x + scaleLine.end.x) / 2;
    const midY = (scaleLine.start.y + scaleLine.end.y) / 2;
    
    ctx.fillStyle = '#000';
    ctx.font = `bold ${14 / zoom}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`${scaleInfo.realDistance.toFixed(2)}m`, midX, midY - 10 / zoom);
  }

  ctx.restore();
};

export interface RenderAllParams {
  equipment: EquipmentItem[];
  lines: SupplyLine[];
  roofMasks: RoofMask[];
  pvArrays: PVArrayItem[];
  scaleInfo: ScaleInfo;
  pvPanelConfig: PVPanelConfig | null;
  zoom: number;
  selectedItemId: string | null;
  scaleLine: { start: Point; end: Point } | null;
}

/**
 * Render all markups to the canvas context
 */
export const renderAllMarkups = (
  ctx: CanvasRenderingContext2D,
  params: RenderAllParams
) => {
  const { equipment, lines, roofMasks, pvArrays, scaleInfo, pvPanelConfig, zoom, selectedItemId, scaleLine } = params;

  // Draw roof masks first (background)
  for (const mask of roofMasks) {
    drawRoofMask(ctx, mask, zoom, selectedItemId === mask.id);
  }

  // Draw PV arrays
  if (pvPanelConfig) {
    for (const array of pvArrays) {
      drawPvArray(ctx, array, false, pvPanelConfig, scaleInfo, roofMasks, zoom, selectedItemId === array.id);
    }
  }

  // Draw supply lines
  for (const line of lines) {
    drawSupplyLine(ctx, line, zoom, selectedItemId === line.id);
  }

  // Draw equipment
  for (const item of equipment) {
    drawEquipmentIcon(ctx, item, selectedItemId === item.id, zoom, scaleInfo);
  }

  // Draw scale indicator
  drawScaleIndicator(ctx, scaleLine, scaleInfo, zoom);
};
