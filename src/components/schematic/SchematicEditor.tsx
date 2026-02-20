/**
 * SchematicEditor Component
 * 
 * Interactive Fabric.js canvas editor for meter placement and connection drawing.
 * Adapted from WM-tariffs project to use project_id-based data model.
 * 
 * CRITICAL: Uses dual state+ref pattern for Fabric.js event handlers to avoid stale closures.
 */

import { useEffect, useRef, useState } from "react";
import { Canvas as FabricCanvas, Circle, Line, FabricImage, Rect, Point, Polyline, FabricText } from "fabric";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, Link2, Trash2, Plus, ZoomIn, ZoomOut, Maximize2, Edit, Loader2, Eye, EyeOff, GitBranch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { QuickMeterDialog } from "./QuickMeterDialog";
import { MeterConnectionsManager } from "./MeterConnectionsManager";

interface SchematicEditorProps {
  schematicId: string;
  schematicUrl: string | null;
  projectId: string;
  isActive?: boolean;
}

// Helper: calculate snap points on meter card edges
const calculateSnapPoints = (left: number, top: number, width: number, height: number) => {
  const centerX = left + width / 2;
  const centerY = top + height / 2;
  return {
    top: { x: centerX, y: top },
    right: { x: left + width, y: centerY },
    bottom: { x: centerX, y: top + height },
    left: { x: left, y: centerY }
  };
};

// Helper: find nearest snap point within threshold
const findNearestSnapPoint = (
  canvas: FabricCanvas,
  pointer: { x: number; y: number },
  threshold: number = 15
): { x: number; y: number; meterId: string } | null => {
  let nearestPoint: { x: number; y: number; meterId: string } | null = null;
  let minDistance = threshold;
  canvas.getObjects().forEach((obj: any) => {
    if (obj.isSnapPoint && obj.type === 'circle') {
      const distance = Math.sqrt(Math.pow(pointer.x - obj.left, 2) + Math.pow(pointer.y - obj.top, 2));
      if (distance < minDistance) {
        minDistance = distance;
        nearestPoint = { x: obj.left, y: obj.top, meterId: obj.meterId };
      }
    }
  });
  return nearestPoint;
};

// Helper: snap to 45-degree angles
const snapToAngle = (from: { x: number; y: number }, to: { x: number; y: number }) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);
  const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
  return { x: from.x + Math.cos(snapped) * distance, y: from.y + Math.sin(snapped) * distance };
};

// Helper: snap pointer to nearest meter's vertical or horizontal axis
const snapToNearestMeterAxis = (
  canvas: FabricCanvas,
  pointer: { x: number; y: number },
  excludeMeterId?: string
): { x: number; y: number } => {
  let bestX = pointer.x;
  let bestY = pointer.y;
  let minDx = Infinity;
  let minDy = Infinity;

  canvas.getObjects().forEach((obj: any) => {
    if (!obj.isMeterCard) return;
    if (excludeMeterId && obj.meterId === excludeMeterId) return;
    // Cards use originX/Y: 'center', so obj.left/top IS the centre
    const cx = obj.left;
    const cy = obj.top;
    const dx = Math.abs(pointer.x - cx);
    const dy = Math.abs(pointer.y - cy);
    if (dx < minDx) { minDx = dx; bestX = cx; }
    if (dy < minDy) { minDy = dy; bestY = cy; }
  });

  // Only snap if within a reasonable threshold (80px)
  const threshold = 80;
  return {
    x: minDx < threshold ? bestX : pointer.x,
    y: minDy < threshold ? bestY : pointer.y,
  };
};

// Helper: create meter card as canvas image
async function createMeterCardImage(
  fields: Array<{ label: string; value: string }>,
  borderColor: string
): Promise<string> {
  const baseWidth = 600;
  const baseHeight = 210;
  const canvas = document.createElement('canvas');
  canvas.width = baseWidth;
  canvas.height = baseHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const rowHeight = baseHeight / fields.length;
  const labelColumnWidth = 180;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, baseWidth, baseHeight);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 6;
  ctx.strokeRect(0, 0, baseWidth, baseHeight);

  fields.forEach((field, i) => {
    const y = i * rowHeight;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(labelColumnWidth, y);
    ctx.lineTo(labelColumnWidth, y + rowHeight);
    ctx.stroke();
    if (i < fields.length - 1) {
      ctx.beginPath();
      ctx.moveTo(0, y + rowHeight);
      ctx.lineTo(baseWidth, y + rowHeight);
      ctx.stroke();
    }
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 16px Arial, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(field.label, 12, y + rowHeight / 2);
    ctx.font = 'normal 16px Arial, sans-serif';
    const valueX = labelColumnWidth + 12;
    const maxWidth = baseWidth - valueX - 12;
    let display = field.value;
    if (ctx.measureText(display).width > maxWidth) {
      while (ctx.measureText(display + '...').width > maxWidth && display.length > 0) display = display.slice(0, -1);
      display += '...';
    }
    ctx.fillText(display, valueX, y + rowHeight / 2);
  });

  return canvas.toDataURL();
}

export default function SchematicEditor({ schematicId, schematicUrl, projectId, isActive }: SchematicEditorProps) {
  const queryClient = useQueryClient();
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 1400, height: 900 });
  const canvasDimensionsRef = useRef({ width: 1400, height: 900 });
  const canvasInstanceRef = useRef<FabricCanvas | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const isEditModeRef = useRef(false);

  const [activeTool, setActiveTool] = useState<"select" | "meter" | "connection">("select");
  const activeToolRef = useRef<"select" | "meter" | "connection">("select");

  const [meters, setMeters] = useState<any[]>([]);
  const [meterPositions, setMeterPositions] = useState<any[]>([]);
  const [meterConnections, setMeterConnections] = useState<any[]>([]);
  const [schematicLines, setSchematicLines] = useState<any[]>([]);
  const [tenantProfileMap, setTenantProfileMap] = useState<Record<string, { tenantId: string; include: boolean }>>({}); 
  const tenantProfileMapRef = useRef<Record<string, { tenantId: string; include: boolean }>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isInitialDataLoaded, setIsInitialDataLoaded] = useState(false);
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const [zoom, setZoom] = useState(1);

  const [showMeterCards, setShowMeterCards] = useState(true);
  const [showConnections, setShowConnections] = useState(true);
  const [showBackground, setShowBackground] = useState(true);

  const [isAddMeterDialogOpen, setIsAddMeterDialogOpen] = useState(false);
  const [pendingMeterPosition, setPendingMeterPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isConnectionsDialogOpen, setIsConnectionsDialogOpen] = useState(false);

  const [connectionStart, setConnectionStart] = useState<{ meterId: string; position: { x: number; y: number } } | null>(null);
  const connectionStartRef = useRef<{ meterId: string; position: { x: number; y: number } } | null>(null);
  const [connectionPoints, setConnectionPoints] = useState<Array<{ meterId: string; position: { x: number; y: number } }>>([]);
  const connectionPointsRef = useRef<Array<{ meterId: string; position: { x: number; y: number } }>>([]);
  const connectionLineRef = useRef<Line | Polyline | null>(null);
  const connectionStartNodeRef = useRef<Circle | null>(null);
  const connectionNodesRef = useRef<Circle[]>([]);

  const isPanningRef = useRef(false);
  const lastPanPositionRef = useRef<{ x: number; y: number } | null>(null);

  // Sync refs
  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  useEffect(() => { connectionStartRef.current = connectionStart; }, [connectionStart]);
  useEffect(() => { connectionPointsRef.current = connectionPoints; }, [connectionPoints]);
  useEffect(() => { isEditModeRef.current = isEditMode; }, [isEditMode]);
  useEffect(() => { canvasDimensionsRef.current = canvasDimensions; }, [canvasDimensions]);

  // Cursor for connection mode
  useEffect(() => {
    if (fabricCanvas) {
      if (activeTool === 'connection') {
        fabricCanvas.defaultCursor = 'crosshair';
        fabricCanvas.hoverCursor = 'crosshair';
      } else {
        fabricCanvas.defaultCursor = 'default';
        fabricCanvas.hoverCursor = 'move';
      }
      fabricCanvas.renderAll();
    }
  }, [activeTool, fabricCanvas]);

  // Load data
  useEffect(() => {
  const load = async () => {
      setIsInitialDataLoaded(false);
      await Promise.all([fetchMeters(), fetchMeterPositions(), fetchMeterConnections(), fetchSchematicLines(), fetchTenantProfileMap()]);
      setIsInitialDataLoaded(true);
    };
    load();
  }, [schematicId, projectId]);

  // Re-fetch tenant profile map when the schematics tab becomes active
  useEffect(() => {
    if (isActive && isInitialDataLoaded) {
      fetchTenantProfileMap();
    }
  }, [isActive]);

  const fetchMeters = async () => {
    const { data } = await supabase.from("scada_imports").select("*").eq("project_id", projectId).order("site_name");
    setMeters(data || []);
  };

  const fetchMeterPositions = async () => {
    const { data } = await supabase.from("project_schematic_meter_positions").select("*").eq("schematic_id", schematicId);
    setMeterPositions(data || []);
  };

  const fetchMeterConnections = async () => {
    const { data } = await supabase.from("project_meter_connections").select("*").eq("project_id", projectId);
    setMeterConnections(data || []);
  };

  const fetchSchematicLines = async () => {
    const { data } = await supabase.from("project_schematic_lines").select("*").eq("schematic_id", schematicId).eq("line_type", "connection");
    setSchematicLines(data || []);
  };

  const fetchTenantProfileMap = async () => {
    const { data } = await supabase
      .from("project_tenants")
      .select("id, scada_import_id, include_in_load_profile")
      .eq("project_id", projectId)
      .not("scada_import_id", "is", null);
    const map: Record<string, { tenantId: string; include: boolean }> = {};
    (data || []).forEach((t: any) => {
      if (t.scada_import_id) {
        map[t.scada_import_id] = { tenantId: t.id, include: t.include_in_load_profile !== false };
      }
    });
    setTenantProfileMap(map);
    tenantProfileMapRef.current = map;
  };

  // Container resize
  useEffect(() => {
    if (!containerRef.current) return;
    const update = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      setCanvasDimensions({ width: w, height: Math.round(w * (900 / 1400)) });
    };
    update();
    const obs = new ResizeObserver(update);
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // Canvas init
  // Canvas init — runs ONCE, never recreated on resize
  useEffect(() => {
    if (!canvasRef.current || canvasInstanceRef.current) return;

    const dims = canvasDimensionsRef.current;
    const canvas = new FabricCanvas(canvasRef.current, {
      width: dims.width,
      height: dims.height,
      backgroundColor: "#f8f9fa",
      selection: false,
      renderOnAddRemove: true,
      preserveObjectStacking: true,
    });
    canvasInstanceRef.current = canvas;

    // Middle mouse pan
    const handleNativeMouseDown = (e: MouseEvent) => {
      if (e.button === 1) {
        e.preventDefault();
        isPanningRef.current = true;
        lastPanPositionRef.current = { x: e.clientX, y: e.clientY };
      }
    };
    const handleMouseUpGlobal = (e: MouseEvent) => {
      if (e.button === 1) { isPanningRef.current = false; lastPanPositionRef.current = null; }
    };
    window.addEventListener('mousedown', handleNativeMouseDown, true);
    window.addEventListener('mouseup', handleMouseUpGlobal);

    // Scroll zoom + pan
    canvas.on('mouse:wheel', (opt) => {
      const evt = opt.e as WheelEvent;
      evt.preventDefault();
      if (evt.ctrlKey || evt.metaKey) {
        canvas.relativePan(new Point(0, -evt.deltaY * 0.5));
      } else if (evt.shiftKey) {
        canvas.relativePan(new Point(-evt.deltaY * 0.5, 0));
      } else {
        const delta = evt.deltaY;
        let newZoom = canvas.getZoom() * (delta > 0 ? 0.95 : 1.05);
        newZoom = Math.min(Math.max(0.3, newZoom), 10);
        const pointer = canvas.getViewportPoint(evt);
        canvas.zoomToPoint(pointer, newZoom);
        setZoom(newZoom);
      }
    });

    // Mouse events
    canvas.on('mouse:down', (opt) => {
      const currentTool = activeToolRef.current;
      const target = opt.target;
      const evt = opt.e as MouseEvent;

      // Middle mouse pan
      if (evt.button === 1) return;

      // Meter placement mode
      if (currentTool === 'meter') {
        const pointer = canvas.getPointer(opt.e);
        const canvasWidth = canvas.getWidth();
        const canvasHeight = canvas.getHeight();
        const xPercent = (pointer.x / canvasWidth) * 100;
        const yPercent = (pointer.y / canvasHeight) * 100;
        setPendingMeterPosition({ x: xPercent, y: yPercent });
        setIsAddMeterDialogOpen(true);
        return;
      }

      // Connection mode
      if (currentTool === 'connection') {
        let pointer = canvas.getPointer(opt.e);
        const snappedPoint = findNearestSnapPoint(canvas, pointer);

        if (!connectionStartRef.current) {
          // Start a new connection
          if (snappedPoint) {
            setConnectionStart({ meterId: snappedPoint.meterId, position: { x: snappedPoint.x, y: snappedPoint.y } });
            const startNode = new Circle({
              left: snappedPoint.x, top: snappedPoint.y, radius: 6,
              fill: '#22c55e', stroke: '#ffffff', strokeWidth: 2,
              originX: 'center', originY: 'center', selectable: false, evented: false,
            });
            connectionStartNodeRef.current = startNode;
            canvas.add(startNode);
            canvas.renderAll();
            toast.info('Connection started. Click points to route, then click a meter to finish.');
          } else {
            toast.error('Click on a meter snap point to start a connection');
          }
          return;
        }

        // Complete or add intermediate node
        const shouldSnap = snappedPoint && snappedPoint.meterId !== connectionStartRef.current.meterId;
        if (shouldSnap && snappedPoint) {
          pointer = new Point(snappedPoint.x, snappedPoint.y);
          const allPoints = [
            connectionStartRef.current.position,
            ...connectionPointsRef.current.map(p => p.position),
            pointer
          ];

          const bgIdx = canvas.getObjects().findIndex(obj => (obj as any).isBackgroundImage);
          const lineSegments: Line[] = [];
          for (let i = 0; i < allPoints.length - 1; i++) {
            const seg = new Line([allPoints[i].x, allPoints[i].y, allPoints[i + 1].x, allPoints[i + 1].y], {
              stroke: '#000000', strokeWidth: 2, selectable: false, evented: true,
            });
            (seg as any).isConnectionLine = true;
            lineSegments.push(seg);
            if (bgIdx !== -1) canvas.insertAt(bgIdx + 1 + i, seg);
            else { canvas.add(seg); canvas.sendObjectToBack(seg); }
          }

          allPoints.forEach((point, index) => {
            const isEnd = index === 0 || index === allPoints.length - 1;
            const node = new Circle({
              left: point.x, top: point.y, radius: 5, fill: '#000000',
              originX: 'center', originY: 'center',
              selectable: !isEnd, evented: !isEnd, hasControls: false, hasBorders: false,
            });
            (node as any).isConnectionNode = true;
            const connected: Line[] = [];
            if (index > 0) connected.push(lineSegments[index - 1]);
            if (index < allPoints.length - 1) connected.push(lineSegments[index]);
            (node as any).connectedLines = connected;
            canvas.add(node);
          });

          // Save to DB
          const parentMeterId = connectionStartRef.current.meterId;
          const childMeterId = snappedPoint.meterId;
          (async () => {
            try {
              const { data: existing } = await supabase.from('project_meter_connections').select('id')
                .eq('parent_meter_id', parentMeterId).eq('child_meter_id', childMeterId).eq('project_id', projectId).maybeSingle();
              if (!existing) {
                await supabase.from('project_meter_connections').insert({ parent_meter_id: parentMeterId, child_meter_id: childMeterId, project_id: projectId });
              }
              const cw = canvas.getWidth();
              const ch = canvas.getHeight();
              const lineData = [];
              for (let i = 0; i < allPoints.length - 1; i++) {
                lineData.push({
                  schematic_id: schematicId, from_x: (allPoints[i].x / cw) * 100, from_y: (allPoints[i].y / ch) * 100,
                  to_x: (allPoints[i + 1].x / cw) * 100, to_y: (allPoints[i + 1].y / ch) * 100,
                  line_type: 'connection', color: '#000000', stroke_width: 2,
                  metadata: { parent_meter_id: parentMeterId, child_meter_id: childMeterId, node_index: i }
                });
              }
              await supabase.from('project_schematic_lines').insert(lineData);
              await fetchMeterConnections();
              await fetchSchematicLines();
              toast.success('Connection saved');
            } catch (err) { toast.error('Failed to save connection'); }
          })();

          // Cleanup
          connectionNodesRef.current.forEach(n => canvas.remove(n));
          connectionNodesRef.current = [];
          canvas.getObjects().filter((o: any) => o.isAxisGuide).forEach(o => canvas.remove(o));
          if (connectionLineRef.current) { canvas.remove(connectionLineRef.current); connectionLineRef.current = null; }
          if (connectionStartNodeRef.current) { canvas.remove(connectionStartNodeRef.current); connectionStartNodeRef.current = null; }
          setConnectionStart(null);
          setConnectionPoints([]);
          canvas.renderAll();
        } else if (!snappedPoint) {
          // Intermediate node
          if (evt.shiftKey) {
            // Snap to nearest meter's vertical/horizontal axis
            const axisSnapped = snapToNearestMeterAxis(canvas, pointer, connectionStartRef.current.meterId);
            pointer = new Point(axisSnapped.x, axisSnapped.y);
          }
          setConnectionPoints([...connectionPointsRef.current, { meterId: '', position: pointer }]);
          const node = new Circle({
            left: pointer.x, top: pointer.y, radius: 5, fill: '#f59e0b', stroke: '#ffffff', strokeWidth: 2,
            originX: 'center', originY: 'center', selectable: false, evented: false,
          });
          connectionNodesRef.current.push(node);
          canvas.add(node);
          canvas.renderAll();
        }
        return;
      }
    });

    // Mouse move for connection preview and panning
    canvas.on('mouse:move', (opt) => {
      const evt = opt.e as MouseEvent;
      if (isPanningRef.current && lastPanPositionRef.current) {
        canvas.relativePan(new Point(evt.clientX - lastPanPositionRef.current.x, evt.clientY - lastPanPositionRef.current.y));
        lastPanPositionRef.current = { x: evt.clientX, y: evt.clientY };
        return;
      }
      if (activeToolRef.current === 'connection' && connectionStartRef.current) {
        let pointer = canvas.getPointer(opt.e);
        const snapped = findNearestSnapPoint(canvas, pointer);
        // Remove old highlight
        const oldHL = canvas.getObjects().find((o: any) => o.isSnapHighlight);
        if (oldHL) canvas.remove(oldHL);

        // Remove old axis guide lines
        canvas.getObjects().filter((o: any) => o.isAxisGuide).forEach(o => canvas.remove(o));

        if (snapped) {
          pointer = new Point(snapped.x, snapped.y);
          const hl = new Circle({
            left: snapped.x, top: snapped.y, radius: 12, fill: 'transparent', stroke: '#10b981', strokeWidth: 3,
            originX: 'center', originY: 'center', selectable: false, evented: false,
          });
          (hl as any).isSnapHighlight = true;
          canvas.add(hl);
        } else if (evt.shiftKey) {
          // Snap to nearest meter's vertical/horizontal axis
          const axisSnapped = snapToNearestMeterAxis(canvas, pointer, connectionStartRef.current.meterId);
          pointer = new Point(axisSnapped.x, axisSnapped.y);

          // Draw visual guide lines for axis alignment
          const canvasWidth = canvas.getWidth() / (canvas.getZoom() || 1);
          const canvasHeight = canvas.getHeight() / (canvas.getZoom() || 1);
          if (axisSnapped.x !== pointer.x || Math.abs(axisSnapped.x - pointer.x) < 1) {
            const vLine = new Line([axisSnapped.x, 0, axisSnapped.x, canvasHeight], {
              stroke: '#3b82f6', strokeWidth: 1, strokeDashArray: [4, 4], selectable: false, evented: false, opacity: 0.5,
            });
            (vLine as any).isAxisGuide = true;
            canvas.add(vLine);
          }
          if (axisSnapped.y !== pointer.y || Math.abs(axisSnapped.y - pointer.y) < 1) {
            const hLine = new Line([0, axisSnapped.y, canvasWidth, axisSnapped.y], {
              stroke: '#3b82f6', strokeWidth: 1, strokeDashArray: [4, 4], selectable: false, evented: false, opacity: 0.5,
            });
            (hLine as any).isAxisGuide = true;
            canvas.add(hLine);
          }
        }
        // Update preview line
        if (connectionLineRef.current) canvas.remove(connectionLineRef.current);
        const lastPoint = connectionPointsRef.current.length > 0
          ? connectionPointsRef.current[connectionPointsRef.current.length - 1].position
          : connectionStartRef.current.position;
        const preview = new Line([lastPoint.x, lastPoint.y, pointer.x, pointer.y], {
          stroke: '#94a3b8', strokeWidth: 2, strokeDashArray: [5, 5], selectable: false, evented: false,
        });
        connectionLineRef.current = preview;
        canvas.add(preview);
        canvas.renderAll();
      }
    });

    // Object moving - handle connection node dragging AND meter card Shift-snapping
    canvas.on('object:moving', (opt) => {
      const target = opt.target;
      if (!target) return;

      // Connection node dragging
      if ((target as any).isConnectionNode) {
        const node = target as Circle;
        const connected = (node as any).connectedLines as Line[];
        if (!connected) return;
        connected.forEach((line, index) => {
          if (connected.length === 1) {
            const d1 = Math.sqrt(Math.pow((line.x1 || 0) - node.left!, 2) + Math.pow((line.y1 || 0) - node.top!, 2));
            const d2 = Math.sqrt(Math.pow((line.x2 || 0) - node.left!, 2) + Math.pow((line.y2 || 0) - node.top!, 2));
            if (d2 < d1) line.set({ x2: node.left, y2: node.top });
            else line.set({ x1: node.left, y1: node.top });
          } else {
            if (index === 0) line.set({ x2: node.left, y2: node.top });
            else line.set({ x1: node.left, y1: node.top });
          }
        });
        canvas.renderAll();
        return;
      }

      // Meter card Shift-snap: snap to nearest meter's horizontal/vertical axis
      if ((target as any).isMeterCard) {
        const lastEvt = (opt as any).e as MouseEvent | undefined;
        if (lastEvt && lastEvt.shiftKey) {
          const origX = target.left || 0;
          const origY = target.top || 0;
          const snapped = snapToNearestMeterAxis(canvas, { x: origX, y: origY }, (target as any).meterId);
          target.set({ left: snapped.x, top: snapped.y });

          // Remove old axis guides and draw new ones
          canvas.getObjects().filter((o: any) => o.isAxisGuide).forEach(o => canvas.remove(o));
          const cw = canvasDimensionsRef.current.width;
          const ch = canvasDimensionsRef.current.height;
          // Show vertical guide if X was snapped
          if (Math.abs(snapped.x - origX) > 1) {
            const vLine = new Line([snapped.x, 0, snapped.x, ch], {
              stroke: '#3b82f6', strokeWidth: 1, strokeDashArray: [4, 4], selectable: false, evented: false, opacity: 0.5,
            });
            (vLine as any).isAxisGuide = true;
            canvas.add(vLine);
          }
          // Show horizontal guide if Y was snapped
          if (Math.abs(snapped.y - origY) > 1) {
            const hLine = new Line([0, snapped.y, cw, snapped.y], {
              stroke: '#3b82f6', strokeWidth: 1, strokeDashArray: [4, 4], selectable: false, evented: false, opacity: 0.5,
            });
            (hLine as any).isAxisGuide = true;
            canvas.add(hLine);
          }
        } else {
          canvas.getObjects().filter((o: any) => o.isAxisGuide).forEach(o => canvas.remove(o));
        }
        canvas.renderAll();
      }
    });

    // Clean up axis guides when drag ends
    canvas.on('object:modified', (e) => {
      canvas.getObjects().filter((o: any) => o.isAxisGuide).forEach(o => canvas.remove(o));
      canvas.renderAll();
      const obj = e.target;
      if (obj && (obj as any).isMeterCard && (obj as any).data?.meterId) {
        const cw = canvasDimensionsRef.current.width;
        const ch = canvasDimensionsRef.current.height;
        const xPct = ((obj.left || 0) / cw) * 100;
        const yPct = ((obj.top || 0) / ch) * 100;
        const posId = (obj as any).data?.positionId;
        const meterId = (obj as any).data?.meterId;
        if (posId) {
          // Update local state so re-renders use the new position
          setMeterPositions(prev => prev.map(p => 
            p.id === posId ? { ...p, x_position: xPct, y_position: yPct } : p
          ));
          supabase.from('project_schematic_meter_positions').update({ x_position: xPct, y_position: yPct }).eq('id', posId)
            .then(({ error }) => { if (error) toast.error('Failed to save position'); else toast.success('Position saved'); });
        }
      }
    });

    setFabricCanvas(canvas);

    // Load background image
    if (schematicUrl) {
      FabricImage.fromURL(schematicUrl, { crossOrigin: 'anonymous' }).then((img) => {
        const scale = Math.min(canvasDimensions.width / (img.width || 1), canvasDimensions.height / (img.height || 1));
        img.set({ left: 0, top: 0, scaleX: scale, scaleY: scale, selectable: false, evented: false });
        (img as any).isBackgroundImage = true;
        canvas.add(img);
        canvas.sendObjectToBack(img);
        canvas.renderAll();
        setIsCanvasReady(true);
      });
    } else {
      // Blank canvas
      setIsCanvasReady(true);
    }

    return () => {
      window.removeEventListener('mousedown', handleNativeMouseDown, true);
      window.removeEventListener('mouseup', handleMouseUpGlobal);
      canvas.dispose();
      canvasInstanceRef.current = null;
    };
  }, [schematicUrl]);

  // Resize canvas without destroying it
  useEffect(() => {
    if (!fabricCanvas) return;
    fabricCanvas.setDimensions({ width: canvasDimensions.width, height: canvasDimensions.height });
    // Re-scale background image to fit
    const bg = fabricCanvas.getObjects().find((o: any) => o.isBackgroundImage);
    if (bg) {
      const scale = Math.min(canvasDimensions.width / ((bg as any).width || 1), canvasDimensions.height / ((bg as any).height || 1));
      bg.set({ scaleX: scale, scaleY: scale });
    }
    fabricCanvas.renderAll();
  }, [canvasDimensions, fabricCanvas]);

  // Update meter card selectability when edit mode changes
  useEffect(() => {
    if (!fabricCanvas) return;
    fabricCanvas.getObjects().forEach((obj: any) => {
      if (obj.type === 'image' && obj.data?.meterId) {
        obj.set({ selectable: isEditMode, hasControls: isEditMode, hoverCursor: isEditMode ? 'move' : 'pointer' });
        if (isEditMode) obj.setControlVisible('mtr', false);
      }
    });
    fabricCanvas.renderAll();
  }, [isEditMode, fabricCanvas]);

  // Render meter cards from saved positions
  useEffect(() => {
    if (!fabricCanvas || !isInitialDataLoaded || !isCanvasReady) return;

    // Clear old meter cards
    fabricCanvas.getObjects().filter((o: any) => o.type === 'image' && o.data?.meterId).forEach(o => fabricCanvas.remove(o));

    if (!showMeterCards) { fabricCanvas.renderAll(); return; }

    const cw = fabricCanvas.getWidth();
    const ch = fabricCanvas.getHeight();

    meterPositions.forEach(pos => {
      const meter = meters.find(m => m.id === pos.meter_id);
      const x = (pos.x_position / 100) * cw;
      const y = (pos.y_position / 100) * ch;

      const fields = [
        { label: 'METER:', value: meter?.meter_label || meter?.site_name || pos.meter_id },
        { label: 'SHOP:', value: meter?.shop_name || 'N/A' },
        { label: 'NO:', value: meter?.shop_number || 'N/A' },
        { label: 'FILE:', value: meter?.file_name || 'N/A' },
        { label: 'COLOUR:', value: meter?.meter_color || '#3b82f6' },
      ];

      createMeterCardImage(fields, '#3b82f6').then(dataUrl => {
        const imgEl = document.createElement('img');
        imgEl.src = dataUrl;
        imgEl.onload = () => {
          const cardW = 200;
          const cardH = 140;
          const scX = cardW / imgEl.width;
          const scY = cardH / imgEl.height;
          const savedScX = pos.scale_x ? Number(pos.scale_x) : 1.0;
          const savedScY = pos.scale_y ? Number(pos.scale_y) : 1.0;

          const img = new FabricImage(imgEl, {
            left: x, top: y, originX: 'center', originY: 'center',
            scaleX: scX * savedScX, scaleY: scY * savedScY,
            hasControls: isEditMode, selectable: isEditMode,
            hoverCursor: isEditMode ? 'move' : 'pointer', lockRotation: true,
          });
          img.setControlVisible('mtr', false);
          img.set('data', { meterId: pos.meter_id, positionId: pos.id });
          (img as any).isMeterCard = true;
          (img as any).meterId = pos.meter_id;
          fabricCanvas.add(img);
          fabricCanvas.bringObjectToFront(img);
          fabricCanvas.renderAll();
        };
      });
    });
  }, [fabricCanvas, isInitialDataLoaded, isCanvasReady, meterPositions, meters, showMeterCards, isEditMode, canvasDimensions]);

  // Render load profile inclusion checkboxes on meter cards
  useEffect(() => {
    if (!fabricCanvas || !isInitialDataLoaded || !isCanvasReady || !showMeterCards) return;

    // Clear old checkbox indicators
    fabricCanvas.getObjects().filter((o: any) => o.isProfileCheckbox).forEach(o => fabricCanvas.remove(o));

    // Wait for meter card images to load
    const timeout = setTimeout(() => {
      fabricCanvas.getObjects().forEach((obj: any) => {
        if (!obj.isMeterCard || !obj.data?.meterId) return;
        const meterId = obj.data.meterId;
        const tenantInfo = tenantProfileMap[meterId];
        const isIncluded = tenantInfo ? tenantInfo.include : true;

        const bounds = obj.getBoundingRect();
        const checkX = bounds.left + bounds.width - 10;
        const checkY = bounds.top + 10;

        // Background circle
        const bg = new Circle({
          left: checkX, top: checkY, radius: 9,
          fill: isIncluded ? '#22c55e' : '#94a3b8',
          stroke: '#ffffff', strokeWidth: 2,
          originX: 'center', originY: 'center',
          selectable: false, evented: true,
          hoverCursor: 'pointer',
        });
        (bg as any).isProfileCheckbox = true;
        (bg as any).linkedMeterId = meterId;

        // Tick mark for included
        if (isIncluded) {
          const tick = new FabricText('✓', {
            left: checkX, top: checkY,
            fontSize: 12, fill: '#ffffff', fontWeight: 'bold',
            originX: 'center', originY: 'center',
            selectable: false, evented: false,
          });
          (tick as any).isProfileCheckbox = true;
          fabricCanvas.add(bg);
          fabricCanvas.add(tick);
          fabricCanvas.bringObjectToFront(bg);
          fabricCanvas.bringObjectToFront(tick);
        } else {
          fabricCanvas.add(bg);
          fabricCanvas.bringObjectToFront(bg);
        }
      });
      fabricCanvas.renderAll();
    }, 200);

    return () => clearTimeout(timeout);
  }, [fabricCanvas, isInitialDataLoaded, isCanvasReady, showMeterCards, meterPositions, tenantProfileMap]);

  // Handle checkbox clicks on schematic to toggle include_in_load_profile
  useEffect(() => {
    if (!fabricCanvas) return;

    const handler = async (opt: any) => {
      const target = opt.target;
      if (!target || !(target as any).isProfileCheckbox) return;

      const meterId = (target as any).linkedMeterId;
      if (!meterId) return;

      const currentMap = tenantProfileMapRef.current;
      const tenantInfo = currentMap[meterId];
      if (!tenantInfo) return;

      const newValue = !tenantInfo.include;

      // Optimistically update local state + ref
      const updatedMap = { ...currentMap, [meterId]: { ...currentMap[meterId], include: newValue } };
      tenantProfileMapRef.current = updatedMap;
      setTenantProfileMap(updatedMap);

      try {
        const { error } = await supabase
          .from("project_tenants")
          .update({ include_in_load_profile: newValue } as any)
          .eq("id", tenantInfo.tenantId);

        if (error) throw error;

        // Invalidate tenants query so TenantManager picks up the change
        queryClient.invalidateQueries({ queryKey: ["project-tenants", projectId] });
      } catch (err: any) {
        // Roll back optimistic update
        const rolledBack = { ...tenantProfileMapRef.current, [meterId]: { ...tenantProfileMapRef.current[meterId], include: !newValue } };
        tenantProfileMapRef.current = rolledBack;
        setTenantProfileMap(rolledBack);
        toast.error("Failed to update: " + (err.message || "Unknown error"));
      }
    };

    fabricCanvas.on('mouse:down', handler);
    return () => { fabricCanvas.off('mouse:down', handler); };
  }, [fabricCanvas, projectId, queryClient]);

  // Render connection lines
  useEffect(() => {
    if (!fabricCanvas || !isInitialDataLoaded || !isCanvasReady) return;

    fabricCanvas.getObjects().filter((o: any) => o.isConnectionLine || o.isConnectionNode).forEach(o => fabricCanvas.remove(o));

    if (!schematicLines.length || !showConnections) { fabricCanvas.renderAll(); return; }

    const cw = fabricCanvas.getWidth();
    const ch = fabricCanvas.getHeight();
    const bgIdx = fabricCanvas.getObjects().findIndex(o => (o as any).isBackgroundImage);

    const groups = new Map<string, any[]>();
    schematicLines.forEach(line => {
      const key = `${line.metadata?.parent_meter_id}-${line.metadata?.child_meter_id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(line);
    });

    groups.forEach((lines) => {
      const sorted = lines.sort((a: any, b: any) => (a.metadata?.node_index || 0) - (b.metadata?.node_index || 0));
      const lineSegments: Line[] = [];
      const nodePositions: Array<{ x: number; y: number }> = [];

      sorted.forEach((ld: any, index: number) => {
        const fromX = (ld.from_x / 100) * cw;
        const fromY = (ld.from_y / 100) * ch;
        const toX = (ld.to_x / 100) * cw;
        const toY = (ld.to_y / 100) * ch;

        const seg = new Line([fromX, fromY, toX, toY], {
          stroke: ld.color || '#000000', strokeWidth: ld.stroke_width || 2,
          selectable: false, evented: true, hoverCursor: 'pointer',
        });
        (seg as any).isConnectionLine = true;
        (seg as any).lineId = ld.id;
        lineSegments.push(seg);
        if (bgIdx !== -1) fabricCanvas.insertAt(bgIdx + 1, seg);
        else fabricCanvas.add(seg);

        if (index === 0) nodePositions.push({ x: fromX, y: fromY });
        nodePositions.push({ x: toX, y: toY });
      });

      nodePositions.forEach((pos, index) => {
        const isEnd = index === 0 || index === nodePositions.length - 1;
        const node = new Circle({
          left: pos.x, top: pos.y, radius: 4, fill: '#000000',
          originX: 'center', originY: 'center',
          selectable: !isEnd, evented: true, hasControls: false, hasBorders: false,
          hoverCursor: isEnd ? 'pointer' : 'move',
        });
        (node as any).isConnectionNode = true;
        const connected: Line[] = [];
        if (index > 0) connected.push(lineSegments[index - 1]);
        if (index < nodePositions.length - 1) connected.push(lineSegments[index]);
        (node as any).connectedLines = connected;
        fabricCanvas.add(node);
      });
    });

    fabricCanvas.renderAll();
  }, [fabricCanvas, isInitialDataLoaded, isCanvasReady, schematicLines, showConnections, canvasDimensions]);

  // Add/remove snap points for connection mode
  useEffect(() => {
    if (!fabricCanvas) return;
    fabricCanvas.getObjects().filter((o: any) => o.isSnapPoint).forEach(o => fabricCanvas.remove(o));

    if (activeTool !== 'connection') {
      connectionNodesRef.current.forEach(n => fabricCanvas.remove(n));
      connectionNodesRef.current = [];
      if (connectionLineRef.current) { fabricCanvas.remove(connectionLineRef.current); connectionLineRef.current = null; }
      if (connectionStartNodeRef.current) { fabricCanvas.remove(connectionStartNodeRef.current); connectionStartNodeRef.current = null; }
      setConnectionPoints([]);
      setConnectionStart(null);
    }

    if (activeTool === 'connection') {
      fabricCanvas.getObjects().forEach((obj: any) => {
        if (obj.type === 'image' && obj.data?.meterId) {
          const bounds = obj.getBoundingRect();
          const snaps = calculateSnapPoints(bounds.left, bounds.top, bounds.width, bounds.height);
          Object.values(snaps).forEach((pt: any) => {
            const c = new Circle({
              left: pt.x, top: pt.y, radius: 8, fill: '#3b82f6',
              originX: 'center', originY: 'center', selectable: false, evented: true, opacity: 0.9, hoverCursor: 'crosshair',
            });
            (c as any).isSnapPoint = true;
            (c as any).meterId = obj.data.meterId;
            fabricCanvas.add(c);
          });
        }
      });
    }
    fabricCanvas.renderAll();
  }, [activeTool, fabricCanvas]);

  // Background visibility
  useEffect(() => {
    if (!fabricCanvas) return;
    fabricCanvas.getObjects().forEach((o: any) => { if (o.isBackgroundImage) o.set({ visible: showBackground }); });
    fabricCanvas.renderAll();
  }, [fabricCanvas, showBackground]);

  // Escape key cancels connection
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeTool === 'connection' && fabricCanvas) {
        connectionNodesRef.current.forEach(n => fabricCanvas.remove(n));
        connectionNodesRef.current = [];
        if (connectionLineRef.current) { fabricCanvas.remove(connectionLineRef.current); connectionLineRef.current = null; }
        if (connectionStartNodeRef.current) { fabricCanvas.remove(connectionStartNodeRef.current); connectionStartNodeRef.current = null; }
        setConnectionPoints([]);
        setConnectionStart(null);
        fabricCanvas.renderAll();
        toast.info('Connection cancelled');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeTool, fabricCanvas]);

  // Delete selected meter card (Delete/Backspace key)
  const handleDeleteSelectedMeter = async () => {
    if (!fabricCanvas || !isEditMode) return;
    const active = fabricCanvas.getActiveObject() as any;
    if (!active || !active.isMeterCard || !active.data?.positionId) {
      toast.error('Select a meter card to delete');
      return;
    }
    const positionId = active.data.positionId;
    const meterId = active.data.meterId;
    try {
      fabricCanvas.remove(active);
      fabricCanvas.renderAll();
      const { error } = await supabase
        .from('project_schematic_meter_positions')
        .delete()
        .eq('id', positionId);
      if (error) throw error;
      setMeterPositions(prev => prev.filter(p => p.id !== positionId));
      toast.success('Meter removed from schematic');
    } catch (err) {
      console.error('Error deleting meter position:', err);
      toast.error('Failed to delete meter');
      await fetchMeterPositions();
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && isEditMode && activeTool === 'select') {
        // Prevent browser back navigation on Backspace
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        handleDeleteSelectedMeter();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [fabricCanvas, isEditMode, activeTool]);

  // Zoom controls
  const handleZoomIn = () => {
    if (!fabricCanvas) return;
    const z = Math.min(fabricCanvas.getZoom() * 1.2, 10);
    fabricCanvas.setZoom(z);
    setZoom(z);
  };
  const handleZoomOut = () => {
    if (!fabricCanvas) return;
    const z = Math.max(fabricCanvas.getZoom() * 0.8, 0.3);
    fabricCanvas.setZoom(z);
    setZoom(z);
  };
  const handleResetView = () => {
    if (!fabricCanvas) return;
    fabricCanvas.setZoom(1);
    fabricCanvas.viewportTransform = [1, 0, 0, 1, 0, 0];
    setZoom(1);
    fabricCanvas.renderAll();
  };

  const handleSave = async () => {
    if (!fabricCanvas) return;
    setIsSaving(true);
    try {
      // Collect current positions from canvas objects using base dimensions (not zoomed)
      const cw = canvasDimensions.width;
      const ch = canvasDimensions.height;
      const updates: PromiseLike<any>[] = [];
      fabricCanvas.getObjects().forEach((obj: any) => {
        if (obj.isMeterCard && obj.data?.positionId) {
          const xPct = ((obj.left || 0) / cw) * 100;
          const yPct = ((obj.top || 0) / ch) * 100;
          updates.push(
            supabase.from('project_schematic_meter_positions')
              .update({ x_position: xPct, y_position: yPct })
              .eq('id', obj.data.positionId)
          );
        }
      });
      await Promise.all(updates);
      // Refresh positions from DB to ensure consistency
      await fetchMeterPositions();
      toast.success("Schematic saved");
    } catch (err) {
      toast.error("Failed to save schematic");
    } finally {
      setIsSaving(false);
      setIsEditMode(false);
      setActiveTool("select");
    }
  };

  const handleRefresh = async () => {
    toast.info("Refreshing...");
    setIsInitialDataLoaded(false);
    await Promise.all([fetchMeters(), fetchMeterPositions(), fetchMeterConnections(), fetchSchematicLines(), fetchTenantProfileMap()]);
    setIsInitialDataLoaded(true);
    toast.success("Refreshed");
  };

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        <Button
          variant={isEditMode ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setIsEditMode(!isEditMode);
            if (isEditMode) { setActiveTool("select"); }
          }}
        >
          <Edit className="w-4 h-4 mr-1" />
          {isEditMode ? "Editing" : "Edit"}
        </Button>

        <Separator orientation="vertical" className="h-6" />

        {isEditMode && (
          <>
            <Button variant={activeTool === "select" ? "secondary" : "outline"} size="sm" onClick={() => setActiveTool("select")}>
              Select
            </Button>
            <Button variant={activeTool === "meter" ? "secondary" : "outline"} size="sm" onClick={() => setActiveTool("meter")}>
              <Plus className="w-4 h-4 mr-1" />
              Place Meter
            </Button>
            <Button variant={activeTool === "connection" ? "secondary" : "outline"} size="sm" onClick={() => setActiveTool("connection")}>
              <Link2 className="w-4 h-4 mr-1" />
              Connect
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsConnectionsDialogOpen(true)}>
              <GitBranch className="w-4 h-4 mr-1" />
              Manage
            </Button>
            <Button variant="outline" size="sm" onClick={handleDeleteSelectedMeter} className="text-destructive hover:text-destructive">
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <Button variant="outline" size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              Save
            </Button>
          </>
        )}

        <Separator orientation="vertical" className="h-6" />

        <Button variant="outline" size="icon" onClick={handleZoomIn}><ZoomIn className="h-4 w-4" /></Button>
        <Badge variant="outline">{Math.round(zoom * 100)}%</Badge>
        <Button variant="outline" size="icon" onClick={handleZoomOut}><ZoomOut className="h-4 w-4" /></Button>
        <Button variant="outline" size="icon" onClick={handleResetView}><Maximize2 className="h-4 w-4" /></Button>

        <Separator orientation="vertical" className="h-6" />

        {/* Visibility toggles */}
        <Button variant={showMeterCards ? "secondary" : "outline"} size="sm" onClick={() => setShowMeterCards(!showMeterCards)}>
          {showMeterCards ? <Eye className="w-4 h-4 mr-1" /> : <EyeOff className="w-4 h-4 mr-1" />}
          Meters
        </Button>
        <Button variant={showConnections ? "secondary" : "outline"} size="sm" onClick={() => setShowConnections(!showConnections)}>
          {showConnections ? <Eye className="w-4 h-4 mr-1" /> : <EyeOff className="w-4 h-4 mr-1" />}
          Lines
        </Button>
        <Button variant={showBackground ? "secondary" : "outline"} size="sm" onClick={() => setShowBackground(!showBackground)}>
          {showBackground ? <Eye className="w-4 h-4 mr-1" /> : <EyeOff className="w-4 h-4 mr-1" />}
          Background
        </Button>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="relative border rounded-lg overflow-hidden bg-muted/30"
        style={{ height: `${canvasDimensions.height}px`, cursor: activeTool === 'connection' ? 'crosshair' : 'grab' }}
      >
        <canvas ref={canvasRef} />
        {!isCanvasReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
      </div>

      {/* Quick Meter Dialog */}
      <QuickMeterDialog
        open={isAddMeterDialogOpen}
        onClose={() => setIsAddMeterDialogOpen(false)}
        projectId={projectId}
        position={pendingMeterPosition}
        schematicId={schematicId}
        onMeterPlaced={() => { fetchMeters(); fetchMeterPositions(); fetchTenantProfileMap(); }}
      />

      {/* Meter Connections Manager */}
      <MeterConnectionsManager
        open={isConnectionsDialogOpen}
        onOpenChange={setIsConnectionsDialogOpen}
        projectId={projectId}
        schematicId={schematicId}
        onConnectionsChanged={() => { fetchMeterConnections(); fetchSchematicLines(); }}
      />
    </div>
  );
}
