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
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Save, CloudDownload, Loader2 } from 'lucide-react';

// Set PDF.js worker
if (typeof window !== 'undefined') {
  GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`;
}

interface FloorPlanMarkupProps {
  projectId: string;
}

export function FloorPlanMarkup({ projectId, readOnly = false }: FloorPlanMarkupProps & { readOnly?: boolean }) {
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<Tool>(Tool.PAN);
  const [viewState, setViewState] = useState<ViewState>({ zoom: 1, offset: { x: 0, y: 0 } });
  const [layoutId, setLayoutId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // History for undo/redo
  const [history, setHistory] = useState<DesignState[]>([initialDesignState]);
  const [historyIndex, setHistoryIndex] = useState(0);
  
  const currentDesign = history[historyIndex];
  const { equipment, lines, roofMasks, pvArrays } = currentDesign;
  
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const commitState = useCallback((newState: DesignState) => {
    if (readOnly) return;
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newState);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setHasUnsavedChanges(true);
  }, [history, historyIndex, readOnly]);

  const setEquipment = (updater: (prev: typeof equipment) => typeof equipment) => 
    commitState({ ...currentDesign, equipment: updater(equipment) });
  const setLines = (updater: (prev: typeof lines) => typeof lines) => 
    commitState({ ...currentDesign, lines: updater(lines) });
  const setRoofMasks = (updater: (prev: typeof roofMasks) => typeof roofMasks) => 
    commitState({ ...currentDesign, roofMasks: updater(roofMasks) });
  const setPvArrays = (updater: (prev: typeof pvArrays) => typeof pvArrays) => 
    commitState({ ...currentDesign, pvArrays: updater(pvArrays) });

  const handleUndo = () => !readOnly && historyIndex > 0 && setHistoryIndex(historyIndex - 1);
  const handleRedo = () => !readOnly && historyIndex < history.length - 1 && setHistoryIndex(historyIndex + 1);

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

  // Load saved layout on mount
  useEffect(() => {
    const loadLayout = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('pv_layouts')
          .select('*')
          .eq('project_id', projectId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setLayoutId(data.id);
          
          // Restore scale
          if (data.scale_pixels_per_meter) {
            setScaleInfo({
              pixelDistance: null,
              realDistance: null,
              ratio: 1 / Number(data.scale_pixels_per_meter)
            });
          }

          // Restore PV config
          if (data.pv_config) {
            setPvPanelConfig(data.pv_config as unknown as PVPanelConfig);
          }

          // Restore design state
          const loadedState: DesignState = {
            roofMasks: (data.roof_masks as unknown as RoofMask[]) || [],
            pvArrays: (data.pv_arrays as unknown as any[]) || [],
            equipment: (data.equipment as unknown as any[]) || [],
            lines: (data.cables as unknown as any[]) || [],
          };
          setHistory([loadedState]);
          setHistoryIndex(0);

          // Restore PDF
          if (data.pdf_data) {
            setPdfBase64(data.pdf_data);
            const binaryString = atob(data.pdf_data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            const doc = await getDocument(bytes.buffer).promise;
            setPdfDoc(doc);
          }
          
          setHasUnsavedChanges(false);
        }
      } catch (error) {
        console.error('Error loading layout:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadLayout();
  }, [projectId]);

  // Save layout to database
  const handleSave = async () => {
    if (readOnly) return;
    setIsSaving(true);
    try {
      const layoutData: any = {
        project_id: projectId,
        name: 'Default Layout',
        scale_pixels_per_meter: scaleInfo.ratio ? 1 / scaleInfo.ratio : null,
        pv_config: pvPanelConfig || DEFAULT_PV_PANEL_CONFIG,
        roof_masks: roofMasks,
        pv_arrays: pvArrays,
        equipment: equipment,
        cables: lines,
        pdf_data: pdfBase64,
      };

      let result;
      if (layoutId) {
        result = await supabase
          .from('pv_layouts')
          .update(layoutData)
          .eq('id', layoutId)
          .select()
          .single();
      } else {
        result = await supabase
          .from('pv_layouts')
          .insert(layoutData)
          .select()
          .single();
      }

      if (result.error) throw result.error;
      
      setLayoutId(result.data.id);
      setHasUnsavedChanges(false);
      toast.success('Layout saved successfully');
    } catch (error: any) {
      console.error('Error saving layout:', error);
      toast.error('Failed to save layout: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (readOnly) return;
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
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if (e.key === 'Escape') {
        setActiveTool(Tool.SELECT);
        setPendingPvArrayConfig(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, history.length, handleSave, readOnly]);

  const handleLoadPdf = async (file: File) => {
    if (readOnly) return;
    try {
      const arrayBuffer = await file.arrayBuffer();
      
      // Convert to base64 for storage
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      setPdfBase64(base64);
      
      const doc = await getDocument(arrayBuffer).promise;
      setPdfDoc(doc);
      setHasUnsavedChanges(true);
      toast.success('PDF loaded successfully');
    } catch (error) {
      toast.error('Failed to load PDF');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)] min-h-[600px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleScaleComplete = (pixelDistance: number) => {
    if (readOnly) return;
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
    if (readOnly) return;
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
      {!readOnly && (
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
          onSave={handleSave}
          canUndo={canUndo}
          canRedo={canRedo}
          isSaving={isSaving}
          hasUnsavedChanges={hasUnsavedChanges}
          placementRotation={placementRotation}
          setPlacementRotation={setPlacementRotation}
          pdfLoaded={!!pdfDoc}
        />
      )}
      
      <Canvas
        pdfDoc={pdfDoc}
        activeTool={readOnly ? Tool.PAN : activeTool}
        viewState={viewState}
        setViewState={setViewState}
        scaleInfo={scaleInfo}
        scaleLine={scaleLine}
        setScaleLine={readOnly ? (() => {}) : setScaleLine}
        onScaleComplete={handleScaleComplete}
        pvPanelConfig={pvPanelConfig}
        roofMasks={roofMasks}
        setRoofMasks={readOnly ? (() => {}) : setRoofMasks}
        pvArrays={pvArrays}
        setPvArrays={readOnly ? (() => {}) : setPvArrays}
        equipment={equipment}
        setEquipment={readOnly ? (() => {}) : setEquipment}
        lines={lines}
        setLines={readOnly ? (() => {}) : setLines}
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

      {!readOnly && (
        <>
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
        </>
      )}
    </div>
  );
}
