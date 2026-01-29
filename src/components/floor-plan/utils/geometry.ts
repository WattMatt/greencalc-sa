import { Point, PVArrayItem, PVPanelConfig, RoofMask, ScaleInfo } from '../types';

/**
 * Checks if a point is inside a given polygon using the ray-casting algorithm.
 */
export const isPointInPolygon = (point: Point, polygon: Point[]): boolean => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;

    const intersect = ((yi > point.y) !== (yj > point.y))
      && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

/**
 * Calculate the area of a polygon in square meters
 */
export const calculatePolygonArea = (vertices: Point[], scaleRatio: number | null): number => {
  if (!scaleRatio) return 0;
  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }
  const pixelArea = Math.abs(area / 2);
  return pixelArea * Math.pow(scaleRatio, 2);
};

/**
 * Calculate line length in meters
 */
export const calculateLineLength = (points: Point[], scaleRatio: number | null): number => {
  if (!scaleRatio || points.length < 2) return 0;
  let length = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  return length * scaleRatio;
};

/**
 * Calculate distance between two points
 */
export const distance = (p1: Point, p2: Point): number => 
  Math.hypot(p1.x - p2.x, p1.y - p2.y);

/**
 * Calculate rotation angle for a PV array based on roof direction
 */
export const calculateArrayRotationForRoof = (
  position: Point,
  roofMasks: RoofMask[],
  manualRotation: number
): number => {
  const roofMask = roofMasks.find(mask => isPointInPolygon(position, mask.points));
  
  if (!roofMask) {
    return manualRotation;
  }
  
  // Calculate perpendicular angle to roof direction
  const perpendicularAngle = (roofMask.direction + 90) % 360;
  return perpendicularAngle;
};

/**
 * Get the corners of a PV array in world coordinates
 */
export const getPVArrayCorners = (
  array: PVArrayItem,
  pvPanelConfig: PVPanelConfig,
  roofMasks: RoofMask[],
  scaleInfo: ScaleInfo
): Point[] => {
  if (!scaleInfo.ratio) return [];

  const panelIsOnMask = roofMasks.find(mask => isPointInPolygon(array.position, mask.points));
  const pitch = panelIsOnMask ? panelIsOnMask.pitch : 0;
  const pitchRad = pitch * Math.PI / 180;

  let panelW_px = pvPanelConfig.width / scaleInfo.ratio;
  let panelL_px = pvPanelConfig.length / scaleInfo.ratio;

  // Adjust for top-down projection based on pitch
  panelL_px *= Math.cos(pitchRad);

  const arrayPanelW = array.orientation === 'portrait' ? panelW_px : panelL_px;
  const arrayPanelL = array.orientation === 'portrait' ? panelL_px : panelW_px;

  const totalWidth = array.columns * arrayPanelW;
  const totalHeight = array.rows * arrayPanelL;

  const corners: Point[] = [
    { x: -totalWidth / 2, y: -totalHeight / 2 },
    { x: totalWidth / 2, y: -totalHeight / 2 },
    { x: totalWidth / 2, y: totalHeight / 2 },
    { x: -totalWidth / 2, y: totalHeight / 2 },
  ];

  const angleRad = array.rotation * Math.PI / 180;
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);

  return corners.map(c => ({
    x: (c.x * cosA - c.y * sinA) + array.position.x,
    y: (c.x * sinA + c.y * cosA) + array.position.y,
  }));
};

/**
 * Calculate total PV capacity
 */
export const calculateTotalPVCapacity = (
  pvArrays: PVArrayItem[],
  pvPanelConfig: PVPanelConfig
): { panelCount: number; capacityKwp: number } => {
  const panelCount = pvArrays.reduce((sum, arr) => sum + (arr.rows * arr.columns), 0);
  const capacityKwp = (panelCount * pvPanelConfig.wattage) / 1000;
  return { panelCount, capacityKwp };
};

/**
 * Find the center of a polygon
 */
export const getPolygonCenter = (points: Point[]): Point => {
  const x = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const y = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  return { x, y };
};

/**
 * Check if a point is near another point within threshold
 */
export const isPointNear = (p1: Point, p2: Point, threshold: number): boolean => {
  return distance(p1, p2) <= threshold;
};

/**
 * Snap a point to the nearest 45-degree angle from an anchor point.
 * Used when Shift key is held during line drawing.
 */
export const snapTo45Degrees = (anchor: Point, target: Point): Point => {
  const dx = target.x - anchor.x;
  const dy = target.y - anchor.y;
  const dist = Math.hypot(dx, dy);
  
  if (dist === 0) return target;
  
  // Get angle in radians, then convert to degrees
  const angleRad = Math.atan2(dy, dx);
  const angleDeg = angleRad * (180 / Math.PI);
  
  // Snap to nearest 45-degree increment
  const snappedDeg = Math.round(angleDeg / 45) * 45;
  const snappedRad = snappedDeg * (Math.PI / 180);
  
  // Return point at same distance but snapped angle
  return {
    x: anchor.x + dist * Math.cos(snappedRad),
    y: anchor.y + dist * Math.sin(snappedRad),
  };
};

/**
 * Get the bounding box dimensions of a PV array in pixels
 */
export const getPVArrayDimensions = (
  array: { rows: number; columns: number; orientation: 'portrait' | 'landscape' },
  pvPanelConfig: PVPanelConfig,
  roofMasks: RoofMask[],
  scaleInfo: ScaleInfo,
  position?: Point
): { width: number; height: number } => {
  if (!scaleInfo.ratio) return { width: 0, height: 0 };

  let pitch = 0;
  if (position) {
    const panelIsOnMask = roofMasks.find(mask => isPointInPolygon(position, mask.points));
    pitch = panelIsOnMask ? panelIsOnMask.pitch : 0;
  }
  const pitchRad = pitch * Math.PI / 180;

  let panelW_px = pvPanelConfig.width / scaleInfo.ratio;
  let panelL_px = pvPanelConfig.length / scaleInfo.ratio;
  panelL_px *= Math.cos(pitchRad);

  const arrayPanelW = array.orientation === 'portrait' ? panelW_px : panelL_px;
  const arrayPanelL = array.orientation === 'portrait' ? panelL_px : panelW_px;

  return {
    width: array.columns * arrayPanelW,
    height: array.rows * arrayPanelL,
  };
};

/**
 * Snap a ghost PV array to maintain minimum spacing from existing arrays.
 * Returns the snapped position and rotation (matched to the snapped-to array).
 */
export const snapPVArrayToSpacing = (
  mousePos: Point,
  ghostConfig: { rows: number; columns: number; orientation: 'portrait' | 'landscape'; rotation: number },
  existingArrays: PVArrayItem[],
  pvPanelConfig: PVPanelConfig,
  roofMasks: RoofMask[],
  scaleInfo: ScaleInfo,
  minSpacingMeters: number,
  forceAlign: boolean = false
): { position: Point; rotation: number; snappedToId: string | null } => {
  if (!scaleInfo.ratio || existingArrays.length === 0) {
    return { position: mousePos, rotation: ghostConfig.rotation, snappedToId: null };
  }
  
  // If not force-aligning and no spacing configured, allow free placement
  if (!forceAlign && minSpacingMeters <= 0) {
    return { position: mousePos, rotation: ghostConfig.rotation, snappedToId: null };
  }

  const minSpacingPx = minSpacingMeters / scaleInfo.ratio;
  
  // Get ghost array dimensions
  const ghostDims = getPVArrayDimensions(ghostConfig, pvPanelConfig, roofMasks, scaleInfo, mousePos);
  const ghostHalfW = ghostDims.width / 2;
  const ghostHalfH = ghostDims.height / 2;

  let closestArray: PVArrayItem | null = null;
  let closestDist = Infinity;
  let snapPosition = mousePos;

  for (const arr of existingArrays) {
    const arrDims = getPVArrayDimensions(arr, pvPanelConfig, roofMasks, scaleInfo, arr.position);
    const arrHalfW = arrDims.width / 2;
    const arrHalfH = arrDims.height / 2;

    // Calculate center-to-center distance
    const dx = mousePos.x - arr.position.x;
    const dy = mousePos.y - arr.position.y;
    const dist = Math.hypot(dx, dy);

    // Calculate required minimum center-to-center distance based on array sizes
    // This is a simplified axis-aligned check; for rotated arrays a more complex check would be needed
    const angleRad = arr.rotation * Math.PI / 180;
    const cosA = Math.abs(Math.cos(angleRad));
    const sinA = Math.abs(Math.sin(angleRad));
    
    // Effective half-dimensions considering rotation
    const effArrHalfW = arrHalfW * cosA + arrHalfH * sinA;
    const effArrHalfH = arrHalfW * sinA + arrHalfH * cosA;
    const effGhostHalfW = ghostHalfW * cosA + ghostHalfH * sinA;
    const effGhostHalfH = ghostHalfW * sinA + ghostHalfH * cosA;

    // Minimum distance for this pair (edge to edge + spacing)
    const minDistX = effArrHalfW + effGhostHalfW + minSpacingPx;
    const minDistY = effArrHalfH + effGhostHalfH + minSpacingPx;

    // Only snap if ghost would violate minimum spacing (overlap or too close)
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    
    // Edge-to-edge gaps (negative means overlap on that axis)
    const edgeDistX = absDx - (effArrHalfW + effGhostHalfW);
    const edgeDistY = absDy - (effArrHalfH + effGhostHalfH);

    // Compute the true minimum edge-to-edge distance between the (axis-aligned) bounding boxes.
    // If boxes overlap on an axis, the gap for that axis is 0.
    // This avoids snapping when you're far away on one axis but merely aligned on the other.
    const gapX = Math.max(0, edgeDistX);
    const gapY = Math.max(0, edgeDistY);
    const minEdgeDistance = Math.hypot(gapX, gapY);

    // If force-aligning (Shift held), always consider this array as a snap candidate.
    // Otherwise, only snap if within the configured spacing threshold.
    if (!forceAlign && minEdgeDistance >= minSpacingPx) {
      continue;
    }

    if (dist < closestDist) {
      closestDist = dist;
      closestArray = arr;

      // Snap based on primary approach direction and align with existing array
      if (absDx > absDy) {
        // Approaching horizontally - snap to side and align vertically
        const signX = dx >= 0 ? 1 : -1;
        snapPosition = {
          x: arr.position.x + signX * minDistX,
          y: arr.position.y, // Align with existing array
        };
      } else {
        // Approaching vertically - snap above/below and align horizontally
        const signY = dy >= 0 ? 1 : -1;
        snapPosition = {
          x: arr.position.x, // Align with existing array
          y: arr.position.y + signY * minDistY,
        };
      }
    }
  }

  if (closestArray) {
    return {
      position: snapPosition,
      rotation: closestArray.rotation, // Match rotation of snapped-to array
      snappedToId: closestArray.id,
    };
  }

  return { position: mousePos, rotation: ghostConfig.rotation, snappedToId: null };
};
