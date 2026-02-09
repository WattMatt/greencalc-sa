import { SupplyLine, PVArrayItem, EquipmentItem, PlacedWalkway, PlacedCableTray, Point } from '../types';

/**
 * Resolve the elevation of an object by its ID.
 * Searches pvArrays, equipment, walkways, and cable trays.
 */
export function getObjectElevation(
  objectId: string,
  pvArrays: PVArrayItem[],
  equipment: EquipmentItem[],
  placedWalkways: PlacedWalkway[],
  placedCableTrays: PlacedCableTray[]
): number | undefined {
  const arr = pvArrays.find(a => a.id === objectId);
  if (arr) return arr.elevation;

  const eq = equipment.find(e => e.id === objectId);
  if (eq) return eq.elevation;

  const wk = placedWalkways.find(w => w.id === objectId);
  if (wk) return wk.elevation;

  const ct = placedCableTrays.find(c => c.id === objectId);
  if (ct) return ct.elevation;

  return undefined;
}

/**
 * Auto-populate cable elevations from connected endpoints.
 * - Start elevation comes from `cable.from` object
 * - End elevation comes from `cable.to` object
 * - Intermediate waypoints are linearly interpolated
 * 
 * Only modifies cables that have `from` or `to` connections pointing to
 * objects with elevation data. Existing manual elevations are preserved
 * when neither endpoint has elevation data.
 */
export function autopopulateCableElevations(
  cable: SupplyLine,
  pvArrays: PVArrayItem[],
  equipment: EquipmentItem[],
  placedWalkways: PlacedWalkway[],
  placedCableTrays: PlacedCableTray[]
): number[] | undefined {
  if (cable.points.length < 2) return undefined;

  const startElev = cable.from
    ? getObjectElevation(cable.from, pvArrays, equipment, placedWalkways, placedCableTrays)
    : undefined;

  const endElev = cable.to
    ? getObjectElevation(cable.to, pvArrays, equipment, placedWalkways, placedCableTrays)
    : undefined;

  // If neither endpoint has elevation, don't generate elevations
  if (startElev === undefined && endElev === undefined) return undefined;

  const s = startElev ?? endElev ?? 0;
  const e = endElev ?? startElev ?? 0;
  const count = cable.points.length;

  // Linear interpolation between start and end
  return cable.points.map((_, i) => {
    if (count === 1) return s;
    const t = i / (count - 1);
    return s + t * (e - s);
  });
}
