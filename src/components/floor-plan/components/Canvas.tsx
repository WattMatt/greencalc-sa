import { useRef, useEffect, useState } from 'react';
import { Tool, ViewState, Point, ScaleInfo, PVPanelConfig, RoofMask, PVArrayItem, EquipmentItem, SupplyLine, EquipmentType } from '../types';
import { renderAllMarkups } from '../utils/drawing';
import { calculatePolygonArea, calculateLineLength, distance, calculateArrayRotationForRoof, isPointInPolygon, snapTo45Degrees, getPVArrayCorners } from '../utils/geometry';
import { PVArrayConfig } from './PVArrayModal';

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
  placementRotation: number;
  pendingPvArrayConfig: PVArrayConfig | null;
  onRoofMaskComplete: (points: Point[], area: number) => void;
  onRoofDirectionComplete: (direction: number) => void;
  onArrayPlaced: () => void;
  pendingRoofMaskPoints?: Point[];
  onPVArrayDoubleClick?: (arrayId: string) => void;
}

export function Canvas({
  backgroundImage, activeTool, viewState, setViewState,
  scaleInfo, scaleLine, setScaleLine, onScaleComplete,
  pvPanelConfig, roofMasks, setRoofMasks, pvArrays, setPvArrays,
  equipment, setEquipment, lines, setLines,
  selectedItemId, setSelectedItemId, placementRotation,
  pendingPvArrayConfig, onRoofMaskComplete, onRoofDirectionComplete, onArrayPlaced,
  pendingRoofMaskPoints, onPVArrayDoubleClick,
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
      selectedItemId, scaleLine,
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
    
    ctx.restore();
  }, [viewState, equipment, lines, roofMasks, pvArrays, scaleInfo, pvPanelConfig, selectedItemId, scaleLine, currentDrawing, previewPoint, canvasSize, containerSize, activeTool, pendingRoofMaskPoints, directionLine]);

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
      // Prefer selecting PV arrays first (topmost)
      const hitArray = (pvPanelConfig && scaleInfo.ratio)
        ? [...pvArrays].reverse().find(arr => {
            const corners = getPVArrayCorners(arr, pvPanelConfig, roofMasks, scaleInfo);
            return corners.length === 4 && isPointInPolygon(worldPos, corners);
          })
        : undefined;

      if (hitArray) {
        setSelectedItemId(hitArray.id);
        setDraggingPvArrayId(hitArray.id);
        setPvArrayDragOffset({ x: worldPos.x - hitArray.position.x, y: worldPos.y - hitArray.position.y });
        return;
      }

      // Fallback: select roof mask
      const hitMask = [...roofMasks].reverse().find(m => isPointInPolygon(worldPos, m.points));
      if (hitMask) {
        setSelectedItemId(hitMask.id);
        return;
      }

      // Clicked empty space
      setSelectedItemId(null);
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
      
      // Apply 45-degree snapping if Shift is held and we have a previous point
      const snappedPos = (isShiftHeld && currentDrawing.length > 0)
        ? snapTo45Degrees(currentDrawing[currentDrawing.length - 1], worldPos)
        : worldPos;
      setCurrentDrawing([...currentDrawing, snappedPos]);
    } else if (activeTool === Tool.PV_ARRAY && pendingPvArrayConfig && pvPanelConfig) {
      // Check if clicking on a roof mask
      const onMask = roofMasks.find(m => isPointInPolygon(worldPos, m.points));
      if (onMask) {
        const rotation = calculateArrayRotationForRoof(worldPos, roofMasks, 0);
        const newArray: PVArrayItem = {
          id: `array-${Date.now()}`,
          position: worldPos,
          rows: pendingPvArrayConfig.rows,
          columns: pendingPvArrayConfig.columns,
          orientation: pendingPvArrayConfig.orientation,
          rotation,
          roofMaskId: onMask.id,
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
        setEquipment(prev => [...prev, {
          id: `eq-${Date.now()}`,
          type: eqType,
          position: worldPos,
          rotation: placementRotation,
        }]);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const screenPos = getMousePos(e);
    const worldPos = toWorld(screenPos);

    if (draggingPvArrayId && pvArrayDragOffset) {
      const nextPos = { x: worldPos.x - pvArrayDragOffset.x, y: worldPos.y - pvArrayDragOffset.y };
      setPvArrays(prev => prev.map(arr => (arr.id === draggingPvArrayId ? { ...arr, position: nextPos } : arr)));
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
      // Apply 45-degree snapping to preview line if Shift is held
      const anchor = currentDrawing[currentDrawing.length - 1];
      const snappedPreview = isShiftHeld ? snapTo45Degrees(anchor, worldPos) : worldPos;
      setPreviewPoint(snappedPreview);
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingPvArrayId(null);
    setPvArrayDragOffset(null);
    
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
      onMouseLeave={handleMouseUp}
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
