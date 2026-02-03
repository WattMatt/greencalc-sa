import { useState } from 'react';
import { 
  MousePointer, Hand, Ruler, Sun, Layers, RotateCw, 
  Upload, Undo2, Redo2, Save, Loader2, ArrowLeft,
  ChevronLeft, ChevronRight, ChevronDown, Copy, MoveHorizontal, AlignVerticalJustifyStart
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
          <ToolButton
            icon={Sun}
            label="Solar Module"
            isActive={activeTool === Tool.PV_ARRAY}
            onClick={() => setActiveTool(Tool.PV_ARRAY)}
            disabled={!scaleSet || !pvConfigured}
          />
          <ToolButton
            icon={() => <span className="text-xs font-mono">~=</span>}
            label="Inverter"
            isActive={activeTool === Tool.PLACE_INVERTER}
            onClick={() => setActiveTool(Tool.PLACE_INVERTER)}
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

        <Separator className="my-2" />

        {/* Materials */}
        <CollapsibleSection 
          title="Materials"
          isOpen={openSections.materials}
          onToggle={() => toggleSection('materials')}
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
            icon={() => <span className="text-xs font-mono">═</span>}
            label="Walkway"
            isActive={activeTool === Tool.PLACE_WALKWAY}
            onClick={() => setActiveTool(Tool.PLACE_WALKWAY)}
            disabled={!scaleSet}
          />
          <ToolButton
            icon={() => <span className="text-xs font-mono">≡</span>}
            label="Cable Tray"
            isActive={activeTool === Tool.PLACE_CABLE_TRAY}
            onClick={() => setActiveTool(Tool.PLACE_CABLE_TRAY)}
            disabled={!scaleSet}
          />
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
