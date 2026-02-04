import { useRef, useEffect, useState } from 'react';
import { Tool, ViewState, Point, ScaleInfo, PVPanelConfig, RoofMask, PVArrayItem, EquipmentItem, SupplyLine, EquipmentType, PlantSetupConfig, PlacedWalkway, PlacedCableTray, WalkwayConfig, CableTrayConfig, BatchPlacementConfig, LayerVisibility, defaultLayerVisibility, SubgroupVisibility } from '../types';
import { renderAllMarkups, drawPvArray, drawEquipmentIcon, drawWalkway, drawCableTray } from '../utils/drawing';
import { calculatePolygonArea, calculateLineLength, distance, distanceToPolyline, calculateArrayRotationForRoof, isPointInPolygon, snapTo45Degrees, getPVArrayCorners, snapPVArrayToSpacing, snapEquipmentToSpacing, snapMaterialToSpacing, getPVArrayDimensions, getEquipmentDimensions, detectClickedEdge, snapCablePointToTarget, CableType } from '../utils/geometry';
import { EQUIPMENT_REAL_WORLD_SIZES } from '../constants';
import { PVArrayConfig } from './PVArrayModal';
import { AlignmentEdge } from './AlignEdgesModal';

interface CanvasProps {
  backgroundImage: string | null;
  activeTool: Tool;
  viewState: ViewState;
  setViewState: (vs: ViewState) => void;
  scaleInfo: ScaleInfo;
  scaleLine: { start: Point; end: Point } | null;
  setScaleLine: (line: { start: Point; end: Point } | null) => void;
  onScaleComplete: (pixelDistance: number) => void;
  pvPanelConfig: PVPanelConfig | null;
  roofMasks: RoofMask[];
  setRoofMasks: (updater: (prev: RoofMask[]) => RoofMask[]) => void;
  pvArrays: PVArrayItem[];
  setPvArrays: (updater: (prev: PVArrayItem[]) => PVArrayItem[]) => void;
  equipment: EquipmentItem[];
  setEquipment: (updater: (prev: EquipmentItem[]) => EquipmentItem[]) => void;
  lines: SupplyLine[];
  setLines: (updater: (prev: SupplyLine[]) => SupplyLine[]) => void;
  selectedItemId: string | null;
  setSelectedItemId: (id: string | null) => void;
  selectedItemIds?: Set<string>;
  onToggleSelection?: (id: string) => void;
  onBoxSelection?: (ids: string[], addToSelection: boolean) => void;
  placementRotation: number;
  pendingPvArrayConfig: PVArrayConfig | null;
  onRoofMaskComplete: (points: Point[], area: number) => void;
  onRoofDirectionComplete: (direction: number) => void;
  onArrayPlaced: () => void;
  pendingRoofMaskPoints?: Point[];
  onPVArrayDoubleClick?: (arrayId: string) => void;
  onCopyPvArray?: (array: PVArrayItem) => void;
  onCopyRoofMask?: (mask: RoofMask) => void;
  plantSetupConfig?: PlantSetupConfig;
  // Walkway and cable tray props
  placedWalkways?: PlacedWalkway[];
  setPlacedWalkways?: (updater: (prev: PlacedWalkway[]) => PlacedWalkway[]) => void;
  placedCableTrays?: PlacedCableTray[];
  setPlacedCableTrays?: (updater: (prev: PlacedCableTray[]) => PlacedCableTray[]) => void;
  pendingWalkwayConfig?: WalkwayConfig | null;
  pendingCableTrayConfig?: CableTrayConfig | null;
  placementMinSpacing?: number;
  // Batch placement for multi-copy
  pendingBatchPlacement?: BatchPlacementConfig | null;
  onBatchPlaced?: () => void;
  // Dimension tool
  onDimensionObjectClick?: (id: string) => void;
  dimensionObject1Id?: string | null;
  dimensionObject2Id?: string | null;
  // Align edges tool
  onAlignEdgesObjectClick?: (id: string, clickedEdge: AlignmentEdge | null) => void;
  alignObject1Id?: string | null;
  alignObject2Id?: string | null;
  alignEdge1?: AlignmentEdge | null;
  alignEdge2?: AlignmentEdge | null;
  // Layer visibility
  layerVisibility?: LayerVisibility;
  // Subgroup visibility for filtering walkways/cable trays by configId
  subgroupVisibility?: SubgroupVisibility;
}

export function Canvas({
  backgroundImage, activeTool, viewState, setViewState,
  scaleInfo, scaleLine, setScaleLine, onScaleComplete,
  pvPanelConfig, roofMasks, setRoofMasks, pvArrays, setPvArrays,
  equipment, setEquipment, lines, setLines,
  selectedItemId, setSelectedItemId, selectedItemIds, onToggleSelection, onBoxSelection, placementRotation,
  pendingPvArrayConfig, onRoofMaskComplete, onRoofDirectionComplete, onArrayPlaced,
  pendingRoofMaskPoints, onPVArrayDoubleClick, onCopyPvArray, onCopyRoofMask,
  plantSetupConfig,
  placedWalkways, setPlacedWalkways,
  placedCableTrays, setPlacedCableTrays,
  pendingWalkwayConfig, pendingCableTrayConfig,
  placementMinSpacing = 0.3,
  pendingBatchPlacement,
  onBatchPlaced,
  onDimensionObjectClick,
  dimensionObject1Id,
  dimensionObject2Id,
  onAlignEdgesObjectClick,
  alignObject1Id,
  alignObject2Id,
  alignEdge1,
  alignEdge2,
  layerVisibility = defaultLayerVisibility,
  subgroupVisibility,
}: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
  const prevContainerSizeRef = useRef<{ width: number; height: number } | null>(null);
  
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState<Point>({ x: 0, y: 0 });
  const [currentDrawing, setCurrentDrawing] = useState<Point[]>([]);
  const [previewPoint, setPreviewPoint] = useState<Point | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  const [isShiftHeld, setIsShiftHeld] = useState(false);
  const [directionLine, setDirectionLine] = useState<{ start: Point; end: Point } | null>(null);
  const [draggingPvArrayId, setDraggingPvArrayId] = useState<string | null>(null);
  const [pvArrayDragOffset, setPvArrayDragOffset] = useState<Point | null>(null);
  const [draggingEquipmentId, setDraggingEquipmentId] = useState<string | null>(null);
  const [equipmentDragOffset, setEquipmentDragOffset] = useState<Point | null>(null);
  const [draggingWalkwayId, setDraggingWalkwayId] = useState<string | null>(null);
  const [walkwayDragOffset, setWalkwayDragOffset] = useState<Point | null>(null);
  const [draggingCableTrayId, setDraggingCableTrayId] = useState<string | null>(null);
  const [cableTrayDragOffset, setCableTrayDragOffset] = useState<Point | null>(null);
  const [mouseWorldPos, setMouseWorldPos] = useState<Point | null>(null);
  
  // Marquee selection state
  const [marqueeStart, setMarqueeStart] = useState<Point | null>(null);
  const [marqueeEnd, setMarqueeEnd] = useState<Point | null>(null);
  
  // Group dragging state - for moving multiple selected items together
  const [isGroupDragging, setIsGroupDragging] = useState(false);
  const [groupDragStart, setGroupDragStart] = useState<Point | null>(null);
  const [groupDragInitialPositions, setGroupDragInitialPositions] = useState<Map<string, Point>>(new Map());

  const SNAP_THRESHOLD = 15; // pixels in screen space

  // Calculate azimuth from a direction line (from high to low point)
  // Returns degrees where 0=North, 90=East, 180=South, 270=West
  const calculateAzimuth = (start: Point, end: Point): number => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    // atan2 gives angle from positive X-axis, counterclockwise
    // We want angle from positive Y-axis (North), clockwise
    // Canvas Y is inverted (down is positive)
    const angleRad = Math.atan2(dx, -dy); // Note: -dy because canvas Y is flipped
    let angleDeg = angleRad * (180 / Math.PI);
    // Normalize to 0-360
    if (angleDeg < 0) angleDeg += 360;
    return Math.round(angleDeg);
  };

  // Complete the current drawing (for roof mask or line tools)
  const completeDrawing = () => {
    if (currentDrawing.length >= 3 && activeTool === Tool.ROOF_MASK) {
      const area = calculatePolygonArea(currentDrawing, scaleInfo.ratio);
      onRoofMaskComplete(currentDrawing, area);
      setCurrentDrawing([]);
      setPreviewPoint(null);
    } else if (currentDrawing.length >= 2 && (activeTool === Tool.LINE_DC || activeTool === Tool.LINE_AC)) {
      const newLine: SupplyLine = {
        id: `line-${Date.now()}`,
        name: `${activeTool === Tool.LINE_DC ? 'DC' : 'AC'} Cable`,
        type: activeTool === Tool.LINE_DC ? 'dc' : 'ac',
        points: currentDrawing,
        length: calculateLineLength(currentDrawing, scaleInfo.ratio),
      };
      setLines(prev => [...prev, newLine]);
      setCurrentDrawing([]);
      setPreviewPoint(null);
    }
  };

  // Cancel the current drawing
  const cancelDrawing = () => {
    setCurrentDrawing([]);
    setPreviewPoint(null);
  };

  // Track Shift key state for 45-degree angle snapping + Enter/Escape for drawing completion
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftHeld(true);
      if (e.key === 'Enter' && currentDrawing.length >= 3) {
        e.preventDefault();
        completeDrawing();
      }
      if (e.key === 'Escape' && currentDrawing.length > 0) {
        e.preventDefault();
        cancelDrawing();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftHeld(false);
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [currentDrawing, activeTool, scaleInfo.ratio]);

  // ResizeObserver to detect container size changes (e.g., when Summary panel collapses)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    // Set initial size immediately
    const rect = container.getBoundingClientRect();
    setContainerSize({ width: rect.width, height: rect.height });
    prevContainerSizeRef.current = { width: rect.width, height: rect.height };
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setContainerSize({ width, height });
      }
    });
    
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // When the container resizes (e.g. right summary pane collapses), preserve the *viewport center*
  // so the background appears to shift consistently instead of staying anchored to the left.
  useEffect(() => {
    if (!backgroundImage) return;

    const prev = prevContainerSizeRef.current;
    if (!prev) {
      prevContainerSizeRef.current = containerSize;
      return;
    }

    if (prev.width === containerSize.width && prev.height === containerSize.height) return;

    // World coordinate at the center of the old viewport
    const prevCenterScreen = { x: prev.width / 2, y: prev.height / 2 };
    const worldCenter = {
      x: (prevCenterScreen.x - viewState.offset.x) / viewState.zoom,
      y: (prevCenterScreen.y - viewState.offset.y) / viewState.zoom,
    };

    // New offset that keeps the same world center in the center of the new viewport
    const nextOffset = {
      x: containerSize.width / 2 - worldCenter.x * viewState.zoom,
      y: containerSize.height / 2 - worldCenter.y * viewState.zoom,
    };

    prevContainerSizeRef.current = containerSize;
    setViewState({ ...viewState, offset: nextOffset });
  }, [containerSize.width, containerSize.height, backgroundImage, viewState, setViewState]);

  // Render background image
  useEffect(() => {
    if (!backgroundImage || !pdfCanvasRef.current) return;
    
    const img = new Image();
    img.onload = () => {
      const canvas = pdfCanvasRef.current!;
      const ctx = canvas.getContext('2d')!;
      canvas.width = img.width;
      canvas.height = img.height;
      setCanvasSize({ width: img.width, height: img.height });
      ctx.drawImage(img, 0, 0);
    };
    img.src = backgroundImage;
  }, [backgroundImage]);

  // Render drawings - uses context transforms, not CSS
  useEffect(() => {
    const canvas = drawingCanvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    
    // Use containerSize state directly for proper reactivity when panels collapse/expand
    canvas.width = containerSize.width;
    canvas.height = containerSize.height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(viewState.offset.x, viewState.offset.y);
    ctx.scale(viewState.zoom, viewState.zoom);
    
    renderAllMarkups(ctx, {
      equipment, lines, roofMasks, pvArrays,
      scaleInfo, pvPanelConfig, zoom: viewState.zoom,
      selectedItemId, selectedItemIds, scaleLine, plantSetupConfig,
      placedWalkways, placedCableTrays,
      dimensionObject1Id, dimensionObject2Id,
      alignObject1Id, alignObject2Id,
      alignEdge1, alignEdge2,
      layerVisibility,
      subgroupVisibility,
    });
    
    // Draw current drawing in progress
    if (currentDrawing.length > 0) {
      ctx.strokeStyle = activeTool === Tool.ROOF_MASK ? '#9470d8' : '#f97316';
      ctx.lineWidth = 2 / viewState.zoom;
      ctx.beginPath();
      ctx.moveTo(currentDrawing[0].x, currentDrawing[0].y);
      currentDrawing.forEach(p => ctx.lineTo(p.x, p.y));
      if (previewPoint) ctx.lineTo(previewPoint.x, previewPoint.y);
      ctx.stroke();
      
      // Draw start point indicator for roof mask (visual hint to close polygon)
      if (activeTool === Tool.ROOF_MASK) {
        const startRadius = 8 / viewState.zoom;
        ctx.beginPath();
        ctx.arc(currentDrawing[0].x, currentDrawing[0].y, startRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(148, 112, 216, 0.6)';
        ctx.fill();
        ctx.strokeStyle = '#9470d8';
        ctx.lineWidth = 2 / viewState.zoom;
        ctx.stroke();
      }
    }

    // Draw pending roof mask outline when in direction mode
    if (activeTool === Tool.ROOF_DIRECTION && pendingRoofMaskPoints && pendingRoofMaskPoints.length >= 3) {
      ctx.strokeStyle = '#9470d8';
      ctx.lineWidth = 2 / viewState.zoom;
      ctx.setLineDash([5 / viewState.zoom, 5 / viewState.zoom]);
      ctx.beginPath();
      ctx.moveTo(pendingRoofMaskPoints[0].x, pendingRoofMaskPoints[0].y);
      pendingRoofMaskPoints.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Fill with semi-transparent
      ctx.fillStyle = 'rgba(148, 112, 216, 0.15)';
      ctx.fill();
    }

    // Draw direction line
    if (directionLine) {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 3 / viewState.zoom;
      ctx.beginPath();
      ctx.moveTo(directionLine.start.x, directionLine.start.y);
      ctx.lineTo(directionLine.end.x, directionLine.end.y);
      ctx.stroke();
      
      // Draw arrow head at end
      const dx = directionLine.end.x - directionLine.start.x;
      const dy = directionLine.end.y - directionLine.start.y;
      const angle = Math.atan2(dy, dx);
      const arrowSize = 15 / viewState.zoom;
      
      ctx.beginPath();
      ctx.moveTo(directionLine.end.x, directionLine.end.y);
      ctx.lineTo(
        directionLine.end.x - arrowSize * Math.cos(angle - Math.PI / 6),
        directionLine.end.y - arrowSize * Math.sin(angle - Math.PI / 6)
      );
      ctx.moveTo(directionLine.end.x, directionLine.end.y);
      ctx.lineTo(
        directionLine.end.x - arrowSize * Math.cos(angle + Math.PI / 6),
        directionLine.end.y - arrowSize * Math.sin(angle + Math.PI / 6)
      );
      ctx.stroke();
      
      // Draw start point (high point)
      ctx.beginPath();
      ctx.arc(directionLine.start.x, directionLine.start.y, 6 / viewState.zoom, 0, Math.PI * 2);
      ctx.fillStyle = '#22c55e';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2 / viewState.zoom;
      ctx.stroke();
    }
    
    // Draw ghost preview for PV array placement
    if (activeTool === Tool.PV_ARRAY && pendingPvArrayConfig && pvPanelConfig && mouseWorldPos && scaleInfo.ratio) {
      const onMask = roofMasks.find(m => isPointInPolygon(mouseWorldPos, m.points));
      
      // Calculate base rotation from roof direction + manual adjustment
      const autoRotation = onMask ? calculateArrayRotationForRoof(mouseWorldPos, roofMasks, 0) : 0;
      const baseRotation = (autoRotation + placementRotation) % 360;
      
      // Apply snapping to adjacent arrays if minSpacing is set OR Shift is held
      const minSpacing = pendingPvArrayConfig.minSpacing ?? 0;
      const snapResult = snapPVArrayToSpacing(
        mouseWorldPos,
        { 
          rows: pendingPvArrayConfig.rows, 
          columns: pendingPvArrayConfig.columns, 
          orientation: pendingPvArrayConfig.orientation,
          rotation: baseRotation,
        },
        pvArrays,
        pvPanelConfig,
        roofMasks,
        scaleInfo,
        minSpacing,
        isShiftHeld // Force align when Shift is held
      );
      
      // Use snapped rotation if snapped to an array, otherwise use base rotation
      const finalRotation = snapResult.snappedToId ? snapResult.rotation : baseRotation;
      
      const ghostArray: PVArrayItem = {
        id: 'ghost-preview',
        position: snapResult.position,
        rows: pendingPvArrayConfig.rows,
        columns: pendingPvArrayConfig.columns,
        orientation: pendingPvArrayConfig.orientation,
        rotation: finalRotation,
        roofMaskId: onMask?.id,
      };
      
      drawPvArray(ctx, ghostArray, true, pvPanelConfig, scaleInfo, roofMasks, viewState.zoom, false);
    }

    // Draw ghost preview for equipment placement
    const equipmentPlacementTools = [Tool.PLACE_INVERTER, Tool.PLACE_DC_COMBINER, Tool.PLACE_AC_DISCONNECT, Tool.PLACE_MAIN_BOARD];
    if (equipmentPlacementTools.includes(activeTool) && mouseWorldPos) {
      const typeMap: Record<Tool, EquipmentType> = {
        [Tool.PLACE_INVERTER]: EquipmentType.INVERTER,
        [Tool.PLACE_DC_COMBINER]: EquipmentType.DC_COMBINER,
        [Tool.PLACE_AC_DISCONNECT]: EquipmentType.AC_DISCONNECT,
        [Tool.PLACE_MAIN_BOARD]: EquipmentType.MAIN_BOARD,
      } as Record<Tool, EquipmentType>;
      
      const eqType = typeMap[activeTool];
      if (eqType) {
        // Apply snapping for equipment placement
        const equipmentMinSpacing = 0.3; // 30cm default spacing between equipment
        const snapResult = snapEquipmentToSpacing(
          mouseWorldPos,
          eqType,
          placementRotation,
          equipment,
          scaleInfo,
          equipmentMinSpacing,
          isShiftHeld,
          plantSetupConfig
        );
        
        ctx.globalAlpha = 0.6;
        drawEquipmentIcon(
          ctx,
          { type: eqType, position: snapResult.position, rotation: snapResult.rotation },
          false,
          viewState.zoom,
          scaleInfo,
          plantSetupConfig
        );
        ctx.globalAlpha = 1.0;
      }
    }

    // Draw ghost preview for walkway placement with snapping
    if (activeTool === Tool.PLACE_WALKWAY && mouseWorldPos && pendingWalkwayConfig && scaleInfo.ratio) {
      // Apply snapping to other walkways
      const snapResult = snapMaterialToSpacing(
        mouseWorldPos,
        { width: pendingWalkwayConfig.width, length: pendingWalkwayConfig.length, rotation: placementRotation },
        placedWalkways || [],
        scaleInfo,
        placementMinSpacing,
        isShiftHeld
      );
      
      const ghostWalkway: PlacedWalkway = {
        id: 'ghost-walkway',
        configId: pendingWalkwayConfig.id,
        name: pendingWalkwayConfig.name,
        width: pendingWalkwayConfig.width,
        length: pendingWalkwayConfig.length,
        position: snapResult.position,
        rotation: snapResult.snappedToId ? snapResult.rotation : placementRotation,
      };
      drawWalkway(ctx, ghostWalkway, false, true, viewState.zoom, scaleInfo);
    }

    // Draw ghost preview for cable tray placement with snapping
    if (activeTool === Tool.PLACE_CABLE_TRAY && mouseWorldPos && pendingCableTrayConfig && scaleInfo.ratio) {
      // Apply snapping to other cable trays
      const snapResult = snapMaterialToSpacing(
        mouseWorldPos,
        { width: pendingCableTrayConfig.width, length: pendingCableTrayConfig.length, rotation: placementRotation },
        placedCableTrays || [],
        scaleInfo,
        placementMinSpacing,
        isShiftHeld
      );
      
      const ghostTray: PlacedCableTray = {
        id: 'ghost-tray',
        configId: pendingCableTrayConfig.id,
        name: pendingCableTrayConfig.name,
        width: pendingCableTrayConfig.width,
        length: pendingCableTrayConfig.length,
        position: snapResult.position,
        rotation: snapResult.snappedToId ? snapResult.rotation : placementRotation,
      };
      drawCableTray(ctx, ghostTray, false, true, viewState.zoom, scaleInfo);
    }

    // Draw ghost preview for batch placement (multi-copy)
    if (activeTool === Tool.PV_ARRAY && pendingBatchPlacement && mouseWorldPos && scaleInfo.ratio) {
      ctx.globalAlpha = 0.6;
      
      pendingBatchPlacement.items.forEach(item => {
        const itemPos = {
          x: mouseWorldPos.x + item.offset.x,
          y: mouseWorldPos.y + item.offset.y,
        };
        
        if (item.type === 'pvArray' && item.pvArrayConfig && pvPanelConfig) {
          const onMask = roofMasks.find(m => isPointInPolygon(itemPos, m.points));
          const ghostArray: PVArrayItem = {
            id: `ghost-batch-${item.id}`,
            position: itemPos,
            rows: item.pvArrayConfig.rows,
            columns: item.pvArrayConfig.columns,
            orientation: item.pvArrayConfig.orientation,
            rotation: item.rotation + placementRotation,
            roofMaskId: onMask?.id,
          };
          drawPvArray(ctx, ghostArray, true, pvPanelConfig, scaleInfo, roofMasks, viewState.zoom, false);
        }
        
        if (item.type === 'equipment' && item.equipmentConfig) {
          drawEquipmentIcon(
            ctx,
            { 
              type: item.equipmentConfig.equipmentType, 
              position: itemPos, 
              rotation: item.rotation + placementRotation 
            },
            false,
            viewState.zoom,
            scaleInfo,
            plantSetupConfig
          );
        }
        
        if (item.type === 'walkway' && item.walkwayConfig) {
          const ghostWalkway: PlacedWalkway = {
            id: `ghost-batch-${item.id}`,
            configId: item.walkwayConfig.configId,
            name: item.walkwayConfig.name,
            width: item.walkwayConfig.width,
            length: item.walkwayConfig.length,
            position: itemPos,
            rotation: item.rotation + placementRotation,
          };
          drawWalkway(ctx, ghostWalkway, false, true, viewState.zoom, scaleInfo);
        }
        
        if (item.type === 'cableTray' && item.cableTrayConfig) {
          const ghostTray: PlacedCableTray = {
            id: `ghost-batch-${item.id}`,
            configId: item.cableTrayConfig.configId,
            name: item.cableTrayConfig.name,
            width: item.cableTrayConfig.width,
            length: item.cableTrayConfig.length,
            position: itemPos,
            rotation: item.rotation + placementRotation,
          };
          drawCableTray(ctx, ghostTray, false, true, viewState.zoom, scaleInfo);
        }
      });
      
      ctx.globalAlpha = 1.0;
    }

    // Draw ghost preview for cable placement (before first point and during drawing)
    if ((activeTool === Tool.LINE_DC || activeTool === Tool.LINE_AC) && mouseWorldPos) {
      const cableType: CableType = activeTool === Tool.LINE_DC ? 'dc' : 'ac';
      const snapResult = snapCablePointToTarget(
        mouseWorldPos,
        cableType,
        equipment,
        pvArrays,
        pvPanelConfig,
        roofMasks,
        scaleInfo,
        viewState,
        plantSetupConfig
      );
      
      // Draw snap indicator if snapped to a target
      if (snapResult.snappedToId) {
        // Draw glowing ring around snap point
        ctx.beginPath();
        ctx.arc(snapResult.position.x, snapResult.position.y, 12 / viewState.zoom, 0, Math.PI * 2);
        ctx.strokeStyle = cableType === 'dc' ? '#ef4444' : '#22c55e'; // Red for DC, Green for AC
        ctx.lineWidth = 3 / viewState.zoom;
        ctx.stroke();
        
        // Inner filled circle
        ctx.beginPath();
        ctx.arc(snapResult.position.x, snapResult.position.y, 6 / viewState.zoom, 0, Math.PI * 2);
        ctx.fillStyle = cableType === 'dc' ? 'rgba(239, 68, 68, 0.6)' : 'rgba(34, 197, 94, 0.6)';
        ctx.fill();
      } else {
        // Draw crosshair at current position when not snapping
        const crossSize = 8 / viewState.zoom;
        ctx.strokeStyle = cableType === 'dc' ? '#ef4444' : '#22c55e';
        ctx.lineWidth = 1.5 / viewState.zoom;
        
        // Horizontal line
        ctx.beginPath();
        ctx.moveTo(mouseWorldPos.x - crossSize, mouseWorldPos.y);
        ctx.lineTo(mouseWorldPos.x + crossSize, mouseWorldPos.y);
        ctx.stroke();
        
        // Vertical line
        ctx.beginPath();
        ctx.moveTo(mouseWorldPos.x, mouseWorldPos.y - crossSize);
        ctx.lineTo(mouseWorldPos.x, mouseWorldPos.y + crossSize);
        ctx.stroke();
      }
    }
    
    // Draw marquee selection box
    if (marqueeStart && marqueeEnd) {
      const minX = Math.min(marqueeStart.x, marqueeEnd.x);
      const maxX = Math.max(marqueeStart.x, marqueeEnd.x);
      const minY = Math.min(marqueeStart.y, marqueeEnd.y);
      const maxY = Math.max(marqueeStart.y, marqueeEnd.y);
      
      ctx.strokeStyle = '#3b82f6';
      ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
      ctx.lineWidth = 1.5 / viewState.zoom;
      ctx.setLineDash([6 / viewState.zoom, 4 / viewState.zoom]);
      
      ctx.beginPath();
      ctx.rect(minX, minY, maxX - minX, maxY - minY);
      ctx.fill();
      ctx.stroke();
      
      ctx.setLineDash([]);
    }
    
    ctx.restore();
  }, [
    viewState,
    equipment,
    lines,
    roofMasks,
    pvArrays,
    scaleInfo,
    pvPanelConfig,
    selectedItemId,
    selectedItemIds,
    scaleLine,
    currentDrawing,
    previewPoint,
    canvasSize,
    containerSize,
    activeTool,
    pendingRoofMaskPoints,
    directionLine,
    mouseWorldPos,
    pendingPvArrayConfig,
    pendingBatchPlacement,
    placementRotation,
    placedWalkways,
    placedCableTrays,
    pendingWalkwayConfig,
    pendingCableTrayConfig,
    plantSetupConfig,
    dimensionObject1Id,
    dimensionObject2Id,
    alignObject1Id,
    alignObject2Id,
    alignEdge1,
    alignEdge2,
    marqueeStart,
    marqueeEnd,
    layerVisibility,
  ]);

  const getMousePos = (e: React.MouseEvent): Point => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const toWorld = (p: Point): Point => ({
    x: (p.x - viewState.offset.x) / viewState.zoom,
    y: (p.y - viewState.offset.y) / viewState.zoom,
  });

  const handleMouseDown = (e: React.MouseEvent) => {
    const screenPos = getMousePos(e);
    const worldPos = toWorld(screenPos);
    setLastMousePos(screenPos);

    // Selection + dragging
    if (activeTool === Tool.SELECT && e.button === 0) {
      const isMultiSelectModifier = e.shiftKey || e.ctrlKey || e.metaKey;
      
      // Helper to start group dragging for all selected items
      const startGroupDrag = () => {
        if (!selectedItemIds || selectedItemIds.size <= 1) return;
        
        // Store initial positions of all selected items
        const initialPositions = new Map<string, Point>();
        
        pvArrays.forEach(arr => {
          if (selectedItemIds.has(arr.id)) {
            initialPositions.set(arr.id, { ...arr.position });
          }
        });
        equipment.forEach(eq => {
          if (selectedItemIds.has(eq.id)) {
            initialPositions.set(eq.id, { ...eq.position });
          }
        });
        placedWalkways?.forEach(w => {
          if (selectedItemIds.has(w.id)) {
            initialPositions.set(w.id, { ...w.position });
          }
        });
        placedCableTrays?.forEach(t => {
          if (selectedItemIds.has(t.id)) {
            initialPositions.set(t.id, { ...t.position });
          }
        });
        roofMasks.forEach(m => {
          if (selectedItemIds.has(m.id)) {
            // For roof masks, store center as reference
            const cx = m.points.reduce((s, p) => s + p.x, 0) / m.points.length;
            const cy = m.points.reduce((s, p) => s + p.y, 0) / m.points.length;
            initialPositions.set(m.id, { x: cx, y: cy });
          }
        });
        // Include cables/lines - use first point as reference position
        lines.forEach(line => {
          if (selectedItemIds.has(line.id) && line.points.length > 0) {
            initialPositions.set(line.id, { ...line.points[0] });
          }
        });
        
        setIsGroupDragging(true);
        setGroupDragStart(worldPos);
        setGroupDragInitialPositions(initialPositions);
      };
      
      // Helper to handle selection based on modifier keys
      const handleItemSelection = (id: string, startSingleDrag: () => void) => {
        if (isMultiSelectModifier && onToggleSelection) {
          // Shift/Ctrl+Click: toggle selection
          onToggleSelection(id);
          // Don't start drag when toggling
        } else if (selectedItemIds && selectedItemIds.size > 1 && selectedItemIds.has(id)) {
          // Clicking on already-selected item in multi-selection: start group drag
          startGroupDrag();
        } else {
          // Normal click: select single and start single-item drag
          setSelectedItemId(id);
          startSingleDrag();
        }
      };
      
      // Prefer selecting PV arrays first (topmost) - only if layer is visible
      const hitArray = (pvPanelConfig && scaleInfo.ratio && layerVisibility.pvArrays)
        ? [...pvArrays].reverse().find(arr => {
            const corners = getPVArrayCorners(arr, pvPanelConfig, roofMasks, scaleInfo);
            return corners.length === 4 && isPointInPolygon(worldPos, corners);
          })
        : undefined;

      if (hitArray) {
        handleItemSelection(hitArray.id, () => {
          setDraggingPvArrayId(hitArray.id);
          setPvArrayDragOffset({ x: worldPos.x - hitArray.position.x, y: worldPos.y - hitArray.position.y });
        });
        return;
      }

      // Select walkways (higher priority than roof masks since they sit inside them) - only if layer is visible
      if (placedWalkways && scaleInfo.ratio && layerVisibility.walkways) {
        const hitWalkway = [...placedWalkways].reverse().find(walkway => {
          const widthPx = walkway.width / scaleInfo.ratio!;
          const lengthPx = walkway.length / scaleInfo.ratio!;
          const halfW = widthPx / 2;
          const halfL = lengthPx / 2;

          // Transform click point to walkway's local coordinate system
          const rotation = (walkway.rotation || 0) * Math.PI / 180;
          const dx = worldPos.x - walkway.position.x;
          const dy = worldPos.y - walkway.position.y;
          const localX = dx * Math.cos(-rotation) - dy * Math.sin(-rotation);
          const localY = dx * Math.sin(-rotation) + dy * Math.cos(-rotation);

          return Math.abs(localX) <= halfW && Math.abs(localY) <= halfL;
        });

        if (hitWalkway) {
          handleItemSelection(hitWalkway.id, () => {
            setDraggingWalkwayId(hitWalkway.id);
            setWalkwayDragOffset({
              x: worldPos.x - hitWalkway.position.x,
              y: worldPos.y - hitWalkway.position.y,
            });
          });
          return;
        }
      }

      // Select cable trays (higher priority than roof masks) - only if layer is visible
      if (placedCableTrays && scaleInfo.ratio && layerVisibility.cableTrays) {
        const hitTray = [...placedCableTrays].reverse().find(tray => {
          const widthPx = tray.width / scaleInfo.ratio!;
          const lengthPx = tray.length / scaleInfo.ratio!;
          const halfW = widthPx / 2;
          const halfL = lengthPx / 2;

          // Transform click point to tray's local coordinate system
          const rotation = (tray.rotation || 0) * Math.PI / 180;
          const dx = worldPos.x - tray.position.x;
          const dy = worldPos.y - tray.position.y;
          const localX = dx * Math.cos(-rotation) - dy * Math.sin(-rotation);
          const localY = dx * Math.sin(-rotation) + dy * Math.cos(-rotation);

          return Math.abs(localX) <= halfW && Math.abs(localY) <= halfL;
        });

        if (hitTray) {
          handleItemSelection(hitTray.id, () => {
            setDraggingCableTrayId(hitTray.id);
            setCableTrayDragOffset({
              x: worldPos.x - hitTray.position.x,
              y: worldPos.y - hitTray.position.y,
            });
          });
          return;
        }
      }

      // Select equipment (inverters, etc.) - checked BEFORE roof masks - only if layer is visible
      const hitEquipment = layerVisibility.equipment
        ? [...equipment].reverse().find(item => {
            // Calculate size in pixels based on real-world size and scale
            const realSize = EQUIPMENT_REAL_WORLD_SIZES[item.type] || 0.5;
            // Convert real size to world units (pixels at zoom=1)
            const sizePx = scaleInfo.ratio ? realSize / scaleInfo.ratio : 20;
            const padding = 5 / viewState.zoom; // Small padding for easier selection
            const halfSize = sizePx / 2 + padding;
            
            return Math.abs(worldPos.x - item.position.x) <= halfSize &&
                   Math.abs(worldPos.y - item.position.y) <= halfSize;
          })
        : undefined;

      if (hitEquipment) {
        handleItemSelection(hitEquipment.id, () => {
          setDraggingEquipmentId(hitEquipment.id);
          setEquipmentDragOffset({ 
            x: worldPos.x - hitEquipment.position.x, 
            y: worldPos.y - hitEquipment.position.y 
          });
        });
        return;
      }

      // Select cables/lines (between equipment and roof masks) - only if layer is visible and thickness is visible
      if (lines && lines.length > 0 && layerVisibility.cables) {
        const cableHitThreshold = 8 / viewState.zoom; // 8 pixels for easy clicking
        const hitLine = [...lines].reverse().find(line => {
          if (line.points.length < 2) return false;
          // Check thickness visibility
          const thickness = line.thickness || 6;
          if (line.type === 'dc' && subgroupVisibility?.dcCableThicknesses?.[thickness] === false) return false;
          if (line.type === 'ac' && subgroupVisibility?.acCableThicknesses?.[thickness] === false) return false;
          const dist = distanceToPolyline(worldPos, line.points);
          return dist <= cableHitThreshold;
        });
        
        if (hitLine) {
          handleItemSelection(hitLine.id, () => {});
          return;
        }
      }

      // Fallback: select roof mask (lowest priority) - only if layer is visible
      if (layerVisibility.roofMasks) {
        const hitMask = [...roofMasks].reverse().find(m => isPointInPolygon(worldPos, m.points));
        if (hitMask) {
          handleItemSelection(hitMask.id, () => {});
          return;
        }
      }

      // Clicked empty space - start marquee selection
      setMarqueeStart(worldPos);
      setMarqueeEnd(worldPos);
      return;
    }

    // Dimension tool - select objects to measure/set distance between
    if (activeTool === Tool.DIMENSION && onDimensionObjectClick && e.button === 0) {
      // Check PV arrays (only if layer is visible)
      if (layerVisibility.pvArrays) {
        const hitArray = (pvPanelConfig && scaleInfo.ratio)
          ? [...pvArrays].reverse().find(arr => {
              const corners = getPVArrayCorners(arr, pvPanelConfig, roofMasks, scaleInfo);
              return corners.length === 4 && isPointInPolygon(worldPos, corners);
            })
          : undefined;
        if (hitArray) {
          onDimensionObjectClick(hitArray.id);
          return;
        }
      }

      // Check walkways (only if layer is visible)
      if (placedWalkways && scaleInfo.ratio && layerVisibility.walkways) {
        const hitWalkway = [...placedWalkways].reverse().find(walkway => {
          const widthPx = walkway.width / scaleInfo.ratio!;
          const lengthPx = walkway.length / scaleInfo.ratio!;
          const halfW = widthPx / 2;
          const halfL = lengthPx / 2;
          const rotation = (walkway.rotation || 0) * Math.PI / 180;
          const dx = worldPos.x - walkway.position.x;
          const dy = worldPos.y - walkway.position.y;
          const localX = dx * Math.cos(-rotation) - dy * Math.sin(-rotation);
          const localY = dx * Math.sin(-rotation) + dy * Math.cos(-rotation);
          return Math.abs(localX) <= halfW && Math.abs(localY) <= halfL;
        });
        if (hitWalkway) {
          onDimensionObjectClick(hitWalkway.id);
          return;
        }
      }

      // Check cable trays (only if layer is visible)
      if (placedCableTrays && scaleInfo.ratio && layerVisibility.cableTrays) {
        const hitTray = [...placedCableTrays].reverse().find(tray => {
          const widthPx = tray.width / scaleInfo.ratio!;
          const lengthPx = tray.length / scaleInfo.ratio!;
          const halfW = widthPx / 2;
          const halfL = lengthPx / 2;
          const rotation = (tray.rotation || 0) * Math.PI / 180;
          const dx = worldPos.x - tray.position.x;
          const dy = worldPos.y - tray.position.y;
          const localX = dx * Math.cos(-rotation) - dy * Math.sin(-rotation);
          const localY = dx * Math.sin(-rotation) + dy * Math.cos(-rotation);
          return Math.abs(localX) <= halfW && Math.abs(localY) <= halfL;
        });
        if (hitTray) {
          onDimensionObjectClick(hitTray.id);
          return;
        }
      }

      // Check equipment (only if layer is visible)
      if (layerVisibility.equipment) {
        const hitEquipment = [...equipment].reverse().find(item => {
          const realSize = EQUIPMENT_REAL_WORLD_SIZES[item.type] || 0.5;
          const sizePx = scaleInfo.ratio ? realSize / scaleInfo.ratio : 20;
          const halfSize = sizePx / 2;
          return Math.abs(worldPos.x - item.position.x) <= halfSize &&
                 Math.abs(worldPos.y - item.position.y) <= halfSize;
        });
        if (hitEquipment) {
          onDimensionObjectClick(hitEquipment.id);
          return;
        }
      }

      return;
    }

    // Align edges tool - select objects to align edges between
    if (activeTool === Tool.ALIGN_EDGES && onAlignEdgesObjectClick && e.button === 0) {
      // Calculate edge threshold based on zoom (consistent screen-space click target)
      // Use 15-20% of smallest dimension, clamped between 10-30 pixels in screen space
      const baseThresholdScreenPx = 20; // pixels in screen space
      const edgeThresholdWorld = baseThresholdScreenPx / viewState.zoom;
      
      // Check PV arrays (only if layer is visible)
      if (layerVisibility.pvArrays) {
        const hitArray = (pvPanelConfig && scaleInfo.ratio)
          ? [...pvArrays].reverse().find(arr => {
              const corners = getPVArrayCorners(arr, pvPanelConfig, roofMasks, scaleInfo);
              return corners.length === 4 && isPointInPolygon(worldPos, corners);
            })
          : undefined;
        if (hitArray && pvPanelConfig && scaleInfo.ratio) {
          const dims = getPVArrayDimensions(hitArray, pvPanelConfig, roofMasks, scaleInfo, hitArray.position);
          const clickedEdge = detectClickedEdge(worldPos, hitArray.position, dims, hitArray.rotation, edgeThresholdWorld);
          onAlignEdgesObjectClick(hitArray.id, clickedEdge);
          return;
        }
      }

      // Check walkways (only if layer is visible)
      if (placedWalkways && scaleInfo.ratio && layerVisibility.walkways) {
        const hitWalkway = [...placedWalkways].reverse().find(walkway => {
          const widthPx = walkway.width / scaleInfo.ratio!;
          const lengthPx = walkway.length / scaleInfo.ratio!;
          const halfW = widthPx / 2;
          const halfL = lengthPx / 2;
          const rotation = (walkway.rotation || 0) * Math.PI / 180;
          const dx = worldPos.x - walkway.position.x;
          const dy = worldPos.y - walkway.position.y;
          const localX = dx * Math.cos(-rotation) - dy * Math.sin(-rotation);
          const localY = dx * Math.sin(-rotation) + dy * Math.cos(-rotation);
          return Math.abs(localX) <= halfW && Math.abs(localY) <= halfL;
        });
        if (hitWalkway) {
          const widthPx = hitWalkway.width / scaleInfo.ratio!;
          const lengthPx = hitWalkway.length / scaleInfo.ratio!;
          const clickedEdge = detectClickedEdge(
            worldPos, 
            hitWalkway.position, 
            { width: widthPx, height: lengthPx }, 
            hitWalkway.rotation || 0, 
            edgeThresholdWorld
          );
          onAlignEdgesObjectClick(hitWalkway.id, clickedEdge);
          return;
        }
      }

      // Check cable trays (only if layer is visible)
      if (placedCableTrays && scaleInfo.ratio && layerVisibility.cableTrays) {
        const hitTray = [...placedCableTrays].reverse().find(tray => {
          const widthPx = tray.width / scaleInfo.ratio!;
          const lengthPx = tray.length / scaleInfo.ratio!;
          const halfW = widthPx / 2;
          const halfL = lengthPx / 2;
          const rotation = (tray.rotation || 0) * Math.PI / 180;
          const dx = worldPos.x - tray.position.x;
          const dy = worldPos.y - tray.position.y;
          const localX = dx * Math.cos(-rotation) - dy * Math.sin(-rotation);
          const localY = dx * Math.sin(-rotation) + dy * Math.cos(-rotation);
          return Math.abs(localX) <= halfW && Math.abs(localY) <= halfL;
        });
        if (hitTray) {
          const widthPx = hitTray.width / scaleInfo.ratio!;
          const lengthPx = hitTray.length / scaleInfo.ratio!;
          const clickedEdge = detectClickedEdge(
            worldPos, 
            hitTray.position, 
            { width: widthPx, height: lengthPx }, 
            hitTray.rotation || 0, 
            edgeThresholdWorld
          );
          onAlignEdgesObjectClick(hitTray.id, clickedEdge);
          return;
        }
      }

      // Check equipment (only if layer is visible)
      if (layerVisibility.equipment) {
        const hitEquipment = [...equipment].reverse().find(item => {
          const realSize = EQUIPMENT_REAL_WORLD_SIZES[item.type] || 0.5;
          const sizePx = scaleInfo.ratio ? realSize / scaleInfo.ratio : 20;
          const halfSize = sizePx / 2;
          return Math.abs(worldPos.x - item.position.x) <= halfSize &&
                 Math.abs(worldPos.y - item.position.y) <= halfSize;
        });
        if (hitEquipment) {
          const dims = getEquipmentDimensions(hitEquipment.type, scaleInfo, plantSetupConfig);
          const clickedEdge = detectClickedEdge(worldPos, hitEquipment.position, dims, hitEquipment.rotation, edgeThresholdWorld);
          onAlignEdgesObjectClick(hitEquipment.id, clickedEdge);
          return;
        }
      }

      return;
    }
    if (activeTool === Tool.PAN || e.button === 1) {
      setIsPanning(true);
      return;
    }

    if (activeTool === Tool.SCALE) {
      if (!scaleLine) {
        setScaleLine({ start: worldPos, end: worldPos });
      }
    } else if (activeTool === Tool.ROOF_DIRECTION) {
      // Start direction line drawing
      if (!directionLine) {
        setDirectionLine({ start: worldPos, end: worldPos });
      }
    } else if (activeTool === Tool.ROOF_MASK || activeTool === Tool.LINE_DC || activeTool === Tool.LINE_AC) {
      // Check for snap-to-start: if clicking near the first point, complete the polygon
      if (currentDrawing.length >= 3 && activeTool === Tool.ROOF_MASK) {
        const startPoint = currentDrawing[0];
        const screenStart = {
          x: startPoint.x * viewState.zoom + viewState.offset.x,
          y: startPoint.y * viewState.zoom + viewState.offset.y,
        };
        const screenClick = { x: screenPos.x, y: screenPos.y };
        const distToStart = distance(screenStart, screenClick);
        
        if (distToStart <= SNAP_THRESHOLD) {
          completeDrawing();
          return;
        }
      }
      
      // Apply cable snapping for LINE_DC and LINE_AC tools
      let finalPos = worldPos;
      
      if (activeTool === Tool.LINE_DC || activeTool === Tool.LINE_AC) {
        const cableType: CableType = activeTool === Tool.LINE_DC ? 'dc' : 'ac';
        const snapResult = snapCablePointToTarget(
          worldPos,
          cableType,
          equipment,
          pvArrays,
          pvPanelConfig,
          roofMasks,
          scaleInfo,
          viewState,
          plantSetupConfig
        );
        finalPos = snapResult.position;
        
        // Auto-complete when clicking a valid snapped endpoint (after the first point)
        // AC: Inverter or Main Board
        // DC: Inverter or PV Array
        const isValidEndpoint = (() => {
          if (currentDrawing.length === 0) return false; // Need at least one point first
          if (!snapResult.snappedToId || !snapResult.snappedToType) return false;

          if (cableType === 'ac') {
            return (
              snapResult.snappedToType === 'equipment' &&
              (snapResult.equipmentType === EquipmentType.INVERTER ||
                snapResult.equipmentType === EquipmentType.MAIN_BOARD)
            );
          }

          // dc
          return (
            (snapResult.snappedToType === 'equipment' &&
              snapResult.equipmentType === EquipmentType.INVERTER) ||
            snapResult.snappedToType === 'pvArray'
          );
        })();
        
        if (isValidEndpoint) {
          // Add the final point and complete the cable immediately
          const snappedPos = (isShiftHeld && currentDrawing.length > 0)
            ? snapTo45Degrees(currentDrawing[currentDrawing.length - 1], finalPos)
            : finalPos;
          
          const newLine: SupplyLine = {
            id: `line-${Date.now()}`,
            name: `${cableType === 'dc' ? 'DC' : 'AC'} Cable`,
            type: cableType,
            points: [...currentDrawing, snappedPos],
            length: calculateLineLength([...currentDrawing, snappedPos], scaleInfo.ratio),
          };
          setLines(prev => [...prev, newLine]);
          setCurrentDrawing([]);
          setPreviewPoint(null);
          return;
        }
      }
      
      // Apply 45-degree snapping if Shift is held and we have a previous point
      const snappedPos = (isShiftHeld && currentDrawing.length > 0)
        ? snapTo45Degrees(currentDrawing[currentDrawing.length - 1], finalPos)
        : finalPos;
      setCurrentDrawing([...currentDrawing, snappedPos]);
    } else if (activeTool === Tool.PV_ARRAY && pendingBatchPlacement && scaleInfo.ratio) {
      // Batch placement - collect all items first, then batch update by type
      const timestamp = Date.now();
      
      // Collect items by type for batched updates
      const newPvArrays: PVArrayItem[] = [];
      const newEquipment: EquipmentItem[] = [];
      const newWalkways: PlacedWalkway[] = [];
      const newCableTrays: PlacedCableTray[] = [];
      
      pendingBatchPlacement.items.forEach((item, idx) => {
        const itemPos = {
          x: worldPos.x + item.offset.x,
          y: worldPos.y + item.offset.y,
        };
        const finalRotation = item.rotation + placementRotation;
        
        if (item.type === 'pvArray' && item.pvArrayConfig && pvPanelConfig) {
          const onMask = roofMasks.find(m => isPointInPolygon(itemPos, m.points));
          newPvArrays.push({
            id: `array-${timestamp}-${idx}`,
            position: itemPos,
            rows: item.pvArrayConfig.rows,
            columns: item.pvArrayConfig.columns,
            orientation: item.pvArrayConfig.orientation,
            rotation: finalRotation,
            roofMaskId: onMask?.id,
            minSpacing: item.pvArrayConfig.minSpacing,
          });
        }
        
        if (item.type === 'equipment' && item.equipmentConfig) {
          newEquipment.push({
            id: `eq-${timestamp}-${idx}`,
            type: item.equipmentConfig.equipmentType,
            position: itemPos,
            rotation: finalRotation,
            name: item.equipmentConfig.name,
          });
        }
        
        if (item.type === 'walkway' && item.walkwayConfig) {
          newWalkways.push({
            id: `walkway-${timestamp}-${idx}`,
            configId: item.walkwayConfig.configId,
            name: item.walkwayConfig.name,
            width: item.walkwayConfig.width,
            length: item.walkwayConfig.length,
            position: itemPos,
            rotation: finalRotation,
            minSpacing: item.walkwayConfig.minSpacing,
          });
        }
        
        if (item.type === 'cableTray' && item.cableTrayConfig) {
          newCableTrays.push({
            id: `tray-${timestamp}-${idx}`,
            configId: item.cableTrayConfig.configId,
            name: item.cableTrayConfig.name,
            width: item.cableTrayConfig.width,
            length: item.cableTrayConfig.length,
            position: itemPos,
            rotation: finalRotation,
            minSpacing: item.cableTrayConfig.minSpacing,
          });
        }
      });
      
      // Apply batched updates - one commit per type instead of one per item
      if (newPvArrays.length > 0) {
        setPvArrays(prev => [...prev, ...newPvArrays]);
      }
      if (newEquipment.length > 0) {
        setEquipment(prev => [...prev, ...newEquipment]);
      }
      if (newWalkways.length > 0 && setPlacedWalkways) {
        setPlacedWalkways(prev => [...prev, ...newWalkways]);
      }
      if (newCableTrays.length > 0 && setPlacedCableTrays) {
        setPlacedCableTrays(prev => [...prev, ...newCableTrays]);
      }
      
      onBatchPlaced?.();
    } else if (activeTool === Tool.PV_ARRAY && pendingPvArrayConfig && pvPanelConfig && scaleInfo.ratio) {
      // Check if clicking on a roof mask
      const onMask = roofMasks.find(m => isPointInPolygon(worldPos, m.points));
      if (onMask) {
        // Calculate base rotation from roof direction + manual adjustment
        const autoRotation = calculateArrayRotationForRoof(worldPos, roofMasks, 0);
        const baseRotation = (autoRotation + placementRotation) % 360;
        
        // Apply snapping to adjacent arrays if minSpacing is set OR Shift is held
        const minSpacing = pendingPvArrayConfig.minSpacing ?? 0;
        const snapResult = snapPVArrayToSpacing(
          worldPos,
          { 
            rows: pendingPvArrayConfig.rows, 
            columns: pendingPvArrayConfig.columns, 
            orientation: pendingPvArrayConfig.orientation,
            rotation: baseRotation,
          },
          pvArrays,
          pvPanelConfig,
          roofMasks,
          scaleInfo,
          minSpacing,
          isShiftHeld // Force align when Shift is held
        );
        
        // Use snapped rotation if snapped to an array, otherwise use base rotation
        const finalRotation = snapResult.snappedToId ? snapResult.rotation : baseRotation;
        
        const newArray: PVArrayItem = {
          id: `array-${Date.now()}`,
          position: snapResult.position,
          rows: pendingPvArrayConfig.rows,
          columns: pendingPvArrayConfig.columns,
          orientation: pendingPvArrayConfig.orientation,
          rotation: finalRotation,
          roofMaskId: onMask.id,
          minSpacing: pendingPvArrayConfig.minSpacing,
        };
        setPvArrays(prev => [...prev, newArray]);
        onArrayPlaced();
      }
    } else if ([Tool.PLACE_INVERTER, Tool.PLACE_DC_COMBINER, Tool.PLACE_AC_DISCONNECT, Tool.PLACE_MAIN_BOARD].includes(activeTool)) {
      const typeMap: Record<Tool, EquipmentType> = {
        [Tool.PLACE_INVERTER]: EquipmentType.INVERTER,
        [Tool.PLACE_DC_COMBINER]: EquipmentType.DC_COMBINER,
        [Tool.PLACE_AC_DISCONNECT]: EquipmentType.AC_DISCONNECT,
        [Tool.PLACE_MAIN_BOARD]: EquipmentType.MAIN_BOARD,
      } as Record<Tool, EquipmentType>;
      
      const eqType = typeMap[activeTool];
      if (eqType) {
        // Apply snapping for equipment placement
        const equipmentMinSpacing = 0.3; // 30cm default spacing
        const snapResult = snapEquipmentToSpacing(
          worldPos,
          eqType,
          placementRotation,
          equipment,
          scaleInfo,
          equipmentMinSpacing,
          isShiftHeld,
          plantSetupConfig
        );
        
        setEquipment(prev => [...prev, {
          id: `eq-${Date.now()}`,
          type: eqType,
          position: snapResult.position,
          rotation: snapResult.snappedToId ? snapResult.rotation : placementRotation,
        }]);
      }
    } else if (activeTool === Tool.PLACE_WALKWAY && pendingWalkwayConfig && setPlacedWalkways && scaleInfo.ratio) {
      // Apply snapping for walkway placement
      const snapResult = snapMaterialToSpacing(
        worldPos,
        { width: pendingWalkwayConfig.width, length: pendingWalkwayConfig.length, rotation: placementRotation },
        placedWalkways || [],
        scaleInfo,
        placementMinSpacing,
        isShiftHeld
      );
      
      const newWalkway: PlacedWalkway = {
        id: `walkway-${Date.now()}`,
        configId: pendingWalkwayConfig.id,
        name: pendingWalkwayConfig.name,
        width: pendingWalkwayConfig.width,
        length: pendingWalkwayConfig.length,
        position: snapResult.position,
        rotation: snapResult.snappedToId ? snapResult.rotation : placementRotation,
        minSpacing: placementMinSpacing,
      };
      setPlacedWalkways(prev => [...prev, newWalkway]);
    } else if (activeTool === Tool.PLACE_CABLE_TRAY && pendingCableTrayConfig && setPlacedCableTrays && scaleInfo.ratio) {
      // Apply snapping for cable tray placement
      const snapResult = snapMaterialToSpacing(
        worldPos,
        { width: pendingCableTrayConfig.width, length: pendingCableTrayConfig.length, rotation: placementRotation },
        placedCableTrays || [],
        scaleInfo,
        placementMinSpacing,
        isShiftHeld
      );
      
      const newTray: PlacedCableTray = {
        id: `tray-${Date.now()}`,
        configId: pendingCableTrayConfig.id,
        name: pendingCableTrayConfig.name,
        width: pendingCableTrayConfig.width,
        length: pendingCableTrayConfig.length,
        position: snapResult.position,
        rotation: snapResult.snappedToId ? snapResult.rotation : placementRotation,
        minSpacing: placementMinSpacing,
      };
      setPlacedCableTrays(prev => [...prev, newTray]);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const screenPos = getMousePos(e);
    const worldPos = toWorld(screenPos);

    // Update marquee selection box
    if (marqueeStart) {
      setMarqueeEnd(worldPos);
      return;
    }

    // Handle group dragging (multiple selected items)
    if (isGroupDragging && groupDragStart && groupDragInitialPositions.size > 0) {
      const deltaX = worldPos.x - groupDragStart.x;
      const deltaY = worldPos.y - groupDragStart.y;
      
      // Move all PV arrays that are selected
      const selectedArrayIds = pvArrays.filter(arr => groupDragInitialPositions.has(arr.id)).map(arr => arr.id);
      if (selectedArrayIds.length > 0) {
        setPvArrays(prev => prev.map(arr => {
          const initialPos = groupDragInitialPositions.get(arr.id);
          if (initialPos) {
            return { ...arr, position: { x: initialPos.x + deltaX, y: initialPos.y + deltaY } };
          }
          return arr;
        }));
      }
      
      // Move all equipment that is selected
      const selectedEquipmentIds = equipment.filter(eq => groupDragInitialPositions.has(eq.id)).map(eq => eq.id);
      if (selectedEquipmentIds.length > 0) {
        setEquipment(prev => prev.map(eq => {
          const initialPos = groupDragInitialPositions.get(eq.id);
          if (initialPos) {
            return { ...eq, position: { x: initialPos.x + deltaX, y: initialPos.y + deltaY } };
          }
          return eq;
        }));
      }
      
      // Move all walkways that are selected
      if (setPlacedWalkways && placedWalkways) {
        const selectedWalkwayIds = placedWalkways.filter(w => groupDragInitialPositions.has(w.id)).map(w => w.id);
        if (selectedWalkwayIds.length > 0) {
          setPlacedWalkways(prev => prev.map(w => {
            const initialPos = groupDragInitialPositions.get(w.id);
            if (initialPos) {
              return { ...w, position: { x: initialPos.x + deltaX, y: initialPos.y + deltaY } };
            }
            return w;
          }));
        }
      }
      
      // Move all cable trays that are selected
      if (setPlacedCableTrays && placedCableTrays) {
        const selectedTrayIds = placedCableTrays.filter(t => groupDragInitialPositions.has(t.id)).map(t => t.id);
        if (selectedTrayIds.length > 0) {
          setPlacedCableTrays(prev => prev.map(t => {
            const initialPos = groupDragInitialPositions.get(t.id);
            if (initialPos) {
              return { ...t, position: { x: initialPos.x + deltaX, y: initialPos.y + deltaY } };
            }
            return t;
          }));
        }
      }
      
      // Move all roof masks that are selected (move all points by delta)
      const selectedMaskIds = roofMasks.filter(m => groupDragInitialPositions.has(m.id)).map(m => m.id);
      if (selectedMaskIds.length > 0) {
        setRoofMasks(prev => prev.map(m => {
          if (groupDragInitialPositions.has(m.id)) {
            // We stored the center, but we need to move all points
            // Calculate delta from initial center
            const initialCenter = groupDragInitialPositions.get(m.id)!;
            const currentCenter = {
              x: m.points.reduce((s, p) => s + p.x, 0) / m.points.length,
              y: m.points.reduce((s, p) => s + p.y, 0) / m.points.length,
            };
            // The target center should be at initialCenter + delta
            const targetCenter = { x: initialCenter.x + deltaX, y: initialCenter.y + deltaY };
            // Move all points by the difference
            const moveDelta = { x: targetCenter.x - currentCenter.x, y: targetCenter.y - currentCenter.y };
            return {
              ...m,
              points: m.points.map(p => ({ x: p.x + moveDelta.x, y: p.y + moveDelta.y })),
            };
          }
          return m;
        }));
      }
      
      // Move all cables/lines that are selected (move all points by delta)
      const selectedLineIds = lines.filter(l => groupDragInitialPositions.has(l.id)).map(l => l.id);
      if (selectedLineIds.length > 0) {
        setLines(prev => prev.map(line => {
          const initialPos = groupDragInitialPositions.get(line.id);
          if (initialPos && line.points.length > 0) {
            // Calculate delta from initial first point to target first point
            const targetFirstPoint = { x: initialPos.x + deltaX, y: initialPos.y + deltaY };
            const currentFirstPoint = line.points[0];
            const moveDelta = { x: targetFirstPoint.x - currentFirstPoint.x, y: targetFirstPoint.y - currentFirstPoint.y };
            return {
              ...line,
              points: line.points.map(p => ({ x: p.x + moveDelta.x, y: p.y + moveDelta.y })),
            };
          }
          return line;
        }));
      }
      
      return;
    }

    if (draggingPvArrayId && pvArrayDragOffset) {
      const basePos = { x: worldPos.x - pvArrayDragOffset.x, y: worldPos.y - pvArrayDragOffset.y };
      
      // Find the dragged array to get its config
      const draggedArray = pvArrays.find(arr => arr.id === draggingPvArrayId);
      if (draggedArray && scaleInfo.ratio) {
        // Get other arrays (exclude the one being dragged)
        const otherArrays = pvArrays.filter(arr => arr.id !== draggingPvArrayId);
        
        // Apply snapping logic
        const minSpacing = pendingPvArrayConfig?.minSpacing ?? 0;
        const snapResult = snapPVArrayToSpacing(
          basePos,
          {
            rows: draggedArray.rows,
            columns: draggedArray.columns,
            orientation: draggedArray.orientation,
            rotation: draggedArray.rotation,
          },
          otherArrays,
          pvPanelConfig,
          roofMasks,
          scaleInfo,
          minSpacing,
          isShiftHeld
        );
        
        setPvArrays(prev => prev.map(arr => 
          arr.id === draggingPvArrayId 
            ? { ...arr, position: snapResult.position, rotation: isShiftHeld && snapResult.snappedToId ? snapResult.rotation : arr.rotation } 
            : arr
        ));
      } else {
        setPvArrays(prev => prev.map(arr => (arr.id === draggingPvArrayId ? { ...arr, position: basePos } : arr)));
      }
      return;
    }

    // Handle equipment dragging with snapping
    if (draggingEquipmentId && equipmentDragOffset) {
      const basePos = { 
        x: worldPos.x - equipmentDragOffset.x, 
        y: worldPos.y - equipmentDragOffset.y 
      };
      
      const draggedEquipment = equipment.find(e => e.id === draggingEquipmentId);
      if (draggedEquipment) {
        const otherEquipment = equipment.filter(e => e.id !== draggingEquipmentId);
        const equipmentMinSpacing = 0.3; // 30cm default spacing
        
        const snapResult = snapEquipmentToSpacing(
          basePos,
          draggedEquipment.type,
          draggedEquipment.rotation,
          otherEquipment,
          scaleInfo,
          equipmentMinSpacing,
          isShiftHeld,
          plantSetupConfig
        );
        
        setEquipment(prev => prev.map(item => 
          item.id === draggingEquipmentId 
            ? { ...item, position: snapResult.position, rotation: isShiftHeld && snapResult.snappedToId ? snapResult.rotation : item.rotation } 
            : item
        ));
      } else {
        setEquipment(prev => prev.map(item => 
          item.id === draggingEquipmentId ? { ...item, position: basePos } : item
        ));
      }
      return;
    }

    // Handle walkway dragging with snapping
    if (draggingWalkwayId && walkwayDragOffset && setPlacedWalkways) {
      const basePos = { 
        x: worldPos.x - walkwayDragOffset.x, 
        y: worldPos.y - walkwayDragOffset.y 
      };
      
      const draggedWalkway = placedWalkways?.find(w => w.id === draggingWalkwayId);
      if (draggedWalkway && scaleInfo.ratio) {
        const otherWalkways = (placedWalkways || []).filter(w => w.id !== draggingWalkwayId);
        const minSpacing = draggedWalkway.minSpacing ?? placementMinSpacing;
        
        const snapResult = snapMaterialToSpacing(
          basePos,
          { width: draggedWalkway.width, length: draggedWalkway.length, rotation: draggedWalkway.rotation },
          otherWalkways,
          scaleInfo,
          minSpacing,
          isShiftHeld
        );
        
        setPlacedWalkways(prev => prev.map(item => 
          item.id === draggingWalkwayId 
            ? { ...item, position: snapResult.position, rotation: isShiftHeld && snapResult.snappedToId ? snapResult.rotation : item.rotation } 
            : item
        ));
      } else {
        setPlacedWalkways(prev => prev.map(item => 
          item.id === draggingWalkwayId ? { ...item, position: basePos } : item
        ));
      }
      return;
    }

    // Handle cable tray dragging with snapping
    if (draggingCableTrayId && cableTrayDragOffset && setPlacedCableTrays) {
      const basePos = { 
        x: worldPos.x - cableTrayDragOffset.x, 
        y: worldPos.y - cableTrayDragOffset.y 
      };
      
      const draggedTray = placedCableTrays?.find(t => t.id === draggingCableTrayId);
      if (draggedTray && scaleInfo.ratio) {
        const otherTrays = (placedCableTrays || []).filter(t => t.id !== draggingCableTrayId);
        const minSpacing = draggedTray.minSpacing ?? placementMinSpacing;
        
        const snapResult = snapMaterialToSpacing(
          basePos,
          { width: draggedTray.width, length: draggedTray.length, rotation: draggedTray.rotation },
          otherTrays,
          scaleInfo,
          minSpacing,
          isShiftHeld
        );
        
        setPlacedCableTrays(prev => prev.map(item => 
          item.id === draggingCableTrayId 
            ? { ...item, position: snapResult.position, rotation: isShiftHeld && snapResult.snappedToId ? snapResult.rotation : item.rotation } 
            : item
        ));
      } else {
        setPlacedCableTrays(prev => prev.map(item => 
          item.id === draggingCableTrayId ? { ...item, position: basePos } : item
        ));
      }
      return;
    }

    if (isPanning) {
      const dx = screenPos.x - lastMousePos.x;
      const dy = screenPos.y - lastMousePos.y;
      setViewState({ ...viewState, offset: { x: viewState.offset.x + dx, y: viewState.offset.y + dy } });
      setLastMousePos(screenPos);
      return;
    }

    if (activeTool === Tool.SCALE && scaleLine) {
      // Apply 45-degree snapping to scale line if Shift is held
      const snappedEnd = isShiftHeld ? snapTo45Degrees(scaleLine.start, worldPos) : worldPos;
      setScaleLine({ ...scaleLine, end: snappedEnd });
    }

    if (activeTool === Tool.ROOF_DIRECTION && directionLine) {
      // Update direction line end point
      const snappedEnd = isShiftHeld ? snapTo45Degrees(directionLine.start, worldPos) : worldPos;
      setDirectionLine({ ...directionLine, end: snappedEnd });
    }

    if (currentDrawing.length > 0) {
      let previewPos = worldPos;
      
      // Apply cable snapping for LINE_DC and LINE_AC tools
      if (activeTool === Tool.LINE_DC || activeTool === Tool.LINE_AC) {
        const cableType: CableType = activeTool === Tool.LINE_DC ? 'dc' : 'ac';
        const snapResult = snapCablePointToTarget(
          worldPos,
          cableType,
          equipment,
          pvArrays,
          pvPanelConfig,
          roofMasks,
          scaleInfo,
          viewState,
          plantSetupConfig
        );
        previewPos = snapResult.position;
      }
      
      // Apply 45-degree snapping to preview line if Shift is held
      const anchor = currentDrawing[currentDrawing.length - 1];
      const snappedPreview = isShiftHeld ? snapTo45Degrees(anchor, previewPos) : previewPos;
      setPreviewPoint(snappedPreview);
    }
    
    // Track mouse position for ghost preview (PV array, equipment, walkways, cable trays, cables, batch placement)
    const equipmentPlacementTools = [Tool.PLACE_INVERTER, Tool.PLACE_DC_COMBINER, Tool.PLACE_AC_DISCONNECT, Tool.PLACE_MAIN_BOARD];
    const materialPlacementTools = [Tool.PLACE_WALKWAY, Tool.PLACE_CABLE_TRAY];
    const cableTools = [Tool.LINE_DC, Tool.LINE_AC];
    if (
      (activeTool === Tool.PV_ARRAY && (pendingPvArrayConfig || pendingBatchPlacement)) || 
      equipmentPlacementTools.includes(activeTool) ||
      materialPlacementTools.includes(activeTool) ||
      cableTools.includes(activeTool)
    ) {
      setMouseWorldPos(worldPos);
    } else {
      setMouseWorldPos(null);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    // Complete marquee selection
    if (marqueeStart && marqueeEnd && onBoxSelection) {
      const minX = Math.min(marqueeStart.x, marqueeEnd.x);
      const maxX = Math.max(marqueeStart.x, marqueeEnd.x);
      const minY = Math.min(marqueeStart.y, marqueeEnd.y);
      const maxY = Math.max(marqueeStart.y, marqueeEnd.y);
      
      // Only process if we dragged more than 5 pixels to distinguish from click
      const boxWidth = maxX - minX;
      const boxHeight = maxY - minY;
      
      if (boxWidth > 5 || boxHeight > 5) {
        const selectedIds: string[] = [];
        
        // Check if rectangle is valid (more than just a point/line)
        const isPointInBox = (p: Point) => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY;
        const isCenterInBox = (center: Point) => isPointInBox(center);

        // Robust polyline selection: select if *any segment* crosses the marquee box,
        // even when no vertices fall inside the rectangle.
        const segmentsIntersect = (a: Point, b: Point, c: Point, d: Point) => {
          // Standard orientation test
          const cross = (p: Point, q: Point, r: Point) =>
            (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
          const onSeg = (p: Point, q: Point, r: Point) =>
            Math.min(p.x, r.x) <= q.x && q.x <= Math.max(p.x, r.x) &&
            Math.min(p.y, r.y) <= q.y && q.y <= Math.max(p.y, r.y);

          const o1 = cross(a, b, c);
          const o2 = cross(a, b, d);
          const o3 = cross(c, d, a);
          const o4 = cross(c, d, b);

          // General case
          if ((o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0)) return true;

          // Collinear cases
          const eps = 1e-9;
          if (Math.abs(o1) < eps && onSeg(a, c, b)) return true;
          if (Math.abs(o2) < eps && onSeg(a, d, b)) return true;
          if (Math.abs(o3) < eps && onSeg(c, a, d)) return true;
          if (Math.abs(o4) < eps && onSeg(c, b, d)) return true;
          return false;
        };

        const segmentIntersectsBox = (p1: Point, p2: Point) => {
          // Quick reject via bounding boxes
          const segMinX = Math.min(p1.x, p2.x);
          const segMaxX = Math.max(p1.x, p2.x);
          const segMinY = Math.min(p1.y, p2.y);
          const segMaxY = Math.max(p1.y, p2.y);
          if (segMaxX < minX || segMinX > maxX || segMaxY < minY || segMinY > maxY) return false;

          // Endpoints inside
          if (isPointInBox(p1) || isPointInBox(p2)) return true;

          // Intersect any of the 4 edges
          const topLeft: Point = { x: minX, y: minY };
          const topRight: Point = { x: maxX, y: minY };
          const bottomLeft: Point = { x: minX, y: maxY };
          const bottomRight: Point = { x: maxX, y: maxY };

          return (
            segmentsIntersect(p1, p2, topLeft, topRight) ||
            segmentsIntersect(p1, p2, topRight, bottomRight) ||
            segmentsIntersect(p1, p2, bottomRight, bottomLeft) ||
            segmentsIntersect(p1, p2, bottomLeft, topLeft)
          );
        };

        const polylineIntersectsBox = (pts: Point[]) => {
          if (pts.length < 2) return false;
          // If any point inside, we already select, but keep for completeness
          if (pts.some(isPointInBox)) return true;
          for (let i = 0; i < pts.length - 1; i++) {
            if (segmentIntersectsBox(pts[i], pts[i + 1])) return true;
          }
          return false;
        };
        
        // Check PV arrays (only if layer is visible)
        if (pvPanelConfig && scaleInfo.ratio && layerVisibility.pvArrays) {
          pvArrays.forEach(arr => {
            const dims = getPVArrayDimensions(arr, pvPanelConfig, roofMasks, scaleInfo, arr.position);
            // Use center point for selection
            if (isCenterInBox(arr.position)) {
              selectedIds.push(arr.id);
            }
          });
        }
        
        // Check walkways (only if layer is visible)
        if (layerVisibility.walkways) {
          placedWalkways?.forEach(walkway => {
            if (isCenterInBox(walkway.position)) {
              selectedIds.push(walkway.id);
            }
          });
        }
        
        // Check cable trays (only if layer is visible)
        if (layerVisibility.cableTrays) {
          placedCableTrays?.forEach(tray => {
            if (isCenterInBox(tray.position)) {
              selectedIds.push(tray.id);
            }
          });
        }
        
        // Check equipment (only if layer is visible)
        if (layerVisibility.equipment) {
          equipment.forEach(eq => {
            if (isCenterInBox(eq.position)) {
              selectedIds.push(eq.id);
            }
          });
        }
        
        // Check cables/lines (only if layer is visible)
        if (layerVisibility.cables) {
          lines.forEach(line => {
            // Check thickness visibility
            const thickness = line.thickness || 6;
            if (line.type === 'dc' && subgroupVisibility?.dcCableThicknesses?.[thickness] === false) return;
            if (line.type === 'ac' && subgroupVisibility?.acCableThicknesses?.[thickness] === false) return;
            // Select cables when their *path* crosses the marquee box (not just endpoints)
            if (polylineIntersectsBox(line.points)) {
              selectedIds.push(line.id);
            }
          });
        }
        
        // Check roof masks (by center) (only if layer is visible)
        if (layerVisibility.roofMasks) {
          roofMasks.forEach(mask => {
            if (mask.points.length > 0) {
              const cx = mask.points.reduce((s, p) => s + p.x, 0) / mask.points.length;
              const cy = mask.points.reduce((s, p) => s + p.y, 0) / mask.points.length;
              if (isCenterInBox({ x: cx, y: cy })) {
                selectedIds.push(mask.id);
              }
            }
          });
        }
        
        // Determine if adding to selection (Shift held)
        const addToSelection = e.shiftKey || e.ctrlKey || e.metaKey;
        onBoxSelection(selectedIds, addToSelection);
      } else {
        // Clicked without dragging - clear selection if no modifier
        const addToSelection = e.shiftKey || e.ctrlKey || e.metaKey;
        if (!addToSelection) {
          setSelectedItemId(null);
        }
      }
      
      setMarqueeStart(null);
      setMarqueeEnd(null);
      return;
    }
    
    // Clear marquee state if no callback
    setMarqueeStart(null);
    setMarqueeEnd(null);
    
    // Clear group drag state
    setIsGroupDragging(false);
    setGroupDragStart(null);
    setGroupDragInitialPositions(new Map());
    
    setIsPanning(false);
    setDraggingPvArrayId(null);
    setPvArrayDragOffset(null);
    setDraggingEquipmentId(null);
    setEquipmentDragOffset(null);
    setDraggingWalkwayId(null);
    setWalkwayDragOffset(null);
    setDraggingCableTrayId(null);
    setCableTrayDragOffset(null);
    
    if (activeTool === Tool.SCALE && scaleLine) {
      const dist = distance(scaleLine.start, scaleLine.end);
      if (dist > 10) {
        onScaleComplete(dist);
      } else {
        setScaleLine(null);
      }
    }
    
    if (activeTool === Tool.ROOF_DIRECTION && directionLine) {
      const dist = distance(directionLine.start, directionLine.end);
      if (dist > 10) {
        const azimuth = calculateAzimuth(directionLine.start, directionLine.end);
        onRoofDirectionComplete(azimuth);
      }
      setDirectionLine(null);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    // Check if double-clicking on a PV array in select mode
    if (activeTool === Tool.SELECT && onPVArrayDoubleClick && pvPanelConfig && scaleInfo.ratio) {
      const screenPos = getMousePos(e);
      const worldPos = toWorld(screenPos);
      const hitArray = [...pvArrays].reverse().find(arr => {
        const corners = getPVArrayCorners(arr, pvPanelConfig, roofMasks, scaleInfo);
        return corners.length === 4 && isPointInPolygon(worldPos, corners);
      });
      if (hitArray) {
        onPVArrayDoubleClick(hitArray.id);
        return;
      }
    }
    // Default behavior for drawing tools
    completeDrawing();
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(Math.max(viewState.zoom * zoomFactor, 0.1), 10);
    
    const mousePos = getMousePos(e);
    const worldPos = toWorld(mousePos);
    
    setViewState({
      zoom: newZoom,
      offset: {
        x: mousePos.x - worldPos.x * newZoom,
        y: mousePos.y - worldPos.y * newZoom,
      },
    });
  };

  return (
    <div 
      ref={containerRef}
      className={
        "relative flex-1 overflow-hidden bg-muted " +
        (activeTool === Tool.SELECT ? "cursor-default" : "cursor-crosshair")
      }
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        // Clear all drag/selection states without triggering box selection
        setMarqueeStart(null);
        setMarqueeEnd(null);
        setIsGroupDragging(false);
        setGroupDragStart(null);
        setGroupDragInitialPositions(new Map());
        setIsPanning(false);
        setDraggingPvArrayId(null);
        setPvArrayDragOffset(null);
        setDraggingEquipmentId(null);
        setEquipmentDragOffset(null);
        setDraggingWalkwayId(null);
        setWalkwayDragOffset(null);
        setDraggingCableTrayId(null);
        setCableTrayDragOffset(null);
      }}
      onDoubleClick={handleDoubleClick}
      onWheel={handleWheel}
    >
      {!backgroundImage ? (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          <p>Load a layout to begin</p>
        </div>
      ) : (
        <>
          <div 
            style={{ 
              transform: `translate(${viewState.offset.x}px, ${viewState.offset.y}px) scale(${viewState.zoom})`,
              transformOrigin: '0 0',
            }}
          >
            <canvas ref={pdfCanvasRef} />
          </div>
          <canvas 
            ref={drawingCanvasRef} 
            className="absolute inset-0 pointer-events-none" 
          />
          
          {/* Instruction overlay for drawing tools */}
          {currentDrawing.length > 0 && (activeTool === Tool.ROOF_MASK || activeTool === Tool.LINE_DC || activeTool === Tool.LINE_AC) && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-background/90 backdrop-blur-sm border border-border rounded-lg px-4 py-2 shadow-lg z-10">
              <p className="text-sm text-foreground">
                Click to add points. <span className="font-semibold">Double-click</span> or press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">Enter</kbd> to close. <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">Esc</kbd> to cancel.
              </p>
            </div>
          )}
          
          {/* Instruction overlay for direction drawing */}
          {activeTool === Tool.ROOF_DIRECTION && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-blue-50 dark:bg-blue-950/80 backdrop-blur-sm border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-2 shadow-lg z-10">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <span className="font-semibold">Draw slope direction:</span> Click and drag from the <span className="text-green-600 font-semibold">high point</span> to the <span className="text-blue-600 font-semibold">low point</span> of the roof.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
