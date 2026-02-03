import { 
  Point, PVArrayItem, PVPanelConfig, RoofMask, ScaleInfo, 
  EquipmentItem, SupplyLine, EquipmentType, PlantSetupConfig,
  PlacedWalkway, PlacedCableTray
} from '../types';
import { TOOL_COLORS, EQUIPMENT_REAL_WORLD_SIZES, getDirectionLabel } from '../constants';
import { isPointInPolygon, getPolygonCenter, getPVArrayDimensions, getEquipmentDimensions } from './geometry';
import { AlignmentEdge } from '../components/AlignEdgesModal';

/**
 * Draw a highlight overlay on a selected object for dimension/align tools
 */
export const drawObjectHighlight = (
  ctx: CanvasRenderingContext2D,
  position: Point,
  dimensions: { width: number; height: number },
  rotation: number,
  zoom: number,
  selectionNumber: 1 | 2,
  selectedEdge?: AlignmentEdge | null
) => {
  ctx.save();
  ctx.translate(position.x, position.y);
  ctx.rotate(rotation * Math.PI / 180);
  
  const { width, height } = dimensions;
  
  // Draw semi-transparent overlay
  ctx.fillStyle = selectionNumber === 1 
    ? 'rgba(59, 130, 246, 0.3)'  // Blue for object 1
    : 'rgba(34, 197, 94, 0.3)';  // Green for object 2
  ctx.fillRect(-width / 2, -height / 2, width, height);
  
  // Draw border
  ctx.strokeStyle = selectionNumber === 1 
    ? 'rgba(59, 130, 246, 0.8)'
    : 'rgba(34, 197, 94, 0.8)';
  ctx.lineWidth = 3 / zoom;
  ctx.strokeRect(-width / 2, -height / 2, width, height);
  
  // Draw edge highlight if an edge was clicked
  if (selectedEdge) {
    ctx.strokeStyle = selectionNumber === 1 
      ? 'rgba(59, 130, 246, 1)'  // Solid blue for object 1
      : 'rgba(34, 197, 94, 1)';  // Solid green for object 2
    ctx.lineWidth = 6 / zoom;
    ctx.lineCap = 'round';
    
    ctx.beginPath();
    switch (selectedEdge) {
      case 'left':
        ctx.moveTo(-width / 2, -height / 2);
        ctx.lineTo(-width / 2, height / 2);
        break;
      case 'right':
        ctx.moveTo(width / 2, -height / 2);
        ctx.lineTo(width / 2, height / 2);
        break;
      case 'top':
        ctx.moveTo(-width / 2, -height / 2);
        ctx.lineTo(width / 2, -height / 2);
        break;
      case 'bottom':
        ctx.moveTo(-width / 2, height / 2);
        ctx.lineTo(width / 2, height / 2);
        break;
    }
    ctx.stroke();
  }
  
  // Draw selection number
  const fontSize = Math.min(width, height) * 0.4;
  ctx.font = `bold ${Math.max(fontSize, 14 / zoom)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = selectionNumber === 1 
    ? 'rgba(59, 130, 246, 1)'
    : 'rgba(34, 197, 94, 1)';
  ctx.fillText(selectionNumber.toString(), 0, 0);
  
  ctx.restore();
};

/**
 * Find an object by ID and return its position, dimensions (in pixels), and rotation
 */
const findObjectForHighlight = (
  id: string,
  params: RenderAllParams
): { position: Point; dimensions: { width: number; height: number }; rotation: number } | null => {
  // Check PV arrays
  const pvArray = params.pvArrays.find(a => a.id === id);
  if (pvArray && params.pvPanelConfig && params.scaleInfo.ratio) {
    const dims = getPVArrayDimensions(pvArray, params.pvPanelConfig, params.roofMasks, params.scaleInfo, pvArray.position);
    return { position: pvArray.position, dimensions: dims, rotation: pvArray.rotation };
  }
  
  // Check equipment
  const equip = params.equipment.find(e => e.id === id);
  if (equip && params.scaleInfo.ratio) {
    const dims = getEquipmentDimensions(equip.type, params.scaleInfo, params.plantSetupConfig);
    return { position: equip.position, dimensions: dims, rotation: equip.rotation };
  }
  
  // Check walkways
  const walkway = params.placedWalkways?.find(w => w.id === id);
  if (walkway && params.scaleInfo.ratio) {
    return {
      position: walkway.position,
      dimensions: { width: walkway.width / params.scaleInfo.ratio, height: walkway.length / params.scaleInfo.ratio },
      rotation: walkway.rotation || 0,
    };
  }
  
  // Check cable trays
  const tray = params.placedCableTrays?.find(t => t.id === id);
  if (tray && params.scaleInfo.ratio) {
    return {
      position: tray.position,
      dimensions: { width: tray.width / params.scaleInfo.ratio, height: tray.length / params.scaleInfo.ratio },
      rotation: tray.rotation || 0,
    };
  }
  
  return null;
};

/**
 * Draw equipment icon on canvas
 */
export const drawEquipmentIcon = (
  ctx: CanvasRenderingContext2D,
  item: { type: EquipmentType; position: Point; rotation: number },
  isSelected: boolean,
  zoom: number,
  scaleInfo: ScaleInfo,
  plantSetupConfig?: PlantSetupConfig
) => {
  ctx.save();
  ctx.translate(item.position.x, item.position.y);
  ctx.rotate(item.rotation * Math.PI / 180);

  // Try to get custom size from plant setup config (for inverters)
  let realSizeInMeters = EQUIPMENT_REAL_WORLD_SIZES[item.type] || 0.5;
  let aspectRatio = 1; // width / height ratio for rendering
  
  if (item.type === EquipmentType.INVERTER && plantSetupConfig?.inverters?.length) {
    const defaultInverter = plantSetupConfig.inverters.find(i => i.isDefault) || plantSetupConfig.inverters[0];
    if (defaultInverter?.width && defaultInverter?.height) {
      // Use the larger dimension for sizing
      realSizeInMeters = Math.max(defaultInverter.width, defaultInverter.height);
      aspectRatio = defaultInverter.width / defaultInverter.height;
    }
  }
  
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
    case EquipmentType.INVERTER: {
      // Use aspect ratio for inverter sizing
      const width = aspectRatio >= 1 ? size : size * aspectRatio;
      const height = aspectRatio >= 1 ? size / aspectRatio : size;
      ctx.strokeRect(-width/2, -height/2, width, height);
      ctx.font = font(Math.min(width, height) * 0.6);
      ctx.fillText('~', width * 0.08, 0);
      ctx.fillText('=', -width * 0.15, 0);
      break;
    }
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

/**
 * Draw a walkway on canvas (hatched rectangle pattern)
 */
export const drawWalkway = (
  ctx: CanvasRenderingContext2D,
  walkway: PlacedWalkway,
  isSelected: boolean,
  isGhost: boolean,
  zoom: number,
  scaleInfo: ScaleInfo
) => {
  if (!scaleInfo.ratio) return;

  ctx.save();
  if (isGhost) {
    ctx.globalAlpha = 0.6;
  }
  ctx.translate(walkway.position.x, walkway.position.y);
  ctx.rotate((walkway.rotation || 0) * Math.PI / 180);

  const widthPx = walkway.width / scaleInfo.ratio;
  const lengthPx = walkway.length / scaleInfo.ratio;

  // Background fill
  ctx.fillStyle = 'rgba(156, 163, 175, 0.4)'; // Gray
  ctx.fillRect(-widthPx / 2, -lengthPx / 2, widthPx, lengthPx);

  // Create clipping region for hatching pattern
  ctx.save();
  ctx.beginPath();
  ctx.rect(-widthPx / 2, -lengthPx / 2, widthPx, lengthPx);
  ctx.clip();

  // Hatching pattern (diagonal lines) - now clipped to rectangle
  ctx.strokeStyle = 'rgba(107, 114, 128, 0.6)';
  ctx.lineWidth = 1 / zoom;
  const hatchSpacing = 8 / zoom;
  
  ctx.beginPath();
  for (let i = -lengthPx; i < widthPx + lengthPx; i += hatchSpacing) {
    ctx.moveTo(-widthPx / 2 + i, -lengthPx / 2);
    ctx.lineTo(-widthPx / 2 + i - lengthPx, lengthPx / 2);
  }
  ctx.stroke();
  ctx.restore(); // Restore to remove clipping

  // Border
  ctx.strokeStyle = isSelected ? '#34D399' : '#6b7280';
  ctx.lineWidth = (isSelected ? 2.5 : 1.5) / zoom;
  ctx.strokeRect(-widthPx / 2, -lengthPx / 2, widthPx, lengthPx);

  ctx.restore();
};

/**
 * Draw a cable tray on canvas (ladder/rail pattern)
 */
export const drawCableTray = (
  ctx: CanvasRenderingContext2D,
  tray: PlacedCableTray,
  isSelected: boolean,
  isGhost: boolean,
  zoom: number,
  scaleInfo: ScaleInfo
) => {
  if (!scaleInfo.ratio) return;

  ctx.save();
  if (isGhost) {
    ctx.globalAlpha = 0.6;
  }
  ctx.translate(tray.position.x, tray.position.y);
  ctx.rotate((tray.rotation || 0) * Math.PI / 180);

  const widthPx = tray.width / scaleInfo.ratio;
  const lengthPx = tray.length / scaleInfo.ratio;

  // Background fill (dark metallic gray)
  ctx.fillStyle = 'rgba(75, 85, 99, 0.5)';
  ctx.fillRect(-widthPx / 2, -lengthPx / 2, widthPx, lengthPx);

  // Ladder rungs pattern
  ctx.strokeStyle = 'rgba(55, 65, 81, 0.8)';
  ctx.lineWidth = 2 / zoom;
  const rungSpacing = 10 / zoom;
  
  ctx.beginPath();
  for (let y = -lengthPx / 2 + rungSpacing; y < lengthPx / 2; y += rungSpacing) {
    ctx.moveTo(-widthPx / 2, y);
    ctx.lineTo(widthPx / 2, y);
  }
  ctx.stroke();

  // Side rails
  ctx.lineWidth = 2.5 / zoom;
  ctx.beginPath();
  ctx.moveTo(-widthPx / 2, -lengthPx / 2);
  ctx.lineTo(-widthPx / 2, lengthPx / 2);
  ctx.moveTo(widthPx / 2, -lengthPx / 2);
  ctx.lineTo(widthPx / 2, lengthPx / 2);
  ctx.stroke();

  // Border
  ctx.strokeStyle = isSelected ? '#34D399' : '#374151';
  ctx.lineWidth = (isSelected ? 2.5 : 1.5) / zoom;
  ctx.strokeRect(-widthPx / 2, -lengthPx / 2, widthPx, lengthPx);

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
  selectedItemIds?: Set<string>; // Multi-selection support
  scaleLine: { start: Point; end: Point } | null;
  plantSetupConfig?: PlantSetupConfig;
  placedWalkways?: PlacedWalkway[];
  placedCableTrays?: PlacedCableTray[];
  // Dimension/align tool selection IDs
  dimensionObject1Id?: string | null;
  dimensionObject2Id?: string | null;
  alignObject1Id?: string | null;
  alignObject2Id?: string | null;
  alignEdge1?: AlignmentEdge | null;
  alignEdge2?: AlignmentEdge | null;
}

/**
 * Render all markups to the canvas context
 */
export const renderAllMarkups = (
  ctx: CanvasRenderingContext2D,
  params: RenderAllParams
) => {
  const { equipment, lines, roofMasks, pvArrays, scaleInfo, pvPanelConfig, zoom, selectedItemId, selectedItemIds, scaleLine, plantSetupConfig, placedWalkways, placedCableTrays } = params;

  // Helper to check if an item is selected (supports both single and multi-selection)
  const isItemSelected = (id: string) => {
    if (selectedItemIds && selectedItemIds.size > 0) {
      return selectedItemIds.has(id);
    }
    return selectedItemId === id;
  };

  // Draw roof masks first (background)
  for (const mask of roofMasks) {
    drawRoofMask(ctx, mask, zoom, isItemSelected(mask.id));
  }

  // Draw walkways (below PV arrays)
  if (placedWalkways) {
    for (const walkway of placedWalkways) {
      drawWalkway(ctx, walkway, isItemSelected(walkway.id), false, zoom, scaleInfo);
    }
  }

  // Draw cable trays (below PV arrays)
  if (placedCableTrays) {
    for (const tray of placedCableTrays) {
      drawCableTray(ctx, tray, isItemSelected(tray.id), false, zoom, scaleInfo);
    }
  }

  // Draw PV arrays
  if (pvPanelConfig) {
    for (const array of pvArrays) {
      drawPvArray(ctx, array, false, pvPanelConfig, scaleInfo, roofMasks, zoom, isItemSelected(array.id));
    }
  }

  // Draw supply lines
  for (const line of lines) {
    drawSupplyLine(ctx, line, zoom, isItemSelected(line.id));
  }

  // Draw equipment
  for (const item of equipment) {
    drawEquipmentIcon(ctx, item, isItemSelected(item.id), zoom, scaleInfo, plantSetupConfig);
  }

  // Draw scale indicator
  drawScaleIndicator(ctx, scaleLine, scaleInfo, zoom);

  // Draw group bounding box for multi-selection
  if (selectedItemIds && selectedItemIds.size > 1 && scaleInfo.ratio) {
    const groupItems: Array<{ position: Point; dimensions: { width: number; height: number }; rotation: number }> = [];
    
    selectedItemIds.forEach(id => {
      // Check PV arrays
      const pvArray = pvArrays.find(a => a.id === id);
      if (pvArray && pvPanelConfig) {
        const dims = getPVArrayDimensions(pvArray, pvPanelConfig, roofMasks, scaleInfo, pvArray.position);
        groupItems.push({ position: pvArray.position, dimensions: dims, rotation: pvArray.rotation });
      }
      
      // Check equipment
      const eq = equipment.find(e => e.id === id);
      if (eq) {
        const dims = getEquipmentDimensions(eq.type, scaleInfo, plantSetupConfig);
        groupItems.push({ position: eq.position, dimensions: dims, rotation: eq.rotation });
      }
      
      // Check walkways
      const walkway = placedWalkways?.find(w => w.id === id);
      if (walkway) {
        groupItems.push({
          position: walkway.position,
          dimensions: { width: walkway.width / scaleInfo.ratio!, height: walkway.length / scaleInfo.ratio! },
          rotation: walkway.rotation,
        });
      }
      
      // Check cable trays
      const tray = placedCableTrays?.find(t => t.id === id);
      if (tray) {
        groupItems.push({
          position: tray.position,
          dimensions: { width: tray.width / scaleInfo.ratio!, height: tray.length / scaleInfo.ratio! },
          rotation: tray.rotation,
        });
      }
    });
    
    if (groupItems.length > 1) {
      // Calculate group bounding box
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const item of groupItems) {
        const angleRad = item.rotation * Math.PI / 180;
        const cosA = Math.abs(Math.cos(angleRad));
        const sinA = Math.abs(Math.sin(angleRad));
        const effW = item.dimensions.width * cosA + item.dimensions.height * sinA;
        const effH = item.dimensions.width * sinA + item.dimensions.height * cosA;
        minX = Math.min(minX, item.position.x - effW / 2);
        maxX = Math.max(maxX, item.position.x + effW / 2);
        minY = Math.min(minY, item.position.y - effH / 2);
        maxY = Math.max(maxY, item.position.y + effH / 2);
      }
      
      // Draw group bounding box
      ctx.save();
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2 / zoom;
      ctx.setLineDash([8 / zoom, 4 / zoom]);
      ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
      ctx.setLineDash([]);
      
      // Draw selection count badge
      const badgeX = maxX;
      const badgeY = minY;
      const badgeRadius = 12 / zoom;
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${10 / zoom}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(selectedItemIds.size.toString(), badgeX, badgeY);
      ctx.restore();
    }
  }

  // Draw dimension/align tool highlights at the end (on top of everything)
  const highlightIds: { id: string; num: 1 | 2; edge?: AlignmentEdge | null }[] = [];
  if (params.dimensionObject1Id) highlightIds.push({ id: params.dimensionObject1Id, num: 1 });
  if (params.dimensionObject2Id) highlightIds.push({ id: params.dimensionObject2Id, num: 2 });
  if (params.alignObject1Id) highlightIds.push({ id: params.alignObject1Id, num: 1, edge: params.alignEdge1 });
  if (params.alignObject2Id) highlightIds.push({ id: params.alignObject2Id, num: 2, edge: params.alignEdge2 });
  
  for (const { id, num, edge } of highlightIds) {
    const objInfo = findObjectForHighlight(id, params);
    if (objInfo) {
      drawObjectHighlight(ctx, objInfo.position, objInfo.dimensions, objInfo.rotation, zoom, num, edge);
    }
  }
};
