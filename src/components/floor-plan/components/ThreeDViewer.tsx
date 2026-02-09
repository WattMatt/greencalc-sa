import { useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Text } from '@react-three/drei';
import * as THREE from 'three';
import { PVArrayItem, RoofMask, SupplyLine, EquipmentItem, PVPanelConfig, ScaleInfo, PlacedWalkway, PlacedCableTray, EquipmentType } from '../types';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

interface ThreeDViewerProps {
  pvArrays: PVArrayItem[];
  roofMasks: RoofMask[];
  lines: SupplyLine[];
  equipment: EquipmentItem[];
  pvPanelConfig: PVPanelConfig | null;
  scaleInfo: ScaleInfo;
  placedWalkways: PlacedWalkway[];
  placedCableTrays: PlacedCableTray[];
  selectedItemId: string | null;
  onSelectItem?: (id: string | null) => void;
}

// Color constants matching 2D canvas
const COLORS = {
  roofMask: '#9470d8',
  pvPanel: '#1a56db',
  inverter: '#f97316',
  dcCombiner: '#eab308',
  acDisconnect: '#ef4444',
  mainBoard: '#22c55e',
  subBoard: '#6366f1',
  dcCable: '#f97316',
  acCable: '#4d4dff',
  walkway: '#a3a3a3',
  cableTray: '#78716c',
  selected: '#00ff88',
};

const EQUIPMENT_COLORS: Record<EquipmentType, string> = {
  [EquipmentType.INVERTER]: COLORS.inverter,
  [EquipmentType.DC_COMBINER]: COLORS.dcCombiner,
  [EquipmentType.AC_DISCONNECT]: COLORS.acDisconnect,
  [EquipmentType.MAIN_BOARD]: COLORS.mainBoard,
  [EquipmentType.SUB_BOARD]: COLORS.subBoard,
};

// Equipment default sizes in meters
const EQUIPMENT_SIZES: Record<EquipmentType, { w: number; h: number; d: number }> = {
  [EquipmentType.INVERTER]: { w: 0.7, h: 0.5, d: 0.3 },
  [EquipmentType.DC_COMBINER]: { w: 0.4, h: 0.3, d: 0.2 },
  [EquipmentType.AC_DISCONNECT]: { w: 0.3, h: 0.2, d: 0.15 },
  [EquipmentType.MAIN_BOARD]: { w: 1.2, h: 0.4, d: 0.2 },
  [EquipmentType.SUB_BOARD]: { w: 0.8, h: 0.3, d: 0.15 },
};

function RoofMaskMesh({ mask, scaleRatio }: { mask: RoofMask; scaleRatio: number }) {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    if (mask.points.length < 3) return s;
    s.moveTo(mask.points[0].x * scaleRatio, -mask.points[0].y * scaleRatio);
    for (let i = 1; i < mask.points.length; i++) {
      s.lineTo(mask.points[i].x * scaleRatio, -mask.points[i].y * scaleRatio);
    }
    s.closePath();
    return s;
  }, [mask.points, scaleRatio]);

  const pitchRad = (mask.pitch * Math.PI) / 180;

  return (
    <mesh rotation={[-Math.PI / 2 + pitchRad, 0, 0]} position={[0, 0.01, 0]}>
      <shapeGeometry args={[shape]} />
      <meshStandardMaterial color={COLORS.roofMask} transparent opacity={0.3} side={THREE.DoubleSide} />
    </mesh>
  );
}

function PVArrayMesh({
  array,
  pvPanelConfig,
  scaleRatio,
  isSelected,
  onClick,
}: {
  array: PVArrayItem;
  pvPanelConfig: PVPanelConfig;
  scaleRatio: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  const panelW = array.orientation === 'portrait' ? pvPanelConfig.width : pvPanelConfig.length;
  const panelL = array.orientation === 'portrait' ? pvPanelConfig.length : pvPanelConfig.width;
  const totalW = array.columns * panelW;
  const totalL = array.rows * panelL;
  const elevation = array.elevation ?? 0;
  const rotRad = (array.rotation * Math.PI) / 180;

  return (
    <mesh
      position={[
        array.position.x * scaleRatio,
        elevation + 0.02,
        -array.position.y * scaleRatio,
      ]}
      rotation={[-Math.PI / 2, 0, -rotRad]}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <boxGeometry args={[totalW, totalL, 0.04]} />
      <meshStandardMaterial
        color={isSelected ? COLORS.selected : COLORS.pvPanel}
        transparent
        opacity={0.85}
      />
    </mesh>
  );
}

function EquipmentMesh({
  item,
  scaleRatio,
  isSelected,
  onClick,
}: {
  item: EquipmentItem;
  scaleRatio: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  const size = EQUIPMENT_SIZES[item.type] || { w: 0.5, h: 0.3, d: 0.2 };
  const elevation = item.elevation ?? 0;

  return (
    <mesh
      position={[
        item.position.x * scaleRatio,
        elevation + size.d / 2,
        -item.position.y * scaleRatio,
      ]}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <boxGeometry args={[size.w, size.d, size.h]} />
      <meshStandardMaterial
        color={isSelected ? COLORS.selected : EQUIPMENT_COLORS[item.type]}
      />
    </mesh>
  );
}

function CableLine({
  cable,
  scaleRatio,
  isSelected,
  onClick,
}: {
  cable: SupplyLine;
  scaleRatio: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  const points = useMemo(() => {
    return cable.points.map((p, i) => {
      const elev = cable.elevations?.[i] ?? 0;
      return new THREE.Vector3(p.x * scaleRatio, elev, -p.y * scaleRatio);
    });
  }, [cable.points, cable.elevations, scaleRatio]);

  if (points.length < 2) return null;

  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0);
  const tubeRadius = 0.03;

  return (
    <mesh onClick={(e) => { e.stopPropagation(); onClick(); }}>
      <tubeGeometry args={[curve, 64, tubeRadius, 8, false]} />
      <meshStandardMaterial
        color={isSelected ? COLORS.selected : cable.type === 'dc' ? COLORS.dcCable : COLORS.acCable}
      />
    </mesh>
  );
}

function WalkwayMesh({
  walkway,
  scaleRatio,
  isSelected,
  onClick,
}: {
  walkway: PlacedWalkway;
  scaleRatio: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  const elevation = walkway.elevation ?? 0;
  const w = walkway.width;
  const l = walkway.length;

  return (
    <mesh
      position={[
        walkway.position.x * scaleRatio,
        elevation + 0.01,
        -walkway.position.y * scaleRatio,
      ]}
      rotation={[-Math.PI / 2, 0, -(walkway.rotation * Math.PI) / 180]}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <boxGeometry args={[w, l, 0.02]} />
      <meshStandardMaterial
        color={isSelected ? COLORS.selected : COLORS.walkway}
        transparent
        opacity={0.6}
      />
    </mesh>
  );
}

function CableTrayMesh({
  tray,
  scaleRatio,
  isSelected,
  onClick,
}: {
  tray: PlacedCableTray;
  scaleRatio: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  const elevation = tray.elevation ?? 0;

  return (
    <mesh
      position={[
        tray.position.x * scaleRatio,
        elevation + 0.02,
        -tray.position.y * scaleRatio,
      ]}
      rotation={[-Math.PI / 2, 0, -(tray.rotation * Math.PI) / 180]}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <boxGeometry args={[tray.width, tray.length, 0.03]} />
      <meshStandardMaterial
        color={isSelected ? COLORS.selected : COLORS.cableTray}
        transparent
        opacity={0.7}
      />
    </mesh>
  );
}

function Scene({
  pvArrays,
  roofMasks,
  lines,
  equipment,
  pvPanelConfig,
  scaleRatio,
  placedWalkways,
  placedCableTrays,
  selectedItemId,
  onSelectItem,
}: ThreeDViewerProps & { scaleRatio: number }) {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 10]} intensity={0.8} />
      <OrbitControls makeDefault />
      <Grid
        args={[100, 100]}
        position={[0, 0, 0]}
        cellSize={1}
        cellColor="#444"
        sectionSize={5}
        sectionColor="#666"
        fadeDistance={50}
      />

      {/* Roof Masks */}
      {roofMasks.map((mask) => (
        <RoofMaskMesh key={mask.id} mask={mask} scaleRatio={scaleRatio} />
      ))}

      {/* PV Arrays */}
      {pvPanelConfig &&
        pvArrays.map((arr) => (
          <PVArrayMesh
            key={arr.id}
            array={arr}
            pvPanelConfig={pvPanelConfig}
            scaleRatio={scaleRatio}
            isSelected={selectedItemId === arr.id}
            onClick={() => onSelectItem?.(arr.id)}
          />
        ))}

      {/* Equipment */}
      {equipment.map((item) => (
        <EquipmentMesh
          key={item.id}
          item={item}
          scaleRatio={scaleRatio}
          isSelected={selectedItemId === item.id}
          onClick={() => onSelectItem?.(item.id)}
        />
      ))}

      {/* Cables */}
      {lines.map((cable) => (
        <CableLine
          key={cable.id}
          cable={cable}
          scaleRatio={scaleRatio}
          isSelected={selectedItemId === cable.id}
          onClick={() => onSelectItem?.(cable.id)}
        />
      ))}

      {/* Walkways */}
      {placedWalkways.map((w) => (
        <WalkwayMesh
          key={w.id}
          walkway={w}
          scaleRatio={scaleRatio}
          isSelected={selectedItemId === w.id}
          onClick={() => onSelectItem?.(w.id)}
        />
      ))}

      {/* Cable Trays */}
      {placedCableTrays.map((t) => (
        <CableTrayMesh
          key={t.id}
          tray={t}
          scaleRatio={scaleRatio}
          isSelected={selectedItemId === t.id}
          onClick={() => onSelectItem?.(t.id)}
        />
      ))}
    </>
  );
}

export function ThreeDViewer(props: ThreeDViewerProps) {
  const controlsRef = useRef<any>(null);
  const scaleRatio = props.scaleInfo.ratio || 0.01; // meters per pixel

  const handleResetView = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  return (
    <div className="relative w-full h-full bg-background">
      <Canvas
        camera={{ position: [15, 20, 15] as [number, number, number], fov: 50, near: 0.1, far: 1000 }}
        style={{ width: '100%', height: '100%' }}
        onPointerMissed={() => props.onSelectItem?.(null)}
      >
        <Scene {...props} scaleRatio={scaleRatio} />
      </Canvas>

      {/* Reset View button */}
      <div className="absolute top-3 right-3">
        <Button variant="secondary" size="sm" onClick={handleResetView}>
          <RotateCcw className="h-4 w-4 mr-1" />
          Reset View
        </Button>
      </div>

      {/* Info overlay */}
      <div className="absolute bottom-3 left-3 bg-card/80 backdrop-blur-sm rounded-md px-3 py-2 text-xs text-muted-foreground">
        3D View (read-only) · Orbit: drag · Zoom: scroll · Pan: right-drag
      </div>
    </div>
  );
}
