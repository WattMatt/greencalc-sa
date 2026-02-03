import { Point, PVArrayItem, PVPanelConfig, RoofMask, ScaleInfo, EquipmentType, EquipmentItem, PlantSetupConfig } from '../types';

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

      if (forceAlign) {
        // Shift held: Only align axis, keep mouse distance
        if (absDx > absDy) {
          // Align vertically (match Y), keep mouse X
          snapPosition = {
            x: mousePos.x,
            y: arr.position.y,
          };
        } else {
          // Align horizontally (match X), keep mouse Y
          snapPosition = {
            x: arr.position.x,
            y: mousePos.y,
          };
        }
      } else {
        // Normal snap: Enforce minimum spacing and align
        if (absDx > absDy) {
          const signX = dx >= 0 ? 1 : -1;
          snapPosition = {
            x: arr.position.x + signX * minDistX,
            y: arr.position.y,
          };
        } else {
          const signY = dy >= 0 ? 1 : -1;
          snapPosition = {
            x: arr.position.x,
            y: arr.position.y + signY * minDistY,
          };
        }
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

/**
 * Get equipment dimensions in pixels based on type and plant setup config
 */
export const getEquipmentDimensions = (
  type: EquipmentType,
  scaleInfo: ScaleInfo,
  plantSetupConfig?: PlantSetupConfig
): { width: number; height: number } => {
  // Default sizes in meters
  const defaultSizes: Record<EquipmentType, { width: number; height: number }> = {
    [EquipmentType.INVERTER]: { width: 0.7, height: 0.5 },
    [EquipmentType.DC_COMBINER]: { width: 0.4, height: 0.3 },
    [EquipmentType.AC_DISCONNECT]: { width: 0.3, height: 0.2 },
    [EquipmentType.MAIN_BOARD]: { width: 1.2, height: 0.4 },
    [EquipmentType.SUB_BOARD]: { width: 0.8, height: 0.3 },
  };

  let widthM = defaultSizes[type]?.width || 0.5;
  let heightM = defaultSizes[type]?.height || 0.3;

  // Check for custom inverter dimensions
  if (type === EquipmentType.INVERTER && plantSetupConfig?.inverters) {
    const defaultInverter = plantSetupConfig.inverters.find(i => i.isDefault);
    if (defaultInverter) {
      widthM = defaultInverter.width ?? widthM;
      heightM = defaultInverter.height ?? heightM;
    }
  }

  if (!scaleInfo.ratio) {
    return { width: 20, height: 15 }; // Fallback pixels
  }

  return {
    width: widthM / scaleInfo.ratio,
    height: heightM / scaleInfo.ratio,
  };
};

/**
 * Snap equipment to maintain minimum spacing from other equipment items.
 * Returns the snapped position and rotation (matched to nearest item).
 */
export const snapEquipmentToSpacing = (
  mousePos: Point,
  ghostType: EquipmentType,
  ghostRotation: number,
  existingEquipment: EquipmentItem[],
  scaleInfo: ScaleInfo,
  minSpacingMeters: number,
  forceAlign: boolean = false,
  plantSetupConfig?: PlantSetupConfig
): { position: Point; rotation: number; snappedToId: string | null } => {
  if (!scaleInfo.ratio || existingEquipment.length === 0) {
    return { position: mousePos, rotation: ghostRotation, snappedToId: null };
  }

  // If not force-aligning and no spacing configured, allow free placement
  if (!forceAlign && minSpacingMeters <= 0) {
    return { position: mousePos, rotation: ghostRotation, snappedToId: null };
  }

  const minSpacingPx = minSpacingMeters / scaleInfo.ratio;

  // Get ghost equipment dimensions
  const ghostDims = getEquipmentDimensions(ghostType, scaleInfo, plantSetupConfig);
  const ghostHalfW = ghostDims.width / 2;
  const ghostHalfH = ghostDims.height / 2;

  let closestItem: EquipmentItem | null = null;
  let closestDist = Infinity;
  let snapPosition = mousePos;

  for (const item of existingEquipment) {
    const itemDims = getEquipmentDimensions(item.type, scaleInfo, plantSetupConfig);
    const itemHalfW = itemDims.width / 2;
    const itemHalfH = itemDims.height / 2;

    // Calculate center-to-center distance
    const dx = mousePos.x - item.position.x;
    const dy = mousePos.y - item.position.y;
    const dist = Math.hypot(dx, dy);

    // Calculate effective half-dimensions considering rotation
    const angleRad = item.rotation * Math.PI / 180;
    const cosA = Math.abs(Math.cos(angleRad));
    const sinA = Math.abs(Math.sin(angleRad));

    const effItemHalfW = itemHalfW * cosA + itemHalfH * sinA;
    const effItemHalfH = itemHalfW * sinA + itemHalfH * cosA;
    const effGhostHalfW = ghostHalfW * cosA + ghostHalfH * sinA;
    const effGhostHalfH = ghostHalfW * sinA + ghostHalfH * cosA;

    // Minimum distance for this pair (edge to edge + spacing)
    const minDistX = effItemHalfW + effGhostHalfW + minSpacingPx;
    const minDistY = effItemHalfH + effGhostHalfH + minSpacingPx;

    // Edge-to-edge gaps
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const edgeDistX = absDx - (effItemHalfW + effGhostHalfW);
    const edgeDistY = absDy - (effItemHalfH + effGhostHalfH);

    const gapX = Math.max(0, edgeDistX);
    const gapY = Math.max(0, edgeDistY);
    const minEdgeDistance = Math.hypot(gapX, gapY);

    // If force-aligning (Shift held), always consider this item as a snap candidate.
    // Otherwise, only snap if within the configured spacing threshold.
    if (!forceAlign && minEdgeDistance >= minSpacingPx) {
      continue;
    }

    if (dist < closestDist) {
      closestDist = dist;
      closestItem = item;

      if (forceAlign) {
        // Shift held: Only align axis, keep mouse distance
        if (absDx > absDy) {
          snapPosition = { x: mousePos.x, y: item.position.y };
        } else {
          snapPosition = { x: item.position.x, y: mousePos.y };
        }
      } else {
        // Normal snap: Enforce minimum spacing and align
        if (absDx > absDy) {
          const signX = dx >= 0 ? 1 : -1;
          snapPosition = { x: item.position.x + signX * minDistX, y: item.position.y };
        } else {
          const signY = dy >= 0 ? 1 : -1;
          snapPosition = { x: item.position.x, y: item.position.y + signY * minDistY };
        }
      }
    }
  }

  if (closestItem) {
    return {
      position: snapPosition,
      rotation: closestItem.rotation,
      snappedToId: closestItem.id,
    };
  }

  return { position: mousePos, rotation: ghostRotation, snappedToId: null };
};

/**
 * Get material (walkway/cable tray) dimensions in pixels
 */
export const getMaterialDimensions = (
  item: { width: number; length: number; rotation: number },
  scaleInfo: ScaleInfo
): { width: number; height: number } => {
  if (!scaleInfo.ratio) {
    return { width: 50, height: 100 }; // Fallback pixels
  }

  const widthPx = item.width / scaleInfo.ratio;
  const lengthPx = item.length / scaleInfo.ratio;

  // Apply rotation to get effective bounding box dimensions
  const angleRad = item.rotation * Math.PI / 180;
  const cosA = Math.abs(Math.cos(angleRad));
  const sinA = Math.abs(Math.sin(angleRad));

  return {
    width: widthPx * cosA + lengthPx * sinA,
    height: widthPx * sinA + lengthPx * cosA,
  };
};

/**
 * Snap walkways and cable trays to maintain minimum spacing from existing items.
 * Returns the snapped position and rotation (matched to nearest item).
 */
export const snapMaterialToSpacing = (
  mousePos: Point,
  ghostConfig: { width: number; length: number; rotation: number },
  existingItems: Array<{ id: string; width: number; length: number; position: Point; rotation: number }>,
  scaleInfo: ScaleInfo,
  minSpacingMeters: number,
  forceAlign: boolean = false
): { position: Point; rotation: number; snappedToId: string | null } => {
  if (!scaleInfo.ratio || existingItems.length === 0) {
    return { position: mousePos, rotation: ghostConfig.rotation, snappedToId: null };
  }

  // Always allow snapping for alignment even when minSpacing is very low
  // This enables edge-to-edge alignment when user sets spacing to 0
  const effectiveMinSpacing = Math.max(0.01, minSpacingMeters); // At least 1cm for calculations
  const minSpacingPx = effectiveMinSpacing / scaleInfo.ratio;

  // Get ghost material dimensions (raw, before rotation transform for effective size)
  const ghostWidthPx = ghostConfig.width / scaleInfo.ratio;
  const ghostLengthPx = ghostConfig.length / scaleInfo.ratio;
  const ghostAngleRad = ghostConfig.rotation * Math.PI / 180;
  const ghostCosA = Math.abs(Math.cos(ghostAngleRad));
  const ghostSinA = Math.abs(Math.sin(ghostAngleRad));
  const ghostHalfW = (ghostWidthPx * ghostCosA + ghostLengthPx * ghostSinA) / 2;
  const ghostHalfH = (ghostWidthPx * ghostSinA + ghostLengthPx * ghostCosA) / 2;

  let closestItem: typeof existingItems[0] | null = null;
  let closestDist = Infinity;
  let snapPosition = mousePos;

  for (const item of existingItems) {
    const itemWidthPx = item.width / scaleInfo.ratio;
    const itemLengthPx = item.length / scaleInfo.ratio;
    const itemAngleRad = item.rotation * Math.PI / 180;
    const itemCosA = Math.abs(Math.cos(itemAngleRad));
    const itemSinA = Math.abs(Math.sin(itemAngleRad));
    const itemHalfW = (itemWidthPx * itemCosA + itemLengthPx * itemSinA) / 2;
    const itemHalfH = (itemWidthPx * itemSinA + itemLengthPx * itemCosA) / 2;

    // Calculate center-to-center distance
    const dx = mousePos.x - item.position.x;
    const dy = mousePos.y - item.position.y;
    const dist = Math.hypot(dx, dy);

    // Minimum distance for this pair (edge to edge + spacing)
    const minDistX = itemHalfW + ghostHalfW + minSpacingPx;
    const minDistY = itemHalfH + ghostHalfH + minSpacingPx;

    // Edge-to-edge gaps
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const edgeDistX = absDx - (itemHalfW + ghostHalfW);
    const edgeDistY = absDy - (itemHalfH + ghostHalfH);

    const gapX = Math.max(0, edgeDistX);
    const gapY = Math.max(0, edgeDistY);
    const minEdgeDistance = Math.hypot(gapX, gapY);

    // If force-aligning (Shift held), always consider this item as a snap candidate.
    // Otherwise, only snap if within the configured spacing threshold.
    if (!forceAlign && minEdgeDistance >= minSpacingPx) {
      continue;
    }

    if (dist < closestDist) {
      closestDist = dist;
      closestItem = item;

      if (forceAlign) {
        // Shift held: Only align axis, keep mouse distance
        if (absDx > absDy) {
          snapPosition = { x: mousePos.x, y: item.position.y };
        } else {
          snapPosition = { x: item.position.x, y: mousePos.y };
        }
      } else {
        // Normal snap: Enforce minimum spacing and align
        if (absDx > absDy) {
          const signX = dx >= 0 ? 1 : -1;
          snapPosition = { x: item.position.x + signX * minDistX, y: item.position.y };
        } else {
          const signY = dy >= 0 ? 1 : -1;
          snapPosition = { x: item.position.x, y: item.position.y + signY * minDistY };
        }
      }
    }
  }

  if (closestItem) {
    return {
      position: snapPosition,
      rotation: closestItem.rotation,
      snappedToId: closestItem.id,
    };
  }

  return { position: mousePos, rotation: ghostConfig.rotation, snappedToId: null };
};

/**
 * Calculate edge-to-edge distance between two objects in meters.
 * This calculates the gap between the closest edges of two bounding boxes.
 */
export const getObjectEdgeDistance = (
  pos1: Point,
  dims1: { width: number; height: number },
  rotation1: number,
  pos2: Point,
  dims2: { width: number; height: number },
  rotation2: number,
  scaleRatio: number
): number => {
  const edges1 = getObjectEdges(pos1, dims1, rotation1);
  const edges2 = getObjectEdges(pos2, dims2, rotation2);
  
  // Calculate the gap on each axis (negative means overlap)
  const gapX = Math.max(edges1.left - edges2.right, edges2.left - edges1.right);
  const gapY = Math.max(edges1.top - edges2.bottom, edges2.top - edges1.bottom);
  
  // If both gaps are negative, objects overlap - return 0
  if (gapX < 0 && gapY < 0) {
    return 0;
  }
  
  // If one gap is negative, only the other axis matters
  if (gapX < 0) {
    return Math.max(0, gapY) * scaleRatio;
  }
  if (gapY < 0) {
    return Math.max(0, gapX) * scaleRatio;
  }
  
  // If both gaps are positive, return the Euclidean distance to corner
  return Math.hypot(gapX, gapY) * scaleRatio;
};

/**
 * @deprecated Use getObjectEdgeDistance instead for edge-to-edge measurements
 * Calculate center-to-center distance between two objects in meters
 */
export const getObjectCenterDistance = (
  pos1: Point,
  pos2: Point,
  scaleRatio: number
): number => {
  const pixelDistance = distance(pos1, pos2);
  return pixelDistance * scaleRatio;
};

/**
 * Calculate new position for object1 to achieve a target edge-to-edge distance from object2.
 * Object1 moves along the line connecting the two object centers.
 * The distance is measured from the boundary of each object, not their centers.
 */
export const calculateNewPositionAtDistance = (
  object1Pos: Point,
  object1Dims: { width: number; height: number },
  object1Rotation: number,
  object2Pos: Point,
  object2Dims: { width: number; height: number },
  object2Rotation: number,
  targetDistanceMeters: number,
  scaleRatio: number
): Point => {
  const dx = object1Pos.x - object2Pos.x;
  const dy = object1Pos.y - object2Pos.y;
  const centerDist = Math.hypot(dx, dy);
  
  // Get the effective half-dimensions considering rotation
  const edges1 = getObjectEdges(object1Pos, object1Dims, object1Rotation);
  const edges2 = getObjectEdges(object2Pos, object2Dims, object2Rotation);
  
  const halfWidth1 = (edges1.right - edges1.left) / 2;
  const halfHeight1 = (edges1.bottom - edges1.top) / 2;
  const halfWidth2 = (edges2.right - edges2.left) / 2;
  const halfHeight2 = (edges2.bottom - edges2.top) / 2;
  
  // Use EPSILON for near-zero detection to avoid numerical instability
  const EPSILON = 0.001; // 1/1000th of a pixel
  
  if (centerDist < EPSILON) {
    // Objects at effectively same position
    // Determine which direction to move based on current edge positions
    const gapX = Math.max(edges1.left - edges2.right, edges2.left - edges1.right);
    const gapY = Math.max(edges1.top - edges2.bottom, edges2.top - edges1.bottom);
    
    // Move along the axis with the larger gap, or default to X
    if (Math.abs(gapY) > Math.abs(gapX)) {
      const signY = gapY >= 0 ? 1 : -1;
      const edgeToEdgeOffset = halfHeight1 + halfHeight2 + (targetDistanceMeters / scaleRatio);
      return {
        x: object2Pos.x,
        y: object2Pos.y + signY * edgeToEdgeOffset,
      };
    } else {
      const signX = gapX >= 0 ? 1 : -1;
      const edgeToEdgeOffset = halfWidth1 + halfWidth2 + (targetDistanceMeters / scaleRatio);
      return {
        x: object2Pos.x + signX * edgeToEdgeOffset,
        y: object2Pos.y,
      };
    }
  }
  
  // Normalize direction
  const unitX = dx / centerDist;
  const unitY = dy / centerDist;
  
  // Calculate the edge offsets in the direction of movement
  // For axis-aligned bounding boxes, we use the half-dimension that aligns with the movement direction
  const absDx = Math.abs(unitX);
  const absDy = Math.abs(unitY);
  
  // Weighted average of half-dimensions based on direction
  const edgeOffset1 = halfWidth1 * absDx + halfHeight1 * absDy;
  const edgeOffset2 = halfWidth2 * absDx + halfHeight2 * absDy;
  
  // Target center-to-center distance = edge1 + gap + edge2
  const targetCenterDist = edgeOffset1 + (targetDistanceMeters / scaleRatio) + edgeOffset2;
  
  return {
    x: object2Pos.x + unitX * targetCenterDist,
    y: object2Pos.y + unitY * targetCenterDist,
  };
};

export type AlignmentEdge = 'left' | 'right' | 'top' | 'bottom';

/**
 * Get bounding box edges for any object type
 * Returns edge positions in world coordinates (pixels)
 */
export const getObjectEdges = (
  position: Point,
  dimensions: { width: number; height: number },
  rotation: number
): { left: number; right: number; top: number; bottom: number } => {
  // For rotated objects, we use axis-aligned bounding box
  const angleRad = rotation * Math.PI / 180;
  const cosA = Math.abs(Math.cos(angleRad));
  const sinA = Math.abs(Math.sin(angleRad));
  
  const effectiveWidth = dimensions.width * cosA + dimensions.height * sinA;
  const effectiveHeight = dimensions.width * sinA + dimensions.height * cosA;
  
  return {
    left: position.x - effectiveWidth / 2,
    right: position.x + effectiveWidth / 2,
    top: position.y - effectiveHeight / 2,
    bottom: position.y + effectiveHeight / 2,
  };
};

/**
 * Calculate new position to align Object 1's edge with Object 2's edge
 */
export const calculateAlignedPosition = (
  object1Pos: Point,
  object1Dims: { width: number; height: number },
  object1Rotation: number,
  object2Pos: Point,
  object2Dims: { width: number; height: number },
  object2Rotation: number,
  alignmentEdge: AlignmentEdge
): Point => {
  const edges1 = getObjectEdges(object1Pos, object1Dims, object1Rotation);
  const edges2 = getObjectEdges(object2Pos, object2Dims, object2Rotation);
  
  switch (alignmentEdge) {
    case 'left': {
      // Move Object 1 so its left edge matches Object 2's left edge
      const leftOffset = edges2.left - edges1.left;
      return { x: object1Pos.x + leftOffset, y: object1Pos.y };
    }
    case 'right': {
      const rightOffset = edges2.right - edges1.right;
      return { x: object1Pos.x + rightOffset, y: object1Pos.y };
    }
    case 'top': {
      const topOffset = edges2.top - edges1.top;
      return { x: object1Pos.x, y: object1Pos.y + topOffset };
    }
    case 'bottom': {
      const bottomOffset = edges2.bottom - edges1.bottom;
      return { x: object1Pos.x, y: object1Pos.y + bottomOffset };
    }
  }
};

/**
 * Detect which edge of an object was clicked, if any.
 * Returns null if click is in the interior.
 * 
 * @param clickPos - The click position in world coordinates
 * @param objectPos - The object's center position
 * @param objectDims - The object's dimensions in pixels
 * @param objectRotation - The object's rotation in degrees
 * @param edgeThreshold - How close to edge counts as "on edge" (in pixels)
 */
export const detectClickedEdge = (
  clickPos: Point,
  objectPos: Point,
  objectDims: { width: number; height: number },
  objectRotation: number,
  edgeThreshold: number
): AlignmentEdge | null => {
  // Transform click to object's local coordinate space
  const angleRad = -objectRotation * Math.PI / 180;
  const dx = clickPos.x - objectPos.x;
  const dy = clickPos.y - objectPos.y;
  const localX = dx * Math.cos(angleRad) - dy * Math.sin(angleRad);
  const localY = dx * Math.sin(angleRad) + dy * Math.cos(angleRad);
  
  const halfW = objectDims.width / 2;
  const halfH = objectDims.height / 2;
  
  // Check if click is within the object bounds
  if (Math.abs(localX) > halfW || Math.abs(localY) > halfH) {
    return null; // Outside object
  }
  
  // Calculate distance from each edge
  const distFromLeft = Math.abs(localX - (-halfW));
  const distFromRight = Math.abs(localX - halfW);
  const distFromTop = Math.abs(localY - (-halfH));
  const distFromBottom = Math.abs(localY - halfH);
  
  const minDist = Math.min(distFromLeft, distFromRight, distFromTop, distFromBottom);
  
  // If minimum distance is within threshold, it's an edge click
  if (minDist <= edgeThreshold) {
    if (minDist === distFromLeft) return 'left';
    if (minDist === distFromRight) return 'right';
    if (minDist === distFromTop) return 'top';
    if (minDist === distFromBottom) return 'bottom';
  }
  
  return null; // Interior click
};

/**
 * Calculate the bounding box for a group of objects.
 * Takes an array of object data with position, dimensions, and rotation.
 * Returns the combined bounding box and center point.
 */
export const getGroupBoundingBox = (
  items: Array<{ position: Point; dimensions: { width: number; height: number }; rotation: number }>
): { left: number; right: number; top: number; bottom: number; center: Point } => {
  if (items.length === 0) {
    return { left: 0, right: 0, top: 0, bottom: 0, center: { x: 0, y: 0 } };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const item of items) {
    const edges = getObjectEdges(item.position, item.dimensions, item.rotation);
    minX = Math.min(minX, edges.left);
    maxX = Math.max(maxX, edges.right);
    minY = Math.min(minY, edges.top);
    maxY = Math.max(maxY, edges.bottom);
  }

  return {
    left: minX,
    right: maxX,
    top: minY,
    bottom: maxY,
    center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
  };
};

/**
 * Apply a delta offset to a position
 */
export const applyPositionDelta = (position: Point, delta: Point): Point => ({
  x: position.x + delta.x,
  y: position.y + delta.y,
});
