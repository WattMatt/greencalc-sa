import { useState } from 'react';
import { 
  MousePointer, Hand, Ruler, Sun, Layers, RotateCw, 
  Upload, Undo2, Redo2, Save, Loader2, ArrowLeft,
  ChevronLeft, ChevronRight, ChevronDown
} from 'lucide-react';
import { Tool, ScaleInfo, PVPanelConfig, PlantSetupConfig } from '../types';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
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
  placementRotation: number;
  setPlacementRotation: (rotation: number) => void;
  layoutLoaded: boolean;
  currentLayoutName: string;
  onBackToBrowser?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
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
  placementRotation,
  setPlacementRotation,
  layoutLoaded,
  currentLayoutName,
  onBackToBrowser,
  isCollapsed,
  onToggleCollapse,
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
    roofArrays: false,
    cabling: false,
    equipment: false,
  });

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
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
              {hasUnsavedChanges && <span className="text-primary ml-1">•</span>}
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
        </CollapsibleSection>

        <Separator className="my-2" />

        {/* Roof & Arrays */}
        <CollapsibleSection 
          title="Roof & Arrays"
          isOpen={openSections.roofArrays}
          onToggle={() => toggleSection('roofArrays')}
        >
          <ToolButton
            icon={Layers}
            label="Draw Roof Mask"
            isActive={activeTool === Tool.ROOF_MASK}
            onClick={() => setActiveTool(Tool.ROOF_MASK)}
            disabled={!scaleSet}
          />
          <ToolButton
            icon={Sun}
            label="Place PV Array"
            isActive={activeTool === Tool.PV_ARRAY}
            onClick={() => setActiveTool(Tool.PV_ARRAY)}
            disabled={!scaleSet || !pvConfigured}
          />
        </CollapsibleSection>

        <Separator className="my-2" />

        {/* Cabling */}
        <CollapsibleSection 
          title="Cabling"
          isOpen={openSections.cabling}
          onToggle={() => toggleSection('cabling')}
        >
          <ToolButton
            icon={() => <div className="w-4 h-0.5 bg-orange-500 rounded" />}
            label="DC Cable"
            isActive={activeTool === Tool.LINE_DC}
            onClick={() => setActiveTool(Tool.LINE_DC)}
            disabled={!scaleSet}
          />
          <ToolButton
            icon={() => <div className="w-4 h-0.5 bg-blue-500 rounded" />}
            label="AC Cable"
            isActive={activeTool === Tool.LINE_AC}
            onClick={() => setActiveTool(Tool.LINE_AC)}
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
          <ToolButton
            icon={() => <span className="text-xs font-mono">~=</span>}
            label="Inverter"
            isActive={activeTool === Tool.PLACE_INVERTER}
            onClick={() => setActiveTool(Tool.PLACE_INVERTER)}
            disabled={!scaleSet}
          />
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
          <ToolButton
            icon={() => <span className="text-xs font-mono">▮</span>}
            label="Main Board"
            isActive={activeTool === Tool.PLACE_MAIN_BOARD}
            onClick={() => setActiveTool(Tool.PLACE_MAIN_BOARD)}
            disabled={!scaleSet}
          />
        </CollapsibleSection>

        {/* Rotation control for equipment placement */}
        {[Tool.PLACE_INVERTER, Tool.PLACE_DC_COMBINER, Tool.PLACE_AC_DISCONNECT, Tool.PLACE_MAIN_BOARD].includes(activeTool) && (
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
