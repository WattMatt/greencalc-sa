import { useState } from 'react';
import { 
  MousePointer, Hand, Ruler, Sun, Layers, RotateCw, 
  Upload, Undo2, Redo2, Save, Loader2, ArrowLeft,
  ChevronLeft, ChevronRight, ChevronDown, Copy, MoveHorizontal, AlignVerticalJustifyStart,
  Settings
} from 'lucide-react';
import { Tool, ScaleInfo, PVPanelConfig, PlantSetupConfig, WalkwayConfig, CableTrayConfig, SolarModuleConfig, InverterLayoutConfig, DCCableConfig, ACCableConfig } from '../types';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { calculateTotalPVCapacity } from '../utils/geometry';
import { PVArrayItem } from '../types';

interface ToolButtonProps {
  icon: React.ElementType;
  label: string;
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
  badge?: string;
}

const ToolButton = ({ icon: Icon, label, isActive, onClick, disabled, badge }: ToolButtonProps) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={isActive ? 'default' : 'ghost'}
          size="sm"
          onClick={onClick}
          disabled={disabled}
          className={cn(
            'relative justify-start w-full',
            isActive && 'bg-primary text-primary-foreground'
          )}
        >
          <Icon className="h-4 w-4 mr-2" />
          <span className="text-xs">{label}</span>
          {badge && (
            <span className="absolute right-2 text-xs bg-muted text-muted-foreground px-1 rounded">
              {badge}
            </span>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
}

const CollapsibleSection = ({ title, children, isOpen, onToggle }: CollapsibleSectionProps) => (
  <Collapsible open={isOpen} onOpenChange={onToggle}>
    <CollapsibleTrigger asChild>
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-between px-2 py-1"
      >
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
        <ChevronDown className={cn("h-3 w-3 transition-transform", isOpen && "rotate-180")} />
      </Button>
    </CollapsibleTrigger>
    <CollapsibleContent className="space-y-1 pt-1">
      {children}
    </CollapsibleContent>
  </Collapsible>
);

// Generic config selector popover for equipment and materials
interface ConfigItem {
  id: string;
  name: string;
  subtitle?: string;
}

function ConfigSelectorPopover({
  items,
  selectedId,
  onSelect,
  label,
}: {
  items: ConfigItem[];
  selectedId: string | null | undefined;
  onSelect: (id: string) => void;
  label: string;
}) {
  const effectiveSelectedId = selectedId || items[0]?.id;
  
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
          <Settings className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="start">
        <div className="space-y-2">
          <p className="text-sm font-medium">{label}</p>
          <RadioGroup value={effectiveSelectedId} onValueChange={onSelect}>
            {items.map((item) => (
              <div key={item.id} className="flex items-center space-x-2">
                <RadioGroupItem value={item.id} id={`config-${item.id}`} />
                <Label htmlFor={`config-${item.id}`} className="flex-1 cursor-pointer text-sm">
                  <span>{item.name}</span>
                  {item.subtitle && (
                    <span className="text-muted-foreground ml-2 text-xs">
                      {item.subtitle}
                    </span>
                  )}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Helper to convert configs to generic items
function toConfigItems(items: (WalkwayConfig | CableTrayConfig | SolarModuleConfig | InverterLayoutConfig | DCCableConfig | ACCableConfig)[]): ConfigItem[] {
  return items.map(item => {
    if ('wattage' in item) {
      // SolarModuleConfig
      return { id: item.id, name: item.name, subtitle: `${item.wattage}W` };
    } else if ('acCapacity' in item) {
      // InverterLayoutConfig
      return { id: item.id, name: item.name, subtitle: `${item.acCapacity}kW` };
    } else if ('diameter' in item) {
      // DCCableConfig or ACCableConfig
      return { id: item.id, name: item.name, subtitle: `${item.diameter}mm² ${item.material}` };
    } else {
      // WalkwayConfig or CableTrayConfig
      return { id: item.id, name: item.name, subtitle: `${item.width.toFixed(3)}m` };
    }
  });
}

// Helper to format relative time
const formatRelativeTime = (date: Date | null): string => {
  if (!date) return '';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

interface ToolbarProps {
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;
  scaleInfo: ScaleInfo;
  pvPanelConfig: PVPanelConfig | null;
  pvArrays: PVArrayItem[];
  plantSetupConfig: PlantSetupConfig;
  onOpenLoadLayout: () => void;
  onOpenPlantSetup: (tab?: string) => void;
  onOpenLayoutManager: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  lastSavedAt: Date | null;
  placementRotation: number;
  setPlacementRotation: (rotation: number) => void;
  layoutLoaded: boolean;
  currentLayoutName: string;
  onBackToBrowser?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  // Placement configuration
  placementOrientation?: 'portrait' | 'landscape';
  setPlacementOrientation?: (orientation: 'portrait' | 'landscape') => void;
  placementMinSpacing?: number;
  setPlacementMinSpacing?: (spacing: number) => void;
  // Copy handler
  onCopySelected?: () => void;
  // Selected item for copy button state
  selectedItemId?: string | null;
  selectionCount?: number;
  // Dimension tool state
  dimensionObject1Id?: string | null;
  dimensionObject2Id?: string | null;
  // Align edges tool state
  alignObject1Id?: string | null;
  alignObject2Id?: string | null;
  // Material selection
  selectedWalkwayId?: string | null;
  setSelectedWalkwayId?: (id: string | null) => void;
  selectedCableTrayId?: string | null;
  setSelectedCableTrayId?: (id: string | null) => void;
  // Equipment selection
  selectedModuleId?: string | null;
  setSelectedModuleId?: (id: string | null) => void;
  selectedInverterId?: string | null;
  setSelectedInverterId?: (id: string | null) => void;
  // Cable selection
  selectedDcCableId?: string | null;
  setSelectedDcCableId?: (id: string | null) => void;
  selectedAcCableId?: string | null;
  setSelectedAcCableId?: (id: string | null) => void;
}

export function Toolbar({
  activeTool,
  setActiveTool,
  scaleInfo,
  pvPanelConfig,
  pvArrays,
  plantSetupConfig,
  onOpenLoadLayout,
  onOpenPlantSetup,
  onOpenLayoutManager,
  onUndo,
  onRedo,
  onSave,
  canUndo,
  canRedo,
  isSaving,
  hasUnsavedChanges,
  lastSavedAt,
  placementRotation,
  setPlacementRotation,
  layoutLoaded,
  currentLayoutName,
  onBackToBrowser,
  isCollapsed,
  onToggleCollapse,
  placementOrientation,
  setPlacementOrientation,
  placementMinSpacing,
  setPlacementMinSpacing,
  onCopySelected,
  selectedItemId,
  selectionCount = 0,
  dimensionObject1Id,
  dimensionObject2Id,
  alignObject1Id,
  alignObject2Id,
  selectedWalkwayId,
  setSelectedWalkwayId,
  selectedCableTrayId,
  setSelectedCableTrayId,
  selectedModuleId,
  setSelectedModuleId,
  selectedInverterId,
  setSelectedInverterId,
  selectedDcCableId,
  setSelectedDcCableId,
  selectedAcCableId,
  setSelectedAcCableId,
}: ToolbarProps) {
  const scaleSet = scaleInfo.ratio !== null;
  const pvConfigured = pvPanelConfig !== null;
  
  const { panelCount, capacityKwp } = pvConfigured 
    ? calculateTotalPVCapacity(pvArrays, pvPanelConfig!)
    : { panelCount: 0, capacityKwp: 0 };

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    file: true,
    general: false,
    plantSetup: false,
    roofMasks: false,
    equipment: false,
    materials: false,
    tools: false,
  });

  const toggleSection = (section: string) => {
    setOpenSections(prev => {
      const isCurrentlyOpen = prev[section];
      // Close all sections, then open only the clicked one (if it was closed)
      const allClosed = Object.keys(prev).reduce((acc, key) => {
        acc[key] = false;
        return acc;
      }, {} as Record<string, boolean>);
      return { ...allClosed, [section]: !isCurrentlyOpen };
    });
  };

  const rotateNext = () => {
    setPlacementRotation((placementRotation + 45) % 360);
  };

  // Collapsed state - thin strip with expand button
  if (isCollapsed) {
    return (
      <div className="w-10 bg-card border-r flex flex-col items-center py-3 gap-2">
        <Button variant="ghost" size="icon" onClick={onToggleCollapse} title="Expand toolbar">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Separator className="my-1 w-6" />
        <Button variant="ghost" size="icon" onClick={onUndo} disabled={!canUndo} title="Undo">
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onRedo} disabled={!canRedo} title="Redo">
          <Redo2 className="h-4 w-4" />
        </Button>
        <div className="flex-1" />
        <Button
          variant={hasUnsavedChanges ? 'default' : 'ghost'}
          size="icon"
          onClick={onSave}
          disabled={isSaving}
          title="Save"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        </Button>
      </div>
    );
  }

  return (
    <div className="w-52 bg-card border-r flex flex-col h-full">
      <div className="p-3 border-b">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-sm">PV Layout Tool</h2>
            <p className="text-xs text-muted-foreground mt-1 truncate" title={currentLayoutName}>
              {currentLayoutName}
            </p>
            {/* Auto-save status */}
            <p className="text-[10px] text-muted-foreground">
              {isSaving ? (
                <span className="text-primary">Saving...</span>
              ) : hasUnsavedChanges ? (
                <span className="text-amber-500">Unsaved changes</span>
              ) : lastSavedAt ? (
                <span className="text-green-600">Saved {formatRelativeTime(lastSavedAt)}</span>
              ) : null}
            </p>
            {pvConfigured && panelCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {panelCount} panels • {capacityKwp.toFixed(1)} kWp
              </p>
            )}
          </div>
          {onToggleCollapse && (
            <Button variant="ghost" size="icon" className="h-6 w-6 -mr-1" onClick={onToggleCollapse} title="Collapse toolbar">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {/* File Section */}
        <CollapsibleSection 
          title="File"
          isOpen={openSections.file}
          onToggle={() => toggleSection('file')}
        >
          {onBackToBrowser && (
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full justify-start"
              onClick={onBackToBrowser}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              <span className="text-xs">Back</span>
            </Button>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full justify-start"
            onClick={onOpenLoadLayout}
          >
            <Upload className="h-4 w-4 mr-2" />
            <span className="text-xs">Load</span>
          </Button>
          <Button
            variant={hasUnsavedChanges ? 'default' : 'outline'}
            size="sm"
            className="w-full justify-start"
            onClick={onSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            <span className="text-xs">{isSaving ? 'Saving...' : 'Save'}</span>
          </Button>
        </CollapsibleSection>

        <Separator className="my-2" />

        {/* General Tools */}
        <CollapsibleSection 
          title="General"
          isOpen={openSections.general}
          onToggle={() => toggleSection('general')}
        >
          <ToolButton
            icon={MousePointer}
            label="Select"
            isActive={activeTool === Tool.SELECT}
            onClick={() => setActiveTool(Tool.SELECT)}
          />
          <ToolButton
            icon={Hand}
            label="Pan"
            isActive={activeTool === Tool.PAN}
            onClick={() => setActiveTool(Tool.PAN)}
          />
          <ToolButton
            icon={Ruler}
            label="Set Scale"
            isActive={activeTool === Tool.SCALE}
            onClick={() => setActiveTool(Tool.SCALE)}
            disabled={!layoutLoaded}
            badge={scaleSet ? '✓' : undefined}
          />
        </CollapsibleSection>

        <Separator className="my-2" />

        {/* Plant Setup */}
        <CollapsibleSection 
          title="Plant Setup"
          isOpen={openSections.plantSetup}
          onToggle={() => toggleSection('plantSetup')}
        >
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between h-8"
            onClick={() => onOpenPlantSetup('modules')}
          >
            <span className="text-xs">Solar Module</span>
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
              {plantSetupConfig.solarModules.length}
            </Badge>
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between h-8"
            onClick={() => onOpenPlantSetup('inverters')}
          >
            <span className="text-xs">Inverter</span>
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
              {plantSetupConfig.inverters.length}
            </Badge>
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between h-8"
            onClick={() => onOpenPlantSetup('walkways')}
          >
            <span className="text-xs">Walkway</span>
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
              {plantSetupConfig.walkways.length}
            </Badge>
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between h-8"
            onClick={() => onOpenPlantSetup('cableTrays')}
          >
            <span className="text-xs">Cable Tray</span>
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
              {plantSetupConfig.cableTrays.length}
            </Badge>
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between h-8"
            onClick={() => onOpenPlantSetup('dcCables')}
          >
            <span className="text-xs">DC Cable</span>
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
              {plantSetupConfig.dcCables?.length || 0}
            </Badge>
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between h-8"
            onClick={() => onOpenPlantSetup('acCables')}
          >
            <span className="text-xs">AC Cable</span>
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
              {plantSetupConfig.acCables?.length || 0}
            </Badge>
          </Button>
        </CollapsibleSection>

        <Separator className="my-2" />

        {/* Roof Masks */}
        <CollapsibleSection 
          title="Roof Masks"
          isOpen={openSections.roofMasks}
          onToggle={() => toggleSection('roofMasks')}
        >
          <ToolButton
            icon={Layers}
            label="Roof Mask"
            isActive={activeTool === Tool.ROOF_MASK}
            onClick={() => setActiveTool(Tool.ROOF_MASK)}
            disabled={!scaleSet}
          />
        </CollapsibleSection>

        <Separator className="my-2" />

        {/* Equipment */}
        <CollapsibleSection 
          title="Equipment"
          isOpen={openSections.equipment}
          onToggle={() => toggleSection('equipment')}
        >
          {/* Solar Module with selector */}
          <div className="flex items-center gap-1">
            <ToolButton
              icon={Sun}
              label="Solar Module"
              isActive={activeTool === Tool.PV_ARRAY}
              onClick={() => setActiveTool(Tool.PV_ARRAY)}
              disabled={!scaleSet || !pvConfigured}
            />
            {plantSetupConfig.solarModules.length > 1 && setSelectedModuleId && (
              <ConfigSelectorPopover
                items={toConfigItems(plantSetupConfig.solarModules)}
                selectedId={selectedModuleId}
                onSelect={setSelectedModuleId}
                label="Select Solar Module"
              />
            )}
          </div>
          {/* Show currently selected module */}
          {plantSetupConfig.solarModules.length > 0 && (
            <p className="text-[10px] text-muted-foreground pl-6 -mt-1 truncate">
              {(plantSetupConfig.solarModules.find(m => m.id === selectedModuleId) || plantSetupConfig.solarModules.find(m => m.isDefault) || plantSetupConfig.solarModules[0])?.name}
            </p>
          )}
          
          {/* Inverter with selector */}
          <div className="flex items-center gap-1">
            <ToolButton
              icon={() => <span className="text-xs font-mono">~=</span>}
              label="Inverter"
              isActive={activeTool === Tool.PLACE_INVERTER}
              onClick={() => setActiveTool(Tool.PLACE_INVERTER)}
              disabled={!scaleSet || plantSetupConfig.inverters.length === 0}
            />
            {plantSetupConfig.inverters.length > 1 && setSelectedInverterId && (
              <ConfigSelectorPopover
                items={toConfigItems(plantSetupConfig.inverters)}
                selectedId={selectedInverterId}
                onSelect={setSelectedInverterId}
                label="Select Inverter"
              />
            )}
          </div>
          {/* Show currently selected inverter */}
          {plantSetupConfig.inverters.length > 0 && (
            <p className="text-[10px] text-muted-foreground pl-6 -mt-1 truncate">
              {(plantSetupConfig.inverters.find(i => i.id === selectedInverterId) || plantSetupConfig.inverters.find(i => i.isDefault) || plantSetupConfig.inverters[0])?.name}
            </p>
          )}
          
          <ToolButton
            icon={() => <span className="text-xs font-mono">▮</span>}
            label="Main Board"
            isActive={activeTool === Tool.PLACE_MAIN_BOARD}
            onClick={() => setActiveTool(Tool.PLACE_MAIN_BOARD)}
            disabled={!scaleSet}
          />
        </CollapsibleSection>

        <Separator className="my-2" />

        {/* Materials */}
        <CollapsibleSection 
          title="Materials"
          isOpen={openSections.materials}
          onToggle={() => toggleSection('materials')}
        >
          {/* DC Cable with selector */}
          <div className="flex items-center gap-1">
            <ToolButton
              icon={() => <div className="w-4 h-0.5 bg-orange-500 rounded" />}
              label="DC Cable"
              isActive={activeTool === Tool.LINE_DC}
              onClick={() => setActiveTool(Tool.LINE_DC)}
              disabled={!scaleSet}
            />
            {(plantSetupConfig.dcCables?.length || 0) > 1 && setSelectedDcCableId && (
              <ConfigSelectorPopover
                items={toConfigItems(plantSetupConfig.dcCables || [])}
                selectedId={selectedDcCableId}
                onSelect={setSelectedDcCableId}
                label="Select DC Cable"
              />
            )}
          </div>
          {/* Show currently selected DC cable */}
          {(plantSetupConfig.dcCables?.length || 0) > 0 && (
            <p className="text-[10px] text-muted-foreground pl-6 -mt-1 truncate">
              {(plantSetupConfig.dcCables?.find(c => c.id === selectedDcCableId) || plantSetupConfig.dcCables?.find(c => c.isDefault) || plantSetupConfig.dcCables?.[0])?.name}
            </p>
          )}
          
          {/* AC Cable with selector */}
          <div className="flex items-center gap-1">
            <ToolButton
              icon={() => <div className="w-4 h-0.5 bg-blue-500 rounded" />}
              label="AC Cable"
              isActive={activeTool === Tool.LINE_AC}
              onClick={() => setActiveTool(Tool.LINE_AC)}
              disabled={!scaleSet}
            />
            {(plantSetupConfig.acCables?.length || 0) > 1 && setSelectedAcCableId && (
              <ConfigSelectorPopover
                items={toConfigItems(plantSetupConfig.acCables || [])}
                selectedId={selectedAcCableId}
                onSelect={setSelectedAcCableId}
                label="Select AC Cable"
              />
            )}
          </div>
          {/* Show currently selected AC cable */}
          {(plantSetupConfig.acCables?.length || 0) > 0 && (
            <p className="text-[10px] text-muted-foreground pl-6 -mt-1 truncate">
              {(plantSetupConfig.acCables?.find(c => c.id === selectedAcCableId) || plantSetupConfig.acCables?.find(c => c.isDefault) || plantSetupConfig.acCables?.[0])?.name}
            </p>
          )}
          <ToolButton
            icon={() => <span className="text-xs font-mono">+</span>}
            label="DC Combiner"
            isActive={activeTool === Tool.PLACE_DC_COMBINER}
            onClick={() => setActiveTool(Tool.PLACE_DC_COMBINER)}
            disabled={!scaleSet}
          />
          <ToolButton
            icon={() => <span className="text-xs font-mono">/</span>}
            label="AC Disconnect"
            isActive={activeTool === Tool.PLACE_AC_DISCONNECT}
            onClick={() => setActiveTool(Tool.PLACE_AC_DISCONNECT)}
            disabled={!scaleSet}
          />
          {/* Walkway with selector */}
          <div className="flex items-center gap-1">
            <ToolButton
              icon={() => <span className="text-xs font-mono">═</span>}
              label="Walkway"
              isActive={activeTool === Tool.PLACE_WALKWAY}
              onClick={() => setActiveTool(Tool.PLACE_WALKWAY)}
              disabled={!scaleSet || plantSetupConfig.walkways.length === 0}
            />
            {plantSetupConfig.walkways.length > 1 && setSelectedWalkwayId && (
              <ConfigSelectorPopover
                items={toConfigItems(plantSetupConfig.walkways)}
                selectedId={selectedWalkwayId}
                onSelect={setSelectedWalkwayId}
                label="Select Walkway"
              />
            )}
          </div>
          {/* Show currently selected walkway */}
          {plantSetupConfig.walkways.length > 0 && (
            <p className="text-[10px] text-muted-foreground pl-6 -mt-1 truncate">
              {(plantSetupConfig.walkways.find(w => w.id === selectedWalkwayId) || plantSetupConfig.walkways[0])?.name}
            </p>
          )}
          
          {/* Cable Tray with selector */}
          <div className="flex items-center gap-1">
            <ToolButton
              icon={() => <span className="text-xs font-mono">≡</span>}
              label="Cable Tray"
              isActive={activeTool === Tool.PLACE_CABLE_TRAY}
              onClick={() => setActiveTool(Tool.PLACE_CABLE_TRAY)}
              disabled={!scaleSet || plantSetupConfig.cableTrays.length === 0}
            />
            {plantSetupConfig.cableTrays.length > 1 && setSelectedCableTrayId && (
              <ConfigSelectorPopover
                items={toConfigItems(plantSetupConfig.cableTrays)}
                selectedId={selectedCableTrayId}
                onSelect={setSelectedCableTrayId}
                label="Select Cable Tray"
              />
            )}
          </div>
          {/* Show currently selected cable tray */}
          {plantSetupConfig.cableTrays.length > 0 && (
            <p className="text-[10px] text-muted-foreground pl-6 -mt-1 truncate">
              {(plantSetupConfig.cableTrays.find(c => c.id === selectedCableTrayId) || plantSetupConfig.cableTrays[0])?.name}
            </p>
          )}
        </CollapsibleSection>

        <Separator className="my-2" />

        {/* Tools */}
        <CollapsibleSection 
          title="Tools"
          isOpen={openSections.tools}
          onToggle={() => toggleSection('tools')}
        >
          <ToolButton
            icon={Copy}
            label={selectionCount > 1 ? `Copy (${selectionCount})` : "Copy"}
            isActive={false}
            onClick={() => onCopySelected?.()}
            disabled={!selectedItemId && selectionCount === 0}
          />
          <ToolButton
            icon={MoveHorizontal}
            label="Distance Between"
            isActive={activeTool === Tool.DIMENSION}
            onClick={() => setActiveTool(Tool.DIMENSION)}
            disabled={!scaleSet}
          />
          <ToolButton
            icon={AlignVerticalJustifyStart}
            label="Edge Align"
            isActive={activeTool === Tool.ALIGN_EDGES}
            onClick={() => setActiveTool(Tool.ALIGN_EDGES)}
            disabled={!scaleSet}
          />
          
          {/* Dimension tool instructions */}
          {activeTool === Tool.DIMENSION && (
            <div className="mt-2 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
              {!dimensionObject1Id && !dimensionObject2Id && (
                <p>Click on the first object (will move)</p>
              )}
              {dimensionObject1Id && !dimensionObject2Id && (
                <p className="text-blue-600 dark:text-blue-400">Now click the reference object (stationary)</p>
              )}
              {dimensionObject1Id && dimensionObject2Id && (
                <p className="text-green-600 dark:text-green-400">Both objects selected!</p>
              )}
            </div>
          )}

          {/* Align edges tool instructions */}
          {activeTool === Tool.ALIGN_EDGES && (
            <div className="mt-2 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
              {!alignObject1Id && !alignObject2Id && (
                <p>Click on the first object (will move)</p>
              )}
              {alignObject1Id && !alignObject2Id && (
                <p className="text-blue-600 dark:text-blue-400">Now click the reference object (stationary)</p>
              )}
              {alignObject1Id && alignObject2Id && (
                <p className="text-green-600 dark:text-green-400">Both objects selected!</p>
              )}
            </div>
          )}
        </CollapsibleSection>

        {/* Rotation control for placement tools */}
        {[Tool.PLACE_INVERTER, Tool.PLACE_WALKWAY, Tool.PLACE_CABLE_TRAY, Tool.PLACE_DC_COMBINER, Tool.PLACE_AC_DISCONNECT, Tool.PLACE_MAIN_BOARD].includes(activeTool) && (
          <>
            <Separator className="my-2" />
            <div className="px-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={rotateNext}
              >
                <RotateCw className="h-4 w-4 mr-2" />
                <span className="text-xs">Rotate ({placementRotation}°)</span>
              </Button>
              <p className="text-xs text-muted-foreground mt-1 text-center">
                Press R to rotate
              </p>
            </div>
          </>
        )}
      </div>

      {/* Bottom actions */}
      <div className="p-2 border-t">
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
