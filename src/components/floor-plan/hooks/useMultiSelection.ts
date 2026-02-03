import { useState, useCallback, useMemo } from 'react';
import { Point, PVArrayItem, EquipmentItem, PlacedWalkway, PlacedCableTray, RoofMask, PVPanelConfig, ScaleInfo, PlantSetupConfig } from '../types';
import { getPVArrayDimensions, getEquipmentDimensions, getMaterialDimensions, getGroupBoundingBox, getObjectEdges, applyPositionDelta } from '../utils/geometry';
import { AlignmentEdge } from '../components/AlignEdgesModal';

export interface MultiSelectionState {
  selectedIds: Set<string>;
  // Helper for backward compatibility - returns first selected or null
  primarySelectedId: string | null;
}

interface UseMultiSelectionProps {
  pvArrays: PVArrayItem[];
  equipment: EquipmentItem[];
  placedWalkways: PlacedWalkway[];
  placedCableTrays: PlacedCableTray[];
  roofMasks: RoofMask[];
  pvPanelConfig: PVPanelConfig | null;
  scaleInfo: ScaleInfo;
  plantSetupConfig: PlantSetupConfig;
}

export interface SelectedItemInfo {
  id: string;
  type: 'pvArray' | 'equipment' | 'walkway' | 'cableTray' | 'roofMask';
  position: Point;
  dimensions: { width: number; height: number };
  rotation: number;
}

export function useMultiSelection({
  pvArrays,
  equipment,
  placedWalkways,
  placedCableTrays,
  roofMasks,
  pvPanelConfig,
  scaleInfo,
  plantSetupConfig,
}: UseMultiSelectionProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Primary selected ID for backward compatibility
  const primarySelectedId = useMemo(() => {
    if (selectedIds.size === 0) return null;
    return Array.from(selectedIds)[0];
  }, [selectedIds]);

  // Clear all selections
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Select a single item (clears existing selection)
  const selectSingle = useCallback((id: string) => {
    setSelectedIds(new Set([id]));
  }, []);

  // Toggle an item in the selection (for Shift/Ctrl+Click)
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Add item to selection without toggling
  const addToSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  // Check if an item is selected
  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  // Get detailed info for a selected item
  const getItemInfo = useCallback((id: string): SelectedItemInfo | null => {
    // Check PV arrays
    const pvArray = pvArrays.find(a => a.id === id);
    if (pvArray && pvPanelConfig && scaleInfo.ratio) {
      const dims = getPVArrayDimensions(pvArray, pvPanelConfig, roofMasks, scaleInfo, pvArray.position);
      return {
        id,
        type: 'pvArray',
        position: pvArray.position,
        dimensions: dims,
        rotation: pvArray.rotation,
      };
    }

    // Check equipment
    const eq = equipment.find(e => e.id === id);
    if (eq && scaleInfo.ratio) {
      const dims = getEquipmentDimensions(eq.type, scaleInfo, plantSetupConfig);
      return {
        id,
        type: 'equipment',
        position: eq.position,
        dimensions: dims,
        rotation: eq.rotation,
      };
    }

    // Check walkways
    const walkway = placedWalkways.find(w => w.id === id);
    if (walkway && scaleInfo.ratio) {
      return {
        id,
        type: 'walkway',
        position: walkway.position,
        dimensions: { 
          width: walkway.width / scaleInfo.ratio, 
          height: walkway.length / scaleInfo.ratio 
        },
        rotation: walkway.rotation,
      };
    }

    // Check cable trays
    const tray = placedCableTrays.find(c => c.id === id);
    if (tray && scaleInfo.ratio) {
      return {
        id,
        type: 'cableTray',
        position: tray.position,
        dimensions: { 
          width: tray.width / scaleInfo.ratio, 
          height: tray.length / scaleInfo.ratio 
        },
        rotation: tray.rotation,
      };
    }

    return null;
  }, [pvArrays, equipment, placedWalkways, placedCableTrays, roofMasks, pvPanelConfig, scaleInfo, plantSetupConfig]);

  // Get info for all selected items
  const selectedItemsInfo = useMemo((): SelectedItemInfo[] => {
    const infos: SelectedItemInfo[] = [];
    selectedIds.forEach(id => {
      const info = getItemInfo(id);
      if (info) infos.push(info);
    });
    return infos;
  }, [selectedIds, getItemInfo]);

  // Get the group bounding box for all selected items
  const groupBoundingBox = useMemo(() => {
    if (selectedItemsInfo.length < 2) return null;
    return getGroupBoundingBox(selectedItemsInfo);
  }, [selectedItemsInfo]);

  // Get the center point of the selection (for batch operations)
  const selectionCenter = useMemo((): Point => {
    if (selectedItemsInfo.length === 0) return { x: 0, y: 0 };
    if (selectedItemsInfo.length === 1) return selectedItemsInfo[0].position;
    
    const bounds = getGroupBoundingBox(selectedItemsInfo);
    return bounds.center;
  }, [selectedItemsInfo]);

  // Check if all selected items are of the same type
  const selectionType = useMemo((): SelectedItemInfo['type'] | 'mixed' | null => {
    if (selectedItemsInfo.length === 0) return null;
    const types = new Set(selectedItemsInfo.map(i => i.type));
    if (types.size === 1) return selectedItemsInfo[0].type;
    return 'mixed';
  }, [selectedItemsInfo]);

  // Calculate delta to align group edge with reference edge
  const calculateGroupAlignmentDelta = useCallback((
    referencePos: Point,
    referenceDims: { width: number; height: number },
    referenceRotation: number,
    alignmentEdge: AlignmentEdge
  ): Point => {
    if (selectedItemsInfo.length === 0) return { x: 0, y: 0 };

    const groupBounds = getGroupBoundingBox(selectedItemsInfo);
    const refEdges = getObjectEdges(referencePos, referenceDims, referenceRotation);

    switch (alignmentEdge) {
      case 'left':
        return { x: refEdges.left - groupBounds.left, y: 0 };
      case 'right':
        return { x: refEdges.right - groupBounds.right, y: 0 };
      case 'top':
        return { x: 0, y: refEdges.top - groupBounds.top };
      case 'bottom':
        return { x: 0, y: refEdges.bottom - groupBounds.bottom };
    }
  }, [selectedItemsInfo]);

  return {
    selectedIds,
    setSelectedIds,
    primarySelectedId,
    clearSelection,
    selectSingle,
    toggleSelection,
    addToSelection,
    isSelected,
    getItemInfo,
    selectedItemsInfo,
    groupBoundingBox,
    selectionCenter,
    selectionType,
    selectionCount: selectedIds.size,
    calculateGroupAlignmentDelta,
  };
}
