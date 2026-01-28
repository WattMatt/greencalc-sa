import { useRef, useEffect, useState } from 'react';
import { Tool, ViewState, Point, ScaleInfo, PVPanelConfig, RoofMask, PVArrayItem, EquipmentItem, SupplyLine, EquipmentType } from '../types';
import { renderAllMarkups } from '../utils/drawing';
import { calculatePolygonArea, calculateLineLength, distance, calculateArrayRotationForRoof, isPointInPolygon } from '../utils/geometry';
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
  onArrayPlaced: () => void;
}

export function Canvas({
  backgroundImage, activeTool, viewState, setViewState,
  scaleInfo, scaleLine, setScaleLine, onScaleComplete,
  pvPanelConfig, roofMasks, setRoofMasks, pvArrays, setPvArrays,
  equipment, setEquipment, lines, setLines,
  selectedItemId, setSelectedItemId, placementRotation,
  pendingPvArrayConfig, onRoofMaskComplete, onArrayPlaced,
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
    }
    
    ctx.restore();
  }, [viewState, equipment, lines, roofMasks, pvArrays, scaleInfo, pvPanelConfig, selectedItemId, scaleLine, currentDrawing, previewPoint, canvasSize, containerSize, activeTool]);

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

    if (activeTool === Tool.PAN || e.button === 1) {
      setIsPanning(true);
      return;
    }

    if (activeTool === Tool.SCALE) {
      if (!scaleLine) {
        setScaleLine({ start: worldPos, end: worldPos });
      }
    } else if (activeTool === Tool.ROOF_MASK || activeTool === Tool.LINE_DC || activeTool === Tool.LINE_AC) {
      setCurrentDrawing([...currentDrawing, worldPos]);
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

    if (isPanning) {
      const dx = screenPos.x - lastMousePos.x;
      const dy = screenPos.y - lastMousePos.y;
      setViewState({ ...viewState, offset: { x: viewState.offset.x + dx, y: viewState.offset.y + dy } });
      setLastMousePos(screenPos);
      return;
    }

    if (activeTool === Tool.SCALE && scaleLine) {
      setScaleLine({ ...scaleLine, end: worldPos });
    }

    if (currentDrawing.length > 0) {
      setPreviewPoint(worldPos);
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    
    if (activeTool === Tool.SCALE && scaleLine) {
      const dist = distance(scaleLine.start, scaleLine.end);
      if (dist > 10) {
        onScaleComplete(dist);
      } else {
        setScaleLine(null);
      }
    }
  };

  const handleDoubleClick = () => {
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
      className="relative flex-1 overflow-hidden bg-muted cursor-crosshair"
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
        </>
      )}
    </div>
  );
}
