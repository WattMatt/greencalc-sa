import { 
  MousePointer, Hand, Ruler, Sun, Layers, RotateCw, 
  Download, Upload, Settings, Undo2, Redo2, Save, Loader2
} from 'lucide-react';
import { Tool, ScaleInfo, PVPanelConfig } from '../types';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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

interface ToolbarProps {
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;
  scaleInfo: ScaleInfo;
  pvPanelConfig: PVPanelConfig | null;
  pvArrays: PVArrayItem[];
  onLoadPdf: (file: File) => void;
  onOpenPVConfig: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  placementRotation: number;
  setPlacementRotation: (rotation: number) => void;
  pdfLoaded: boolean;
}

export function Toolbar({
  activeTool,
  setActiveTool,
  scaleInfo,
  pvPanelConfig,
  pvArrays,
  onLoadPdf,
  onOpenPVConfig,
  onUndo,
  onRedo,
  onSave,
  canUndo,
  canRedo,
  isSaving,
  hasUnsavedChanges,
  placementRotation,
  setPlacementRotation,
  pdfLoaded,
}: ToolbarProps) {
  const scaleSet = scaleInfo.ratio !== null;
  const pvConfigured = pvPanelConfig !== null;
  
  const { panelCount, capacityKwp } = pvConfigured 
    ? calculateTotalPVCapacity(pvArrays, pvPanelConfig!)
    : { panelCount: 0, capacityKwp: 0 };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      onLoadPdf(file);
    }
  };

  const rotateNext = () => {
    setPlacementRotation((placementRotation + 45) % 360);
  };

  return (
    <div className="w-52 bg-card border-r flex flex-col h-full">
      <div className="p-3 border-b">
        <h2 className="font-semibold text-sm">PV Layout Tool</h2>
        {pvConfigured && panelCount > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            {panelCount} panels • {capacityKwp.toFixed(1)} kWp
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {/* File Actions */}
        <div className="space-y-1">
          <label className="block">
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button variant="outline" size="sm" className="w-full justify-start" asChild>
              <span>
                <Upload className="h-4 w-4 mr-2" />
                <span className="text-xs">Load PDF</span>
              </span>
            </Button>
          </label>
        </div>

        <Separator className="my-2" />

        {/* General Tools */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground px-2 py-1">General</p>
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
            disabled={!pdfLoaded}
            badge={scaleSet ? '✓' : undefined}
          />
        </div>

        <Separator className="my-2" />

        {/* PV Configuration */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground px-2 py-1">PV Setup</p>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={onOpenPVConfig}
          >
            <Settings className="h-4 w-4 mr-2" />
            <span className="text-xs">Panel Config</span>
            {pvConfigured && (
              <span className="ml-auto text-xs text-muted-foreground">
                {pvPanelConfig!.wattage}W
              </span>
            )}
          </Button>
        </div>

        <Separator className="my-2" />

        {/* PV Tools */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground px-2 py-1">Roof & Arrays</p>
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
        </div>

        <Separator className="my-2" />

        {/* Lines */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground px-2 py-1">Cabling</p>
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
        </div>

        <Separator className="my-2" />

        {/* Equipment */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground px-2 py-1">Equipment</p>
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
        </div>

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
      <div className="p-2 border-t space-y-2">
        <Button
          variant={hasUnsavedChanges ? 'default' : 'outline'}
          size="sm"
          className="w-full"
          onClick={onSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          <span className="text-xs">{isSaving ? 'Saving...' : 'Save Layout'}</span>
        </Button>
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
