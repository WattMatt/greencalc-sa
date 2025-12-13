import { useState, useCallback, useEffect } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import { Tool, ViewState, ScaleInfo, PVPanelConfig, DesignState, initialDesignState, Point, RoofMask } from './types';
import { DEFAULT_PV_PANEL_CONFIG } from './constants';
import { Toolbar } from './components/Toolbar';
import { Canvas } from './components/Canvas';
import { SummaryPanel } from './components/SummaryPanel';
import { ScaleModal } from './components/ScaleModal';
import { PVConfigModal } from './components/PVConfigModal';
import { RoofMaskModal } from './components/RoofMaskModal';
import { PVArrayModal, PVArrayConfig } from './components/PVArrayModal';
import { toast } from 'sonner';

// Set PDF.js worker
if (typeof window !== 'undefined') {
  GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`;
}

interface FloorPlanMarkupProps {
  projectId: string;
}

export function FloorPlanMarkup({ projectId }: FloorPlanMarkupProps) {
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [activeTool, setActiveTool] = useState<Tool>(Tool.PAN);
  const [viewState, setViewState] = useState<ViewState>({ zoom: 1, offset: { x: 0, y: 0 } });
  
  // History for undo/redo
  const [history, setHistory] = useState<DesignState[]>([initialDesignState]);
  const [historyIndex, setHistoryIndex] = useState(0);
  
  const currentDesign = history[historyIndex];
  const { equipment, lines, roofMasks, pvArrays } = currentDesign;
  
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const commitState = useCallback((newState: DesignState) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newState);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  const setEquipment = (updater: (prev: typeof equipment) => typeof equipment) => 
    commitState({ ...currentDesign, equipment: updater(equipment) });
  const setLines = (updater: (prev: typeof lines) => typeof lines) => 
    commitState({ ...currentDesign, lines: updater(lines) });
  const setRoofMasks = (updater: (prev: typeof roofMasks) => typeof roofMasks) => 
    commitState({ ...currentDesign, roofMasks: updater(roofMasks) });
  const setPvArrays = (updater: (prev: typeof pvArrays) => typeof pvArrays) => 
    commitState({ ...currentDesign, pvArrays: updater(pvArrays) });

  const handleUndo = () => historyIndex > 0 && setHistoryIndex(historyIndex - 1);
  const handleRedo = () => historyIndex < history.length - 1 && setHistoryIndex(historyIndex + 1);

  // Scale & Config
  const [scaleInfo, setScaleInfo] = useState<ScaleInfo>({ pixelDistance: null, realDistance: null, ratio: null });
  const [scaleLine, setScaleLine] = useState<{ start: Point; end: Point } | null>(null);
  const [pvPanelConfig, setPvPanelConfig] = useState<PVPanelConfig | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [placementRotation, setPlacementRotation] = useState(0);

  // Modals
  const [isScaleModalOpen, setIsScaleModalOpen] = useState(false);
  const [isPVConfigModalOpen, setIsPVConfigModalOpen] = useState(false);
  const [isRoofMaskModalOpen, setIsRoofMaskModalOpen] = useState(false);
  const [isPVArrayModalOpen, setIsPVArrayModalOpen] = useState(false);
  const [pendingScalePixels, setPendingScalePixels] = useState(0);
  const [pendingRoofMask, setPendingRoofMask] = useState<{ points: Point[]; area: number } | null>(null);
  const [pendingPvArrayConfig, setPendingPvArrayConfig] = useState<PVArrayConfig | null>(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        setPlacementRotation(r => (r + 45) % 360);
      }
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
      if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
      if (e.key === 'Escape') {
        setActiveTool(Tool.SELECT);
        setPendingPvArrayConfig(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, history.length]);

  const handleLoadPdf = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const doc = await getDocument(arrayBuffer).promise;
      setPdfDoc(doc);
      toast.success('PDF loaded successfully');
    } catch (error) {
      toast.error('Failed to load PDF');
    }
  };

  const handleScaleComplete = (pixelDistance: number) => {
    setPendingScalePixels(pixelDistance);
    setIsScaleModalOpen(true);
  };

  const handleScaleConfirm = (realDistance: number) => {
    const ratio = realDistance / pendingScalePixels;
    setScaleInfo({ pixelDistance: pendingScalePixels, realDistance, ratio });
    setIsScaleModalOpen(false);
    setActiveTool(Tool.SELECT);
    toast.success(`Scale set: ${(ratio * 1000).toFixed(2)} mm/pixel`);
  };

  const handleRoofMaskComplete = (points: Point[], area: number) => {
    setPendingRoofMask({ points, area });
    setIsRoofMaskModalOpen(true);
  };

  const handleRoofMaskConfirm = (pitch: number) => {
    if (!pendingRoofMask) return;
    const newMask: RoofMask = {
      id: `roof-${Date.now()}`,
      points: pendingRoofMask.points,
      pitch,
      direction: 180, // Default south-facing
      area: pendingRoofMask.area,
    };
    setRoofMasks(prev => [...prev, newMask]);
    setPendingRoofMask(null);
    setIsRoofMaskModalOpen(false);
    toast.success('Roof mask added');
  };

  const handlePVArrayConfirm = (config: PVArrayConfig) => {
    setPendingPvArrayConfig(config);
    setIsPVArrayModalOpen(false);
    setActiveTool(Tool.PV_ARRAY);
    toast.info('Click on a roof mask to place the array');
  };

  return (
    <div className="flex h-[calc(100vh-200px)] min-h-[600px] rounded-lg overflow-hidden border">
      <Toolbar
        activeTool={activeTool}
        setActiveTool={(tool) => {
          if (tool === Tool.PV_ARRAY && pvPanelConfig) {
            setIsPVArrayModalOpen(true);
          } else {
            setActiveTool(tool);
          }
        }}
        scaleInfo={scaleInfo}
        pvPanelConfig={pvPanelConfig}
        pvArrays={pvArrays}
        onLoadPdf={handleLoadPdf}
        onOpenPVConfig={() => setIsPVConfigModalOpen(true)}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        placementRotation={placementRotation}
        setPlacementRotation={setPlacementRotation}
        pdfLoaded={!!pdfDoc}
      />
      
      <Canvas
        pdfDoc={pdfDoc}
        activeTool={activeTool}
        viewState={viewState}
        setViewState={setViewState}
        scaleInfo={scaleInfo}
        scaleLine={scaleLine}
        setScaleLine={setScaleLine}
        onScaleComplete={handleScaleComplete}
        pvPanelConfig={pvPanelConfig}
        roofMasks={roofMasks}
        setRoofMasks={setRoofMasks}
        pvArrays={pvArrays}
        setPvArrays={setPvArrays}
        equipment={equipment}
        setEquipment={setEquipment}
        lines={lines}
        setLines={setLines}
        selectedItemId={selectedItemId}
        setSelectedItemId={setSelectedItemId}
        placementRotation={placementRotation}
        pendingPvArrayConfig={pendingPvArrayConfig}
        onRoofMaskComplete={handleRoofMaskComplete}
        onArrayPlaced={() => setPendingPvArrayConfig(null)}
      />

      <SummaryPanel
        pvArrays={pvArrays}
        roofMasks={roofMasks}
        lines={lines}
        equipment={equipment}
        pvPanelConfig={pvPanelConfig}
        scaleInfo={scaleInfo}
        selectedItemId={selectedItemId}
        onSelectItem={setSelectedItemId}
      />

      <ScaleModal
        isOpen={isScaleModalOpen}
        onClose={() => { setIsScaleModalOpen(false); setScaleLine(null); }}
        pixelDistance={pendingScalePixels}
        onConfirm={handleScaleConfirm}
      />

      <PVConfigModal
        isOpen={isPVConfigModalOpen}
        onClose={() => setIsPVConfigModalOpen(false)}
        currentConfig={pvPanelConfig}
        onConfirm={(config) => { setPvPanelConfig(config); setIsPVConfigModalOpen(false); toast.success('Panel config saved'); }}
      />

      <RoofMaskModal
        isOpen={isRoofMaskModalOpen}
        onClose={() => { setIsRoofMaskModalOpen(false); setPendingRoofMask(null); }}
        area={pendingRoofMask?.area || 0}
        onConfirm={handleRoofMaskConfirm}
      />

      {pvPanelConfig && (
        <PVArrayModal
          isOpen={isPVArrayModalOpen}
          onClose={() => setIsPVArrayModalOpen(false)}
          pvPanelConfig={pvPanelConfig}
          onConfirm={handlePVArrayConfirm}
        />
      )}
    </div>
  );
}
