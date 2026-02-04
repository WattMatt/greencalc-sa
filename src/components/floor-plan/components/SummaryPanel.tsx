import { useState, useMemo } from 'react';
import { Sun, Layers, Cable, Zap, Hash, ChevronLeft, ChevronRight, ChevronDown, Pencil, Trash2, Box, Footprints, Check, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PVArrayItem, RoofMask, SupplyLine, EquipmentItem, PVPanelConfig, ScaleInfo, PlantSetupConfig, PlacedWalkway, PlacedCableTray, EquipmentType, LayerVisibility } from '../types';
import { calculateTotalPVCapacity, calculatePolygonArea, calculateLineLength } from '../utils/geometry';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

// Type for grouped materials
interface GroupedMaterial<T> {
  name: string;
  items: T[];
  totalLength: number;
}

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
  selectedItemIds?: Set<string>;
  onSelectItem: (id: string | null) => void;
  onEditRoofMask?: (id: string) => void;
  onDeleteItem?: (id: string) => void;
  onDeletePlacedItem?: (type: 'walkway' | 'cableTray', id: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  plantSetupConfig?: PlantSetupConfig;
  placedWalkways?: PlacedWalkway[];
  placedCableTrays?: PlacedCableTray[];
  assignedSimulation?: SimulationData | null;
  simulationSelector?: React.ReactNode;
  layerVisibility?: LayerVisibility;
  onToggleLayerVisibility?: (layer: keyof LayerVisibility) => void;
  // Subgroup visibility (from parent)
  walkwaySubgroupVisibility?: Record<string, boolean>;
  cableTraySubgroupVisibility?: Record<string, boolean>;
  onToggleWalkwaySubgroupVisibility?: (configId: string) => void;
  onToggleCableTraySubgroupVisibility?: (configId: string) => void;
  // Force-show layer handlers for when selecting hidden items
  onShowWalkwayLayer?: () => void;
  onShowCableTrayLayer?: () => void;
}

// Reusable collapsible section component with visibility toggle
function CollapsibleSection({
  icon,
  title,
  summary,
  defaultOpen = true,
  children,
  isVisible,
  onToggleVisibility,
}: {
  icon: React.ReactNode;
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  isVisible?: boolean;
  onToggleVisibility?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  // Default to visible if not specified
  const visible = isVisible !== false;
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex items-center gap-1 w-full">
        {/* Visibility toggle button - on left */}
        {onToggleVisibility !== undefined && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 -ml-1"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleVisibility();
                }}
              >
                {visible ? (
                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5 text-muted-foreground/50" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              {visible ? 'Hide on canvas' : 'Show on canvas'}
            </TooltipContent>
          </Tooltip>
        )}
        <CollapsibleTrigger asChild>
          <button className={cn(
            "flex items-center gap-2 flex-1 hover:bg-accent/50 rounded p-1 transition-colors",
            !visible && "opacity-50"
          )}>
            {icon}
            <span className="text-sm font-medium">{title}</span>
            <span className="text-xs text-muted-foreground ml-auto">
              {summary}
            </span>
            {/* Chevron on far right */}
            <ChevronDown className={cn(
              "h-4 w-4 text-muted-foreground transition-transform shrink-0 ml-1",
              isOpen && "rotate-180"
            )} />
          </button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="pt-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

// Grouped material section with nested collapsibles and per-subgroup visibility
function GroupedMaterialSection<T extends { id: string; name: string; width: number; length: number; configId?: string }>({
  icon,
  title,
  totalSummary,
  groupedItems,
  itemType,
  onDeleteItem,
  isVisible,
  onToggleVisibility,
  subgroupVisibility,
  onToggleSubgroupVisibility,
  selectedItemIds,
  onSelectItem,
  onShowLayer,
}: {
  icon: React.ReactNode;
  title: string;
  totalSummary: string;
  groupedItems: Record<string, GroupedMaterial<T>>;
  itemType: 'walkway' | 'cableTray';
  onDeleteItem?: (type: 'walkway' | 'cableTray', id: string) => void;
  isVisible?: boolean;
  onToggleVisibility?: () => void;
  subgroupVisibility?: Record<string, boolean>;
  onToggleSubgroupVisibility?: (configId: string) => void;
  selectedItemIds?: Set<string>;
  onSelectItem?: (id: string) => void;
  onShowLayer?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const groupKeys = Object.keys(groupedItems);
  const visible = isVisible !== false;
  
  const toggleGroup = (key: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Handle item click - auto-show layer and subgroup if hidden
  const handleItemClick = (item: T, groupKey: string) => {
    // Auto-show layer if hidden
    if (isVisible === false && onShowLayer) {
      onShowLayer();
    }
    // Auto-show subgroup if hidden
    if (subgroupVisibility?.[groupKey] === false && onToggleSubgroupVisibility) {
      onToggleSubgroupVisibility(groupKey);
    }
    // Select the item
    onSelectItem?.(item.id);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex items-center gap-1 w-full">
        {/* Visibility toggle button - on left */}
        {onToggleVisibility !== undefined && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 -ml-1"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleVisibility();
                }}
              >
                {visible ? (
                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5 text-muted-foreground/50" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              {visible ? 'Hide on canvas' : 'Show on canvas'}
            </TooltipContent>
          </Tooltip>
        )}
        <CollapsibleTrigger asChild>
          <button className={cn(
            "flex items-center gap-2 flex-1 hover:bg-accent/50 rounded p-1 transition-colors",
            !visible && "opacity-50"
          )}>
            {icon}
            <span className="text-sm font-medium">{title}</span>
            <span className="text-xs text-muted-foreground ml-auto">
              {totalSummary}
            </span>
            {/* Chevron on far right */}
            <ChevronDown className={cn(
              "h-4 w-4 text-muted-foreground transition-transform shrink-0 ml-1",
              isOpen && "rotate-180"
            )} />
          </button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="pt-2">
        {groupKeys.length === 0 ? (
          <p className="text-xs text-muted-foreground">No {title.toLowerCase()} placed</p>
        ) : (
          <div className="space-y-1 pl-2">
            {groupKeys.map((key) => {
              const group = groupedItems[key];
              const isGroupOpen = openGroups.has(key);
              const isSubgroupVisible = subgroupVisibility?.[key] !== false;
              return (
                <Collapsible key={key} open={isGroupOpen} onOpenChange={() => toggleGroup(key)}>
                  <div className="flex items-center gap-1 w-full">
                    {/* Subgroup visibility toggle - on left */}
                    {onToggleSubgroupVisibility && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleSubgroupVisibility(key);
                            }}
                          >
                            {isSubgroupVisible ? (
                              <Eye className="h-3 w-3 text-muted-foreground" />
                            ) : (
                              <EyeOff className="h-3 w-3 text-muted-foreground/50" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left">
                          {isSubgroupVisible ? 'Hide on canvas' : 'Show on canvas'}
                        </TooltipContent>
                      </Tooltip>
                    )}
                    <CollapsibleTrigger asChild>
                      <button className={cn(
                        "flex items-center gap-2 flex-1 hover:bg-accent/50 rounded p-1 text-xs transition-colors",
                        !isSubgroupVisible && "opacity-50"
                      )}>
                        <span className="font-medium">{group.name}</span>
                        <span className="text-muted-foreground ml-auto">
                          {group.totalLength.toFixed(1)}m ({group.items.length})
                        </span>
                        {/* Chevron on far right for sub-groups */}
                        <ChevronDown className={cn(
                          "h-3 w-3 text-muted-foreground transition-transform shrink-0",
                          isGroupOpen && "rotate-180"
                        )} />
                      </button>
                    </CollapsibleTrigger>
                  </div>
                  <CollapsibleContent className="pt-1 pl-6 space-y-1">
                    {group.items.map((item) => {
                      const isSelected = selectedItemIds?.has(item.id) ?? false;
                      return (
                        <div 
                          key={item.id} 
                          className={cn(
                            "flex items-center justify-between p-1.5 rounded text-xs transition-colors",
                            isSelected 
                              ? "bg-primary/10 border border-primary" 
                              : "bg-muted hover:bg-accent"
                          )}
                        >
                          <button
                            type="button"
                            className={cn(
                              "flex-1 text-left",
                              isSelected && "font-medium"
                            )}
                            onClick={() => handleItemClick(item, key)}
                          >
                            <span className="text-muted-foreground">
                              {Math.min(item.width, item.length).toFixed(3)}m × {Math.max(item.width, item.length).toFixed(2)}m
                            </span>
                          </button>
                          {onDeleteItem && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 shrink-0 text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteItem(itemType, item.id);
                              }}
                              title={`Delete ${itemType === 'walkway' ? 'walkway' : 'cable tray'}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        )}
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
  selectedItemIds,
  onSelectItem,
  onEditRoofMask,
  onDeleteItem,
  onDeletePlacedItem,
  isCollapsed,
  onToggleCollapse,
  plantSetupConfig,
  placedWalkways = [],
  placedCableTrays = [],
  assignedSimulation,
  simulationSelector,
  layerVisibility,
  onToggleLayerVisibility,
  walkwaySubgroupVisibility,
  cableTraySubgroupVisibility,
  onToggleWalkwaySubgroupVisibility,
  onToggleCableTraySubgroupVisibility,
  onShowWalkwayLayer,
  onShowCableTrayLayer,
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

  // Placed item quantities (from DesignState, not plant setup config)
  // Use Math.max(width, length) to get actual length regardless of orientation swap
  const totalWalkwayLength = placedWalkways.reduce((sum, w) => sum + Math.max(w.width, w.length), 0);
  const totalCableTrayLength = placedCableTrays.reduce((sum, c) => sum + Math.max(c.width, c.length), 0);
  
  // Group walkways by configId - use Math.max for correct length
  const groupedWalkways = useMemo(() => {
    const groups: Record<string, GroupedMaterial<PlacedWalkway>> = {};
    placedWalkways.forEach(item => {
      const key = item.configId || 'default';
      if (!groups[key]) {
        groups[key] = { name: item.name, items: [], totalLength: 0 };
      }
      groups[key].items.push(item);
      groups[key].totalLength += Math.max(item.width, item.length);
    });
    return groups;
  }, [placedWalkways]);
  
  // Group cable trays by configId - use Math.max for correct length
  const groupedCableTrays = useMemo(() => {
    const groups: Record<string, GroupedMaterial<PlacedCableTray>> = {};
    placedCableTrays.forEach(item => {
      const key = item.configId || 'default';
      if (!groups[key]) {
        groups[key] = { name: item.name, items: [], totalLength: 0 };
      }
      groups[key].items.push(item);
      groups[key].totalLength += Math.max(item.width, item.length);
    });
    return groups;
  }, [placedCableTrays]);
  
  // Use visibility props from parent (if provided)
  
  // Simulation comparison values
  const simModuleCount = assignedSimulation?.results_json?.moduleCount ?? null;
  const simInverterCount = assignedSimulation?.results_json?.inverterCount ?? null;
  
  // Layout inverter count (placed on canvas) - use enum for reliable matching
  const layoutInverterCount = equipment.filter(e => e.type === EquipmentType.INVERTER).length;
  
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
        <div className="p-3 border-b space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm">Project Summary</h2>
            {onToggleCollapse && (
              <Button variant="ghost" size="icon" className="h-6 w-6 -mr-1" onClick={onToggleCollapse} title="Collapse summary">
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
          {simulationSelector && (
            <div className="pt-1">
              {simulationSelector}
            </div>
          )}
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-3">
            {/* Static Metrics Grid - 2x2 */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              {/* Modules - Top Left */}
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
              
              {/* Inverters - Top Right */}
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
              
              {/* Walkways - Bottom Left */}
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <Footprints className="h-4 w-4 text-slate-500" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">Walkways</p>
                      <p className="font-semibold text-sm">{totalWalkwayLength.toFixed(0)} m</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Cable Trays - Bottom Right */}
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <Box className="h-4 w-4 text-orange-500" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">Cable Trays</p>
                      <p className="font-semibold text-sm">{totalCableTrayLength.toFixed(0)} m</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Roof Areas - Between grid and detail dropdowns */}
            <CollapsibleSection
              icon={<Layers className="h-4 w-4 text-purple-500" />}
              title="Roof Areas"
              summary={`${totalRoofArea.toFixed(0)} m²`}
              defaultOpen={false}
              isVisible={layerVisibility?.roofMasks}
              onToggleVisibility={onToggleLayerVisibility ? () => onToggleLayerVisibility('roofMasks') : undefined}
            >
              {roofMasks.length === 0 ? (
                <p className="text-xs text-muted-foreground">No roof masks defined</p>
              ) : (
                <div className="space-y-1">
                  {roofMasks.map((mask, i) => (
                    <div
                      key={mask.id}
                      className={`w-full flex items-center justify-between p-2 rounded text-xs transition-colors ${
                        selectedItemIds?.has(mask.id)
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

            {/* Collapsible Detail Sections */}
            <CollapsibleSection
              icon={<Hash className="h-4 w-4 text-blue-500" />}
              title="Modules"
              summary={`${panelCount}`}
              defaultOpen={false}
              isVisible={layerVisibility?.pvArrays}
              onToggleVisibility={onToggleLayerVisibility ? () => onToggleLayerVisibility('pvArrays') : undefined}
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
                          selectedItemIds?.has(arr.id)
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

            <CollapsibleSection
              icon={<Zap className="h-4 w-4 text-green-500" />}
              title="Inverters"
              summary={`${layoutInverterCount}`}
              defaultOpen={false}
              isVisible={layerVisibility?.equipment}
              onToggleVisibility={onToggleLayerVisibility ? () => onToggleLayerVisibility('equipment') : undefined}
            >
              {layoutInverterCount === 0 ? (
                <p className="text-xs text-muted-foreground">No inverters placed</p>
              ) : (
                <div className="space-y-1">
                  {equipment
                    .filter((e) => e.type === EquipmentType.INVERTER)
                    .map((inv, i) => (
                      <div
                        key={inv.id}
                        className={`w-full flex items-center justify-between p-2 rounded text-xs transition-colors ${
                          selectedItemIds?.has(inv.id)
                            ? 'bg-primary/10 border border-primary'
                            : 'bg-muted hover:bg-accent'
                        }`}
                      >
                        <button
                          type="button"
                          className="flex-1 text-left"
                          onClick={() => onSelectItem(inv.id)}
                        >
                          <span className="font-medium">Inverter {i + 1}</span>
                          {inv.name && (
                            <span className="text-muted-foreground ml-2">{inv.name}</span>
                          )}
                        </button>

                        {onDeleteItem && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              onDeleteItem(inv.id);
                            }}
                            title="Delete inverter"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </CollapsibleSection>

            <GroupedMaterialSection
              icon={<Footprints className="h-4 w-4 text-slate-500" />}
              title="Walkways"
              totalSummary={`${totalWalkwayLength.toFixed(0)} m`}
              groupedItems={groupedWalkways}
              itemType="walkway"
              onDeleteItem={onDeletePlacedItem}
              isVisible={layerVisibility?.walkways}
              onToggleVisibility={onToggleLayerVisibility ? () => onToggleLayerVisibility('walkways') : undefined}
              subgroupVisibility={walkwaySubgroupVisibility}
              onToggleSubgroupVisibility={onToggleWalkwaySubgroupVisibility}
              selectedItemIds={selectedItemIds}
              onSelectItem={onSelectItem}
              onShowLayer={onShowWalkwayLayer}
            />

            <GroupedMaterialSection
              icon={<Box className="h-4 w-4 text-orange-500" />}
              title="Cable Trays"
              totalSummary={`${totalCableTrayLength.toFixed(0)} m`}
              groupedItems={groupedCableTrays}
              itemType="cableTray"
              onDeleteItem={onDeletePlacedItem}
              isVisible={layerVisibility?.cableTrays}
              onToggleVisibility={onToggleLayerVisibility ? () => onToggleLayerVisibility('cableTrays') : undefined}
              subgroupVisibility={cableTraySubgroupVisibility}
              onToggleSubgroupVisibility={onToggleCableTraySubgroupVisibility}
              selectedItemIds={selectedItemIds}
              onSelectItem={onSelectItem}
              onShowLayer={onShowCableTrayLayer}
            />

            {/* Cabling - DC/AC cables */}
            <CollapsibleSection
              icon={<Cable className="h-4 w-4 text-orange-500" />}
              title="Cabling"
              summary={`${(dcCableLength + acCableLength).toFixed(0)} m`}
              defaultOpen={false}
              isVisible={layerVisibility?.cables}
              onToggleVisibility={onToggleLayerVisibility ? () => onToggleLayerVisibility('cables') : undefined}
            >
              <div className="space-y-1 text-xs">
                {/* DC Cables */}
                {lines.filter(l => l.type === 'dc').length > 0 && (
                  <div className="space-y-1">
                    <div className="text-muted-foreground text-[10px] font-medium px-2 pt-1 flex items-center gap-1">
                      <div className="w-2 h-0.5 bg-orange-500 rounded" />
                      DC Cables ({dcCableLength.toFixed(1)} m)
                    </div>
                    {lines.filter(l => l.type === 'dc').map((cable, i) => {
                      const isSelected = selectedItemId === cable.id || selectedItemIds?.has(cable.id);
                      const cableLength = calculateLineLength(cable.points, scaleInfo.ratio);
                      return (
                        <button
                          key={cable.id}
                          className={cn(
                            "flex justify-between items-center p-2 rounded w-full text-left transition-colors",
                            isSelected 
                              ? "bg-primary/20 border border-primary" 
                              : "bg-muted hover:bg-muted/80"
                          )}
                          onClick={() => onSelectItem(cable.id)}
                        >
                          <span className="flex items-center gap-1">
                            <div className="w-3 h-0.5 bg-orange-500 rounded" />
                            DC Cable {i + 1}
                          </span>
                          <span>{cableLength.toFixed(1)} m</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                
                {/* AC Cables */}
                {lines.filter(l => l.type === 'ac').length > 0 && (
                  <div className="space-y-1">
                    <div className="text-muted-foreground text-[10px] font-medium px-2 pt-1 flex items-center gap-1">
                      <div className="w-2 h-0.5 bg-blue-500 rounded" />
                      AC Cables ({acCableLength.toFixed(1)} m)
                    </div>
                    {lines.filter(l => l.type === 'ac').map((cable, i) => {
                      const isSelected = selectedItemId === cable.id || selectedItemIds?.has(cable.id);
                      const cableLength = calculateLineLength(cable.points, scaleInfo.ratio);
                      return (
                        <button
                          key={cable.id}
                          className={cn(
                            "flex justify-between items-center p-2 rounded w-full text-left transition-colors",
                            isSelected 
                              ? "bg-primary/20 border border-primary" 
                              : "bg-muted hover:bg-muted/80"
                          )}
                          onClick={() => onSelectItem(cable.id)}
                        >
                          <span className="flex items-center gap-1">
                            <div className="w-3 h-0.5 bg-blue-500 rounded" />
                            AC Cable {i + 1}
                          </span>
                          <span>{cableLength.toFixed(1)} m</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                
                {/* Empty state */}
                {lines.length === 0 && (
                  <div className="text-muted-foreground text-center py-2">
                    No cables placed
                  </div>
                )}
              </div>
            </CollapsibleSection>
          </div>
        </ScrollArea>
      </div>
    </TooltipProvider>
  );
}
