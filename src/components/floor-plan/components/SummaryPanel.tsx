import { useState } from 'react';
import { Sun, Layers, Cable, Zap, Hash, ChevronLeft, ChevronRight, ChevronDown, Pencil, Trash2, Box, Footprints, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PVArrayItem, RoofMask, SupplyLine, EquipmentItem, PVPanelConfig, ScaleInfo, PlantSetupConfig } from '../types';
import { calculateTotalPVCapacity, calculatePolygonArea, calculateLineLength } from '../utils/geometry';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface SimulationData {
  id: string;
  name: string;
  solar_capacity_kwp: number | null;
  battery_capacity_kwh: number | null;
  battery_power_kw: number | null;
  annual_solar_savings: number | null;
  roi_percentage: number | null;
  results_json: any;
}

interface SummaryPanelProps {
  pvArrays: PVArrayItem[];
  roofMasks: RoofMask[];
  lines: SupplyLine[];
  equipment: EquipmentItem[];
  pvPanelConfig: PVPanelConfig | null;
  scaleInfo: ScaleInfo;
  selectedItemId: string | null;
  onSelectItem: (id: string | null) => void;
  onEditRoofMask?: (id: string) => void;
  onDeleteItem?: (id: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  plantSetupConfig?: PlantSetupConfig;
  latestSimulation?: SimulationData | null;
}

// Reusable collapsible section component
function CollapsibleSection({
  icon,
  title,
  summary,
  defaultOpen = true,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-2 w-full hover:bg-accent/50 rounded p-1 -ml-1 transition-colors">
          {icon}
          <span className="text-sm font-medium">{title}</span>
          <span className="text-xs text-muted-foreground ml-auto mr-1">
            {summary}
          </span>
          <ChevronDown className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            isOpen && "rotate-180"
          )} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function SummaryPanel({
  pvArrays,
  roofMasks,
  lines,
  equipment,
  pvPanelConfig,
  scaleInfo,
  selectedItemId,
  onSelectItem,
  onEditRoofMask,
  onDeleteItem,
  isCollapsed,
  onToggleCollapse,
  plantSetupConfig,
  latestSimulation,
}: SummaryPanelProps) {
  const { panelCount, capacityKwp } = pvPanelConfig
    ? calculateTotalPVCapacity(pvArrays, pvPanelConfig)
    : { panelCount: 0, capacityKwp: 0 };

  const totalRoofArea = roofMasks.reduce((sum, mask) => 
    sum + calculatePolygonArea(mask.points, scaleInfo.ratio), 0
  );

  const dcCableLength = lines
    .filter(l => l.type === 'dc')
    .reduce((sum, l) => sum + calculateLineLength(l.points, scaleInfo.ratio), 0);

  const acCableLength = lines
    .filter(l => l.type === 'ac')
    .reduce((sum, l) => sum + calculateLineLength(l.points, scaleInfo.ratio), 0);

  // Plant setup quantities
  const totalWalkwayLength = plantSetupConfig?.walkways.reduce((sum, w) => sum + w.length, 0) ?? 0;
  const totalCableTrayLength = plantSetupConfig?.cableTrays.reduce((sum, c) => sum + c.length, 0) ?? 0;
  
  // Simulation comparison values
  const simModuleCount = latestSimulation?.results_json?.moduleCount ?? null;
  const simInverterCount = latestSimulation?.results_json?.inverterCount ?? null;
  
  // Layout inverter count (placed on canvas)
  const layoutInverterCount = equipment.filter(e => e.type === 'Inverter').length;
  
  // Check if layout matches simulation
  const modulesMatch = simModuleCount === null || simModuleCount === panelCount;
  const invertersMatch = simInverterCount === null || simInverterCount === layoutInverterCount;

  // Collapsed state - thin strip with expand button
  if (isCollapsed) {
    return (
      <div className="w-10 bg-card border-l flex flex-col items-center py-3 gap-2">
        <Button variant="ghost" size="icon" onClick={onToggleCollapse} title="Expand summary">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {panelCount > 0 && (
          <>
            <div className="text-xs font-semibold text-center" title={`${capacityKwp.toFixed(1)} kWp`}>
              {capacityKwp.toFixed(0)}
            </div>
            <div className="text-[10px] text-muted-foreground">kWp</div>
          </>
        )}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="w-64 bg-card border-l flex flex-col h-full">
        <div className="p-3 border-b flex items-center justify-between">
          <h2 className="font-semibold text-sm">Project Summary</h2>
          {onToggleCollapse && (
            <Button variant="ghost" size="icon" className="h-6 w-6 -mr-1" onClick={onToggleCollapse} title="Collapse summary">
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-3">
            {/* Key Metrics - 2x2 Grid */}
            <div className="grid grid-cols-2 gap-2">
              {/* Modules Card - Top Left */}
              <Card className={cn(!modulesMatch && "border-amber-500")}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4 text-blue-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Modules</p>
                      <div className="flex items-center gap-1">
                        <p className="font-semibold text-sm">{panelCount}</p>
                        {simModuleCount !== null && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className={cn(
                                "text-[10px]",
                                modulesMatch ? "text-green-600" : "text-amber-600"
                              )}>
                                {modulesMatch ? (
                                  <Check className="h-3 w-3" />
                                ) : (
                                  <span>/{simModuleCount}</span>
                                )}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {modulesMatch 
                                ? "Matches simulation" 
                                : `Simulation expects ${simModuleCount} modules`}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Inverters Card - Top Right */}
              <Card className={cn(!invertersMatch && "border-amber-500")}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-green-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Inverters</p>
                      <div className="flex items-center gap-1">
                        <p className="font-semibold text-sm">{layoutInverterCount}</p>
                        {simInverterCount !== null && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className={cn(
                                "text-[10px]",
                                invertersMatch ? "text-green-600" : "text-amber-600"
                              )}>
                                {invertersMatch ? (
                                  <Check className="h-3 w-3" />
                                ) : (
                                  <span>/{simInverterCount}</span>
                                )}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {invertersMatch 
                                ? "Matches simulation" 
                                : `Simulation expects ${simInverterCount} inverters`}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Walkways Card - Bottom Left */}
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <Footprints className="h-4 w-4 text-slate-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Walkways</p>
                      <p className="font-semibold text-sm">{totalWalkwayLength.toFixed(0)} m</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Cable Trays Card - Bottom Right */}
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <Box className="h-4 w-4 text-orange-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Cable Trays</p>
                      <p className="font-semibold text-sm">{totalCableTrayLength.toFixed(0)} m</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Roof Masks - Collapsible */}
            <CollapsibleSection
              icon={<Layers className="h-4 w-4 text-purple-500" />}
              title="Roof Areas"
              summary={`${totalRoofArea.toFixed(0)} m²`}
              defaultOpen={true}
            >
              {roofMasks.length === 0 ? (
                <p className="text-xs text-muted-foreground">No roof masks defined</p>
              ) : (
                <div className="space-y-1">
                  {roofMasks.map((mask, i) => (
                    <div
                      key={mask.id}
                      className={`w-full flex items-center justify-between p-2 rounded text-xs transition-colors ${
                        selectedItemId === mask.id 
                          ? 'bg-primary/10 border border-primary' 
                          : 'bg-muted hover:bg-accent'
                      }`}
                    >
                      <button
                        className="flex-1 text-left"
                        onClick={() => onSelectItem(mask.id)}
                        onDoubleClick={() => onEditRoofMask?.(mask.id)}
                      >
                        <span className="font-medium">Roof {i + 1}</span>
                        <span className="text-muted-foreground ml-2">
                           {calculatePolygonArea(mask.points, scaleInfo.ratio).toFixed(0)} m² • {mask.pitch}° • {mask.direction}°
                        </span>
                      </button>
                      {onEditRoofMask && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditRoofMask(mask.id);
                          }}
                          title="Edit roof configuration"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                      {onDeleteItem && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteItem(mask.id);
                          }}
                          title="Delete roof mask"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CollapsibleSection>

            {/* PV Arrays - Collapsible */}
            <CollapsibleSection
              icon={<Sun className="h-4 w-4 text-yellow-500" />}
              title="PV Arrays"
              summary={`${pvArrays.length} arrays`}
              defaultOpen={true}
            >
              {pvArrays.length === 0 ? (
                <p className="text-xs text-muted-foreground">No arrays placed</p>
              ) : (
                <div className="space-y-1">
                  {pvArrays.map((arr, i) => {
                    const panels = arr.rows * arr.columns;
                    const kWp = pvPanelConfig ? (panels * pvPanelConfig.wattage) / 1000 : 0;
                    return (
                      <div
                        key={arr.id}
                        className={`w-full flex items-center justify-between p-2 rounded text-xs transition-colors ${
                          selectedItemId === arr.id 
                            ? 'bg-primary/10 border border-primary' 
                            : 'bg-muted hover:bg-accent'
                        }`}
                      >
                        <button
                          className="flex-1 text-left"
                          onClick={() => onSelectItem(arr.id)}
                        >
                          <span className="font-medium">Array {i + 1}</span>
                          <span className="text-muted-foreground ml-2">
                            {arr.rows}×{arr.columns} • {kWp.toFixed(1)} kWp
                          </span>
                        </button>
                        {onDeleteItem && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteItem(arr.id);
                            }}
                            title="Delete PV array"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CollapsibleSection>

            {/* Cabling - Collapsible */}
            <CollapsibleSection
              icon={<Cable className="h-4 w-4 text-orange-500" />}
              title="Cabling"
              summary={`${(dcCableLength + acCableLength).toFixed(0)} m`}
              defaultOpen={false}
            >
              <div className="space-y-1 text-xs">
                <div className="flex justify-between p-2 bg-muted rounded">
                  <span className="flex items-center gap-1">
                    <div className="w-3 h-0.5 bg-orange-500 rounded" />
                    DC Cable
                  </span>
                  <span>{dcCableLength.toFixed(1)} m</span>
                </div>
                <div className="flex justify-between p-2 bg-muted rounded">
                  <span className="flex items-center gap-1">
                    <div className="w-3 h-0.5 bg-blue-500 rounded" />
                    AC Cable
                  </span>
                  <span>{acCableLength.toFixed(1)} m</span>
                </div>
              </div>
            </CollapsibleSection>

            {/* Equipment - Collapsible */}
            <CollapsibleSection
              icon={<Zap className="h-4 w-4 text-green-500" />}
              title="Equipment"
              summary={`${equipment.length} items`}
              defaultOpen={false}
            >
              {equipment.length === 0 ? (
                <p className="text-xs text-muted-foreground">No equipment placed</p>
              ) : (
                <div className="space-y-1">
                  {/* Group by type */}
                  {Object.entries(
                    equipment.reduce((acc, eq) => {
                      acc[eq.type] = (acc[eq.type] || 0) + 1;
                      return acc;
                    }, {} as Record<string, number>)
                  ).map(([type, count]) => (
                    <div key={type} className="flex justify-between p-2 bg-muted rounded text-xs">
                      <span>{type}</span>
                      <span>×{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </CollapsibleSection>
          </div>
        </ScrollArea>
      </div>
    </TooltipProvider>
  );
}
