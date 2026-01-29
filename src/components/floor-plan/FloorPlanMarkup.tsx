import { useState, useCallback, useEffect, useRef } from 'react';
import { Tool, ViewState, ScaleInfo, PVPanelConfig, DesignState, initialDesignState, Point, RoofMask, PlantSetupConfig, defaultPlantSetupConfig, PVArrayItem, PlacedWalkway, PlacedCableTray } from './types';
import { DEFAULT_PV_PANEL_CONFIG } from './constants';
import { Toolbar } from './components/Toolbar';
import { Canvas } from './components/Canvas';
import { SummaryPanel } from './components/SummaryPanel';
import { ScaleModal } from './components/ScaleModal';
import { PVConfigModal } from './components/PVConfigModal';
import { RoofMaskModal } from './components/RoofMaskModal';
import { PVArrayModal, PVArrayConfig } from './components/PVArrayModal';
import { LoadLayoutModal } from './components/LoadLayoutModal';
import { LayoutManagerModal } from './components/LayoutManagerModal';
import { LayoutBrowser } from './components/LayoutBrowser';
import { PlantSetupModal } from './components/PlantSetupModal';
import { SimulationSelector } from './components/SimulationSelector';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { getModulePresetById, getDefaultModulePreset, SolarModulePreset } from '../projects/SolarModulePresets';

type ViewMode = 'browser' | 'editor';

// Type for simulation data
export type SimulationData = {
  id: string;
  name: string;
  solar_capacity_kwp: number | null;
  battery_capacity_kwh: number | null;
  battery_power_kw: number | null;
  annual_solar_savings: number | null;
  roi_percentage: number | null;
  results_json: any;
} | null;

interface FloorPlanMarkupProps {
  projectId: string;
  readOnly?: boolean;
  latestSimulation?: SimulationData;
}

const AUTO_SAVE_DEBOUNCE_MS = 1500;

export function FloorPlanMarkup({ projectId, readOnly = false, latestSimulation }: FloorPlanMarkupProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('browser');
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [isToolbarCollapsed, setIsToolbarCollapsed] = useState(false);
  const [isSummaryCollapsed, setIsSummaryCollapsed] = useState(false);
  const [activeTool, setActiveTool] = useState<Tool>(Tool.PAN);
  const [viewState, setViewState] = useState<ViewState>({ zoom: 1, offset: { x: 0, y: 0 } });
  const [layoutId, setLayoutId] = useState<string | null>(null);
  const [currentLayoutName, setCurrentLayoutName] = useState<string>('Default Layout');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  
  // Assigned simulation for this layout
  const [assignedSimulationId, setAssignedSimulationId] = useState<string | null>(null);
  const [assignedSimulation, setAssignedSimulation] = useState<SimulationData>(null);
  
  // Refs for auto-save
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isAutoSavingRef = useRef(false);
  const [isLoadLayoutModalOpen, setIsLoadLayoutModalOpen] = useState(false);
  const [isLayoutManagerOpen, setIsLayoutManagerOpen] = useState(false);
  const [projectCoordinates, setProjectCoordinates] = useState<{ latitude: number | null; longitude: number | null }>({
    latitude: null,
    longitude: null,
  });
  
  // History for undo/redo
  const [history, setHistory] = useState<DesignState[]>([initialDesignState]);
  const [historyIndex, setHistoryIndex] = useState(0);
  
  const currentDesign = history[historyIndex];
  const { equipment, lines, roofMasks, pvArrays, placedWalkways, placedCableTrays } = currentDesign;
  
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
  const setPlacedWalkways = (updater: (prev: PlacedWalkway[]) => PlacedWalkway[]) => 
    commitState({ ...currentDesign, placedWalkways: updater(placedWalkways) });
  const setPlacedCableTrays = (updater: (prev: PlacedCableTray[]) => PlacedCableTray[]) => 
    commitState({ ...currentDesign, placedCableTrays: updater(placedCableTrays) });

  const handleUndo = () => !readOnly && historyIndex > 0 && setHistoryIndex(historyIndex - 1);
  const handleRedo = () => !readOnly && historyIndex < history.length - 1 && setHistoryIndex(historyIndex + 1);

  // Scale & Config
  const [scaleInfo, setScaleInfo] = useState<ScaleInfo>({ pixelDistance: null, realDistance: null, ratio: null });
  const [scaleLine, setScaleLine] = useState<{ start: Point; end: Point } | null>(null);
  const [pvPanelConfig, setPvPanelConfig] = useState<PVPanelConfig | null>(null);
  const [moduleName, setModuleName] = useState<string>('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [placementRotation, setPlacementRotation] = useState(0);

  // Modals
  const [isScaleModalOpen, setIsScaleModalOpen] = useState(false);
  const [isPVConfigModalOpen, setIsPVConfigModalOpen] = useState(false);
  const [isRoofMaskModalOpen, setIsRoofMaskModalOpen] = useState(false);
  const [isPVArrayModalOpen, setIsPVArrayModalOpen] = useState(false);
  const [isPlantSetupModalOpen, setIsPlantSetupModalOpen] = useState(false);
  const [plantSetupActiveTab, setPlantSetupActiveTab] = useState('modules');
  const [pendingScalePixels, setPendingScalePixels] = useState(0);
  const [editingRoofMask, setEditingRoofMask] = useState<RoofMask | null>(null);
  const [editingRoofDirectionId, setEditingRoofDirectionId] = useState<string | null>(null);
  const [pendingRoofMask, setPendingRoofMask] = useState<{ points: Point[]; area: number; pitch: number } | null>(null);
  const [pendingPvArrayConfig, setPendingPvArrayConfig] = useState<PVArrayConfig | null>(null);
  const [editingPvArrayId, setEditingPvArrayId] = useState<string | null>(null);
  
  // Remember last used PV array settings for continuous placement
  const [lastPvArraySettings, setLastPvArraySettings] = useState<PVArrayConfig>({
    rows: 2,
    columns: 10,
    orientation: 'portrait',
    minSpacing: 0.5,
  });
  
  // Plant Setup Config
  const [plantSetupConfig, setPlantSetupConfig] = useState<PlantSetupConfig>(defaultPlantSetupConfig);
  
  // Selected items for placement (which type of module/inverter/etc. to use)
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [selectedInverterId, setSelectedInverterId] = useState<string | null>(null);
  const [selectedWalkwayId, setSelectedWalkwayId] = useState<string | null>(null);
  const [selectedCableTrayId, setSelectedCableTrayId] = useState<string | null>(null);

  // Reset to blank layout state
  const resetToBlankLayout = useCallback(() => {
    setLayoutId(null);
    setCurrentLayoutName('New Layout');
    setBackgroundImage(null);
    setScaleInfo({ pixelDistance: null, realDistance: null, ratio: null });
    setHistory([initialDesignState]);
    setHistoryIndex(0);
    setHasUnsavedChanges(false);
    setAssignedSimulationId(null);
    setAssignedSimulation(null);
  }, []);

  // Load a specific layout by ID
  const loadLayout = useCallback(async (layoutIdToLoad: string) => {
    try {
      const { data, error } = await supabase
        .from('pv_layouts')
        .select('*')
        .eq('id', layoutIdToLoad)
        .single();

      if (error) throw error;

      if (data) {
        setLayoutId(data.id);
        setCurrentLayoutName(data.name);
        
        // Load assigned simulation if present
        const simId = (data as any).simulation_id as string | null;
        setAssignedSimulationId(simId);
        
        if (simId) {
          // Fetch the assigned simulation
          const { data: simData, error: simError } = await supabase
            .from('project_simulations')
            .select('id, name, solar_capacity_kwp, battery_capacity_kwh, battery_power_kw, annual_solar_savings, roi_percentage, results_json')
            .eq('id', simId)
            .single();
          
          if (!simError && simData) {
            setAssignedSimulation(simData);
          } else {
            setAssignedSimulation(null);
          }
        } else {
          setAssignedSimulation(null);
        }
        
        // Restore scale
        if (data.scale_pixels_per_meter) {
          setScaleInfo({
            pixelDistance: null,
            realDistance: null,
            ratio: 1 / Number(data.scale_pixels_per_meter)
          });
        } else {
          setScaleInfo({ pixelDistance: null, realDistance: null, ratio: null });
        }

        // Restore design state
        const plantSetup = data.plant_setup as unknown as PlantSetupConfig;
        const loadedState: DesignState = {
          roofMasks: (data.roof_masks as unknown as RoofMask[]) || [],
          pvArrays: (data.pv_arrays as unknown as any[]) || [],
          equipment: (data.equipment as unknown as any[]) || [],
          lines: (data.cables as unknown as any[]) || [],
          placedWalkways: plantSetup?.walkways?.map(w => ({
            id: w.id,
            configId: w.id,
            name: w.name,
            width: w.width,
            length: w.length,
          })) || [],
          placedCableTrays: plantSetup?.cableTrays?.map(c => ({
            id: c.id,
            configId: c.id,
            name: c.name,
            width: c.width,
            length: c.length,
          })) || [],
        };
        setHistory([loadedState]);
        setHistoryIndex(0);

        // Restore background image
        if (data.pdf_data) {
          setBackgroundImage(data.pdf_data);
        } else {
          setBackgroundImage(null);
        }
        
        // Restore plant setup config (walkways, cable trays, etc.)
        if (data.plant_setup) {
          setPlantSetupConfig(data.plant_setup as unknown as PlantSetupConfig);
        }
        
        setHasUnsavedChanges(false);
      }
    } catch (error) {
      console.error('Error loading layout:', error);
      throw error;
    }
  }, []);

  // Create a new layout
  const createLayout = useCallback(async (name: string, copyFromId?: string) => {
    try {
      let layoutData: any = {
        project_id: projectId,
        name,
        scale_pixels_per_meter: null,
        pv_config: DEFAULT_PV_PANEL_CONFIG,
        roof_masks: [],
        pv_arrays: [],
        equipment: [],
        cables: [],
        pdf_data: null,
      };

      if (copyFromId) {
        const { data: source, error: sourceError } = await supabase
          .from('pv_layouts')
          .select('*')
          .eq('id', copyFromId)
          .single();
        
        if (sourceError) throw sourceError;
        
        if (source) {
          layoutData = {
            ...layoutData,
            scale_pixels_per_meter: source.scale_pixels_per_meter,
            pv_config: source.pv_config,
            roof_masks: source.roof_masks,
            pv_arrays: source.pv_arrays,
            equipment: source.equipment,
            cables: source.cables,
            pdf_data: source.pdf_data,
          };
        }
      }

      const { data, error } = await supabase
        .from('pv_layouts')
        .insert(layoutData)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        await loadLayout(data.id);
      }
    } catch (error) {
      console.error('Error creating layout:', error);
      throw error;
    }
  }, [projectId, loadLayout]);

  // Rename a layout
  const renameLayout = useCallback(async (id: string, newName: string) => {
    try {
      const { error } = await supabase
        .from('pv_layouts')
        .update({ name: newName })
        .eq('id', id);

      if (error) throw error;

      if (id === layoutId) {
        setCurrentLayoutName(newName);
      }
    } catch (error) {
      console.error('Error renaming layout:', error);
      throw error;
    }
  }, [layoutId]);

  // Delete a layout
  const deleteLayout = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('pv_layouts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // If deleted the current layout, load another or reset
      if (id === layoutId) {
        const { data: remaining } = await supabase
          .from('pv_layouts')
          .select('id')
          .eq('project_id', projectId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (remaining) {
          await loadLayout(remaining.id);
        } else {
          resetToBlankLayout();
        }
      }
    } catch (error) {
      console.error('Error deleting layout:', error);
      throw error;
    }
  }, [layoutId, projectId, loadLayout, resetToBlankLayout]);

  // Load project coordinates on mount (but NOT layouts - stay in browser mode)
  useEffect(() => {
    const loadProjectData = async () => {
      try {
        // Fetch project coordinates
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('latitude, longitude')
          .eq('id', projectId)
          .single();
        
        if (!projectError && projectData) {
          setProjectCoordinates({
            latitude: projectData.latitude,
            longitude: projectData.longitude,
          });
        }
      } catch (error) {
        console.error('Error loading project data:', error);
      }
    };

    loadProjectData();
  }, [projectId]);

  // Sync PV panel config from latestSimulation prop
  useEffect(() => {
    if (latestSimulation?.results_json) {
      const resultsJson = latestSimulation.results_json as any;
      const inverterConfig = resultsJson.inverterConfig;
      
      if (inverterConfig) {
        let module: SolarModulePreset;
        
        if (inverterConfig.selectedModuleId === "custom" && inverterConfig.customModule) {
          module = inverterConfig.customModule;
          setModuleName(inverterConfig.customModule.name || 'Custom Module');
        } else {
          module = getModulePresetById(inverterConfig.selectedModuleId) || getDefaultModulePreset();
          setModuleName(module.name);
        }
        
        setPvPanelConfig({
          width: module.width_m,
          length: module.length_m,
          wattage: module.power_wp,
        });
        
        // Sync plant setup from simulation
        setPlantSetupConfig(prev => ({
          ...prev,
          solarModules: [{
            id: 'sim-module',
            name: module.name,
            width: module.width_m,
            length: module.length_m,
            wattage: module.power_wp,
            isDefault: true,
          }],
          inverters: inverterConfig.inverterSize ? [{
            id: 'sim-inverter',
            name: `${inverterConfig.inverterSize}kW Inverter`,
            acCapacity: inverterConfig.inverterSize,
            count: inverterConfig.inverterCount || 1,
            isDefault: true,
          }] : prev.inverters,
        }));
      } else {
        // No inverter config, use default
        const defaultModule = getDefaultModulePreset();
        setPvPanelConfig({
          width: defaultModule.width_m,
          length: defaultModule.length_m,
          wattage: defaultModule.power_wp,
        });
        setModuleName(defaultModule.name);
      }
    } else {
      // No simulation, use default
      const defaultModule = getDefaultModulePreset();
      setPvPanelConfig({
        width: defaultModule.width_m,
        length: defaultModule.length_m,
        wattage: defaultModule.power_wp,
      });
      setModuleName(defaultModule.name);
    }
  }, [latestSimulation]);

  // Handler for selecting a layout from the browser
  const handleSelectLayout = useCallback(async (selectedLayoutId: string) => {
    setIsLoading(true);
    try {
      await loadLayout(selectedLayoutId);
      setViewMode('editor');
    } catch (error) {
      toast.error('Failed to load layout');
    } finally {
      setIsLoading(false);
    }
  }, [loadLayout]);

  // Handler for creating a new design
  const handleNewDesign = useCallback(() => {
    resetToBlankLayout();
    setViewMode('editor');
  }, [resetToBlankLayout]);

  // Handler for loading a PDF from the browser (opens modal then switches to editor)
  const handleLoadPDFFromBrowser = useCallback(() => {
    resetToBlankLayout();
    setViewMode('editor');
    // Small delay to ensure state is updated before opening modal
    setTimeout(() => setIsLoadLayoutModalOpen(true), 100);
  }, [resetToBlankLayout]);

  // Handler for duplicating a layout
  const handleDuplicateLayout = useCallback(async (id: string, name: string) => {
    await createLayout(name, id);
  }, [createLayout]);

  // Save layout to database (internal, silent option for auto-save)
  const saveLayout = useCallback(async (silent: boolean = false) => {
    if (readOnly) return;
    
    // Prevent concurrent saves
    if (isAutoSavingRef.current && !silent) return;
    
    if (!silent) setIsSaving(true);
    isAutoSavingRef.current = true;
    
    try {
      const layoutData: any = {
        project_id: projectId,
        name: currentLayoutName,
        scale_pixels_per_meter: scaleInfo.ratio ? 1 / scaleInfo.ratio : null,
        pv_config: pvPanelConfig || DEFAULT_PV_PANEL_CONFIG,
        roof_masks: roofMasks,
        pv_arrays: pvArrays,
        equipment: equipment,
        cables: lines,
        pdf_data: backgroundImage,
        plant_setup: plantSetupConfig,
        simulation_id: assignedSimulationId,
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
      setCurrentLayoutName(result.data.name);
      setHasUnsavedChanges(false);
      setLastSavedAt(new Date());
      
      if (!silent) {
        toast.success('Layout saved successfully');
      }
    } catch (error: any) {
      console.error('Error saving layout:', error);
      if (!silent) {
        toast.error('Failed to save layout: ' + error.message);
      }
    } finally {
      if (!silent) setIsSaving(false);
      isAutoSavingRef.current = false;
    }
  }, [readOnly, projectId, currentLayoutName, scaleInfo.ratio, pvPanelConfig, roofMasks, pvArrays, equipment, lines, backgroundImage, layoutId, plantSetupConfig, placedWalkways, placedCableTrays, assignedSimulationId]);

  // Manual save handler
  const handleSave = async () => {
    await saveLayout(false);
  };

  // Auto-save effect: triggers when design state changes
  useEffect(() => {
    if (readOnly || !hasUnsavedChanges) return;
    
    // Clear any pending auto-save
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    // Schedule auto-save
    autoSaveTimeoutRef.current = setTimeout(() => {
      saveLayout(true);
    }, AUTO_SAVE_DEBOUNCE_MS);
    
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [hasUnsavedChanges, roofMasks, pvArrays, equipment, lines, backgroundImage, scaleInfo, plantSetupConfig, placedWalkways, placedCableTrays, readOnly, saveLayout, assignedSimulationId]);

  // Handle simulation assignment change
  const handleSimulationChange = useCallback((simulationId: string | null, simulation: any) => {
    setAssignedSimulationId(simulationId);
    // Map to full SimulationData type (some fields may be null)
    if (simulation) {
      setAssignedSimulation({
        id: simulation.id,
        name: simulation.name,
        solar_capacity_kwp: simulation.solar_capacity_kwp,
        battery_capacity_kwh: null,
        battery_power_kw: null,
        annual_solar_savings: null,
        roi_percentage: null,
        results_json: simulation.results_json,
      });
    } else {
      setAssignedSimulation(null);
    }
    setHasUnsavedChanges(true);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  // Track R key held state for scroll-wheel rotation
  const [isRKeyHeld, setIsRKeyHeld] = useState(false);
  const isRKeyHeldRef = useRef(false);

  // Delete an item by ID (PV array, roof mask, equipment, or line)
  const handleDeleteItem = useCallback((id: string) => {
    // Try deleting PV array
    if (pvArrays.some(arr => arr.id === id)) {
      setPvArrays(prev => prev.filter(arr => arr.id !== id));
      if (selectedItemId === id) setSelectedItemId(null);
      toast.success('PV array deleted');
      return;
    }
    
    // Try deleting roof mask
    if (roofMasks.some(mask => mask.id === id)) {
      setRoofMasks(prev => prev.filter(mask => mask.id !== id));
      if (selectedItemId === id) setSelectedItemId(null);
      toast.success('Roof mask deleted');
      return;
    }
    
    // Try deleting equipment
    if (equipment.some(eq => eq.id === id)) {
      setEquipment(prev => prev.filter(eq => eq.id !== id));
      if (selectedItemId === id) setSelectedItemId(null);
      toast.success('Equipment deleted');
      return;
    }
    
    // Try deleting line
    if (lines.some(line => line.id === id)) {
      setLines(prev => prev.filter(line => line.id !== id));
      if (selectedItemId === id) setSelectedItemId(null);
      toast.success('Cable deleted');
      return;
    }
  }, [selectedItemId, pvArrays, roofMasks, equipment, lines, setPvArrays, setRoofMasks, setEquipment, setLines]);

  // Delete selected item (wrapper for keyboard shortcut)
  const handleDeleteSelectedItem = useCallback(() => {
    if (selectedItemId) {
      handleDeleteItem(selectedItemId);
    }
  }, [selectedItemId, handleDeleteItem]);

  // Delete placed walkway or cable tray instances (not templates)
  const handleDeletePlacedItem = useCallback((type: 'walkway' | 'cableTray', id: string) => {
    if (type === 'walkway') {
      setPlacedWalkways(prev => prev.filter(w => w.id !== id));
      toast.success('Walkway deleted');
    } else if (type === 'cableTray') {
      setPlacedCableTrays(prev => prev.filter(c => c.id !== id));
      toast.success('Cable tray deleted');
    }
  }, [setPlacedWalkways, setPlacedCableTrays]);

  // Keyboard shortcuts
  useEffect(() => {
    if (readOnly) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      // Track R key hold state for scroll rotation
      if (e.key === 'r' || e.key === 'R') {
        setIsRKeyHeld(true);
        isRKeyHeldRef.current = true;
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
        // Exit PV array placement mode
        if (pendingPvArrayConfig) {
          setPendingPvArrayConfig(null);
          setPlacementRotation(0);
          setActiveTool(Tool.SELECT);
          toast.info('PV array placement cancelled');
          return;
        }
        // Exit roof mask drawing mode
        if (activeTool === Tool.ROOF_MASK) {
          setActiveTool(Tool.SELECT);
          toast.info('Roof mask drawing cancelled');
          return;
        }
        // Cancel pending roof direction drawing
        if (pendingRoofMask) {
          setPendingRoofMask(null);
          toast.info('Roof mask cancelled');
          return;
        }
        // Cancel direction editing mode
        if (editingRoofDirectionId) {
          setEditingRoofDirectionId(null);
          setActiveTool(Tool.SELECT);
          toast.info('Roof direction edit cancelled');
          return;
        }
        // Default: clear selection and editing state
        setActiveTool(Tool.SELECT);
        setEditingPvArrayId(null);
      }
      
      // Delete selected item with Delete or Backspace
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedItemId) {
        e.preventDefault();
        handleDeleteSelectedItem();
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        setIsRKeyHeld(false);
        isRKeyHeldRef.current = false;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [historyIndex, history.length, handleSave, readOnly, pendingRoofMask, editingRoofDirectionId, pendingPvArrayConfig, activeTool, selectedItemId]);

  // Scroll wheel rotation when R is held
  // - R + scroll = 5° increments
  // - R + Shift + scroll = 1° increments
  // - While R is held, prevent canvas zoom
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!isRKeyHeldRef.current) return;
      if (readOnly) return;
      
      // Always prevent default when R is held (no canvas zoom)
      e.preventDefault();
      e.stopPropagation();
      
      // Shift = fine control (1°), otherwise 5°
      const increment = e.shiftKey ? 1 : 5;
      
      // Browsers convert Shift+scroll from deltaY to deltaX, so check both
      const scrollDelta = e.shiftKey ? e.deltaX : e.deltaY;
      const delta = scrollDelta > 0 ? increment : -increment;
      
      // Only rotate if there's actual scroll movement
      if (scrollDelta === 0) return;
      
      // Check if placing a new PV array (ghost preview mode)
      if (activeTool === Tool.PV_ARRAY && pendingPvArrayConfig) {
        setPlacementRotation(prev => ((prev + delta) % 360 + 360) % 360);
        return;
      }
      
      // Check if a PV array is selected for rotation
      if (selectedItemId && pvArrays.some(arr => arr.id === selectedItemId)) {
        setPvArrays(prev => prev.map(arr => 
          arr.id === selectedItemId 
            ? { ...arr, rotation: ((arr.rotation + delta) % 360 + 360) % 360 }
            : arr
        ));
      }
    };
    
    // Use capture phase to intercept before Canvas wheel handler
    window.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    return () => window.removeEventListener('wheel', handleWheel, { capture: true });
  }, [readOnly, selectedItemId, pvArrays, setPvArrays, activeTool, pendingPvArrayConfig]);

  const handleImageLoad = (imageBase64: string) => {
    if (readOnly) return;
    setBackgroundImage(imageBase64);
    setHasUnsavedChanges(true);
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
    setPendingRoofMask({ points, area, pitch: 15 }); // Default pitch, will be set in modal
    setIsRoofMaskModalOpen(true);
  };

  const handleRoofMaskConfirm = (pitch: number) => {
    if (editingRoofMask) {
      // When editing, we're only updating the pitch (direction is already set)
      setRoofMasks(prev => prev.map(mask => 
        mask.id === editingRoofMask.id 
          ? { ...mask, pitch }
          : mask
      ));
      setEditingRoofMask(null);
      setIsRoofMaskModalOpen(false);
      toast.success('Roof pitch updated');
      return;
    }
    
    if (!pendingRoofMask) return;
    
    // Store the pitch with the pending roof mask and switch to direction drawing mode
    setPendingRoofMask({ ...pendingRoofMask, pitch });
    setIsRoofMaskModalOpen(false);
    setActiveTool(Tool.ROOF_DIRECTION);
    toast.info('Draw a line from high to low point to set slope direction');
  };

  // Handle direction line completion for roof mask
  const handleRoofDirectionComplete = (direction: number) => {
    // Editing existing roof direction
    if (editingRoofDirectionId) {
      setRoofMasks(prev => prev.map(mask =>
        mask.id === editingRoofDirectionId
          ? { ...mask, direction }
          : mask
      ));
      setEditingRoofDirectionId(null);
      setActiveTool(Tool.SELECT);
      toast.success('Roof direction updated');
      return;
    }

    if (!pendingRoofMask) return;
    
    const newMask: RoofMask = {
      id: `roof-${Date.now()}`,
      points: pendingRoofMask.points,
      pitch: pendingRoofMask.pitch,
      direction,
      area: pendingRoofMask.area,
    };
    setRoofMasks(prev => [...prev, newMask]);
    setPendingRoofMask(null);
    // Stay in ROOF_MASK mode for continuous placement - user presses ESC to exit
    setActiveTool(Tool.ROOF_MASK);
    toast.success('Roof mask added - draw another or press ESC to finish');
  };

  // Handle editing a roof mask (double-click or from summary panel)
  const handleEditRoofMask = (roofMaskId: string) => {
    const mask = roofMasks.find(m => m.id === roofMaskId);
    if (mask) {
      setEditingRoofMask(mask);
      setIsRoofMaskModalOpen(true);
    }
  };

  const handleEditRoofDirection = () => {
    if (!editingRoofMask) return;
    setEditingRoofDirectionId(editingRoofMask.id);
    setEditingRoofMask(null);
    setIsRoofMaskModalOpen(false);
    setActiveTool(Tool.ROOF_DIRECTION);
    toast.info('Draw a line from high to low point to update slope direction');
  };

  const handlePVArrayConfirm = (config: PVArrayConfig) => {
    // If editing an existing array, update it
    if (editingPvArrayId) {
      setPvArrays(prev => prev.map(arr => 
        arr.id === editingPvArrayId 
          ? { ...arr, rows: config.rows, columns: config.columns, orientation: config.orientation, minSpacing: config.minSpacing }
          : arr
      ));
      setEditingPvArrayId(null);
      setIsPVArrayModalOpen(false);
      toast.success('PV array updated');
      return;
    }
    
    // Creating new array - set pending config and switch to placement mode
    setPendingPvArrayConfig(config);
    setLastPvArraySettings(config); // Remember settings for next placement
    setIsPVArrayModalOpen(false);
    setActiveTool(Tool.PV_ARRAY);
    toast.info('Click on a roof mask to place the array');
  };

  // Handle double-click on PV array to edit
  const handlePVArrayDoubleClick = (arrayId: string) => {
    const arr = pvArrays.find(a => a.id === arrayId);
    if (arr) {
      setEditingPvArrayId(arrayId);
      setIsPVArrayModalOpen(true);
    }
  };

  // Handle copying a PV array - enter placement mode with the same config
  const handleCopyPvArray = (array: PVArrayItem) => {
    const copyConfig: PVArrayConfig = {
      rows: array.rows,
      columns: array.columns,
      orientation: array.orientation,
      minSpacing: array.minSpacing ?? lastPvArraySettings?.minSpacing ?? 0.5,
    };
    setPendingPvArrayConfig(copyConfig);
    setLastPvArraySettings(copyConfig);
    setActiveTool(Tool.PV_ARRAY);
    toast.info(`Click on a roof mask to place the copied array (spacing: ${copyConfig.minSpacing}m)`);
  };

  // Handle copying a roof mask - store config and enter drawing mode
  const handleCopyRoofMask = (mask: RoofMask) => {
    // Store the pitch for the next mask, then switch to drawing mode
    setPendingRoofMask({ points: [], area: 0, pitch: mask.pitch });
    setActiveTool(Tool.ROOF_MASK);
    toast.info(`Draw a new roof mask (pitch: ${mask.pitch}°)`);
  };

  // Show browser view first (unless in readOnly mode)
  if (viewMode === 'browser' && !readOnly) {
    return (
      <LayoutBrowser
        projectId={projectId}
        onSelectLayout={handleSelectLayout}
        onNewDesign={handleNewDesign}
        onLoadPDF={handleLoadPDFFromBrowser}
        onRenameLayout={renameLayout}
        onDeleteLayout={deleteLayout}
        onDuplicateLayout={handleDuplicateLayout}
      />
    );
  }

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
          plantSetupConfig={plantSetupConfig}
          onOpenLoadLayout={() => setIsLoadLayoutModalOpen(true)}
          onOpenPlantSetup={(tab) => {
            if (tab) setPlantSetupActiveTab(tab);
            setIsPlantSetupModalOpen(true);
          }}
          onOpenLayoutManager={() => setIsLayoutManagerOpen(true)}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onSave={handleSave}
          canUndo={canUndo}
          canRedo={canRedo}
          isSaving={isSaving}
          hasUnsavedChanges={hasUnsavedChanges}
          lastSavedAt={lastSavedAt}
          placementRotation={placementRotation}
          setPlacementRotation={setPlacementRotation}
          layoutLoaded={!!backgroundImage}
          currentLayoutName={currentLayoutName}
          onBackToBrowser={() => setViewMode('browser')}
          isCollapsed={isToolbarCollapsed}
          onToggleCollapse={() => setIsToolbarCollapsed(!isToolbarCollapsed)}
        />
      )}
      
      <Canvas
        backgroundImage={backgroundImage}
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
        onRoofDirectionComplete={handleRoofDirectionComplete}
        onArrayPlaced={() => {
          // Reset placement rotation for next array but keep config for continuous placement
          setPlacementRotation(0);
          // Config stays active - user presses ESC to exit placement mode
        }}
        pendingRoofMaskPoints={
          editingRoofDirectionId
            ? roofMasks.find(m => m.id === editingRoofDirectionId)?.points
            : pendingRoofMask?.points
        }
        onPVArrayDoubleClick={readOnly ? undefined : handlePVArrayDoubleClick}
        onCopyPvArray={readOnly ? undefined : handleCopyPvArray}
        onCopyRoofMask={readOnly ? undefined : handleCopyRoofMask}
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
        onEditRoofMask={readOnly ? undefined : handleEditRoofMask}
        onDeleteItem={readOnly ? undefined : handleDeleteItem}
        onDeletePlacedItem={readOnly ? undefined : handleDeletePlacedItem}
        isCollapsed={isSummaryCollapsed}
        onToggleCollapse={() => setIsSummaryCollapsed(!isSummaryCollapsed)}
        plantSetupConfig={plantSetupConfig}
        placedWalkways={placedWalkways}
        placedCableTrays={placedCableTrays}
        assignedSimulation={assignedSimulation}
        simulationSelector={
          <SimulationSelector
            projectId={projectId}
            layoutId={layoutId}
            currentSimulationId={assignedSimulationId}
            onSimulationChange={handleSimulationChange}
            readOnly={readOnly}
          />
        }
      />

      {!readOnly && (
        <>
          <LoadLayoutModal
            isOpen={isLoadLayoutModalOpen}
            onClose={() => setIsLoadLayoutModalOpen(false)}
            onImageLoad={handleImageLoad}
            projectCoordinates={projectCoordinates}
          />
          
          <LayoutManagerModal
            isOpen={isLayoutManagerOpen}
            onClose={() => setIsLayoutManagerOpen(false)}
            projectId={projectId}
            currentLayoutId={layoutId}
            hasUnsavedChanges={hasUnsavedChanges}
            onLoadLayout={loadLayout}
            onCreateLayout={createLayout}
            onRenameLayout={renameLayout}
            onDeleteLayout={deleteLayout}
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
            moduleName={moduleName}
          />

          <RoofMaskModal
            isOpen={isRoofMaskModalOpen}
            onClose={() => { 
              setIsRoofMaskModalOpen(false); 
              setPendingRoofMask(null); 
              setEditingRoofMask(null);
              setEditingRoofDirectionId(null);
            }}
            area={editingRoofMask?.area || pendingRoofMask?.area || 0}
            onConfirm={handleRoofMaskConfirm}
            onEditDirection={handleEditRoofDirection}
            initialPitch={editingRoofMask?.pitch}
            isEditing={!!editingRoofMask}
          />

          {pvPanelConfig && (
            <PVArrayModal
              isOpen={isPVArrayModalOpen}
              onClose={() => { 
                setIsPVArrayModalOpen(false); 
                setEditingPvArrayId(null);
              }}
              pvPanelConfig={pvPanelConfig}
              onConfirm={handlePVArrayConfirm}
              initialConfig={editingPvArrayId 
                ? pvArrays.find(arr => arr.id === editingPvArrayId)
                : lastPvArraySettings
              }
              isEditing={!!editingPvArrayId}
            />
          )}
          
          <PlantSetupModal
            isOpen={isPlantSetupModalOpen}
            onClose={() => setIsPlantSetupModalOpen(false)}
            config={plantSetupConfig}
            initialTab={plantSetupActiveTab}
            onApply={(config) => {
              setPlantSetupConfig(config);
              setHasUnsavedChanges(true);
              // Update pvPanelConfig from default module if available
              const defaultModule = config.solarModules.find(m => m.isDefault);
              if (defaultModule) {
                setPvPanelConfig({
                  width: defaultModule.width,
                  length: defaultModule.length,
                  wattage: defaultModule.wattage,
                });
                setModuleName(defaultModule.name);
              }
            }}
            onSyncFromSimulation={() => {
              // Use latestSimulation prop passed from parent (no database fetch needed)
              if (!latestSimulation?.results_json) {
                toast.error('No simulation data available. Please configure and save a simulation first.');
                return;
              }
              
              const resultsJson = latestSimulation.results_json as any;
              const inverterConfig = resultsJson.inverterConfig;
              
              if (inverterConfig) {
                let module: SolarModulePreset;
                if (inverterConfig.selectedModuleId === "custom" && inverterConfig.customModule) {
                  module = inverterConfig.customModule;
                } else {
                  module = getModulePresetById(inverterConfig.selectedModuleId) || getDefaultModulePreset();
                }
                
                setPlantSetupConfig(prev => ({
                  ...prev,
                  solarModules: [{
                    id: 'sim-module',
                    name: module.name,
                    width: module.width_m,
                    length: module.length_m,
                    wattage: module.power_wp,
                    isDefault: true,
                  }],
                  inverters: inverterConfig.inverterSize ? [{
                    id: 'sim-inverter',
                    name: `${inverterConfig.inverterSize}kW Inverter`,
                    acCapacity: inverterConfig.inverterSize,
                    count: inverterConfig.inverterCount || 1,
                    isDefault: true,
                  }] : prev.inverters,
                }));
                toast.success('Synced from Simulation');
              } else {
                toast.error('No inverter configuration found in simulation');
              }
            }}
          />
        </>
      )}
    </div>
  );
}
