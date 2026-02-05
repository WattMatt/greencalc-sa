import { useState, useMemo } from 'react';
 import { Sun, Layers, Cable, Zap, Hash, ChevronLeft, ChevronRight, ChevronDown, Pencil, Trash2, Box, Footprints, Check, Eye, EyeOff, LayoutGrid, ListCollapse, Settings } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PVArrayItem, RoofMask, SupplyLine, EquipmentItem, PVPanelConfig, ScaleInfo, PlantSetupConfig, PlacedWalkway, PlacedCableTray, EquipmentType, LayerVisibility, ItemVisibility, Point } from '../types';
import { calculateTotalPVCapacity, calculatePolygonArea, calculateLineLength } from '../utils/geometry';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { getModulePresetById } from '@/components/projects/SolarModulePresets';

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
  onSelectMultiple?: (ids: string[]) => void;
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
  // Cable thickness visibility
  dcCableThicknessVisibility?: Record<number, boolean>;
  acCableThicknessVisibility?: Record<number, boolean>;
  onToggleDcCableThicknessVisibility?: (thickness: number) => void;
  onToggleAcCableThicknessVisibility?: (thickness: number) => void;
  // Force-show layer handlers for when selecting hidden items
  onShowWalkwayLayer?: () => void;
  onShowCableTrayLayer?: () => void;
  onShowCablesLayer?: () => void;
  // Per-item visibility
  itemVisibility?: ItemVisibility;
  onToggleItemVisibility?: (itemId: string) => void;
  onForceShowItem?: (itemId: string) => void;
}

// Reusable collapsible section component with visibility toggle
function CollapsibleSection({
  icon,
  title,
  summary,
  defaultOpen = false,
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
      <div className="flex items-center w-full">
        {/* Visibility toggle button - fixed left column */}
        {onToggleVisibility !== undefined && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
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
      <CollapsibleContent className="pt-2 pl-6">
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
  itemVisibility,
  onToggleItemVisibility,
  onForceShowItem,
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
  itemVisibility?: ItemVisibility;
  onToggleItemVisibility?: (itemId: string) => void;
  onForceShowItem?: (itemId: string) => void;
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

  // Handle item click - auto-show layer, subgroup, and item if hidden
  const handleItemClick = (item: T, groupKey: string) => {
    // Auto-show layer if hidden
    if (isVisible === false && onShowLayer) {
      onShowLayer();
    }
    // Auto-show subgroup if hidden
    if (subgroupVisibility?.[groupKey] === false && onToggleSubgroupVisibility) {
      onToggleSubgroupVisibility(groupKey);
    }
    // Auto-show item if hidden
    if (itemVisibility?.[item.id] === false && onForceShowItem) {
      onForceShowItem(item.id);
    }
    // Select the item
    onSelectItem?.(item.id);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex items-center w-full">
        {/* Visibility toggle button - fixed left column */}
        {onToggleVisibility !== undefined && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
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
      <CollapsibleContent className="pt-2 pl-6">
        {groupKeys.length === 0 ? (
          <p className="text-xs text-muted-foreground">No {title.toLowerCase()} placed</p>
        ) : (
          <div className="space-y-1">
            {groupKeys.map((key) => {
              const group = groupedItems[key];
              const isGroupOpen = openGroups.has(key);
              const isSubgroupVisible = subgroupVisibility?.[key] !== false;
              return (
                <Collapsible key={key} open={isGroupOpen} onOpenChange={() => toggleGroup(key)}>
                  <div className="flex items-center w-full">
                    {/* Subgroup visibility toggle - fixed left column */}
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
                        "flex items-center gap-2 flex-1 hover:bg-accent/50 rounded p-1 text-xs transition-colors pl-2",
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
                    {group.items.map((item, itemIndex) => {
                      const isSelected = selectedItemIds?.has(item.id) ?? false;
                      const isItemVisible = itemVisibility?.[item.id] !== false;
                      return (
                        <div 
                          key={item.id} 
                          className={cn(
                            "flex items-center gap-1 p-1.5 rounded text-xs transition-colors",
                            isSelected 
                              ? "bg-primary/10 border border-primary" 
                              : "bg-muted hover:bg-accent",
                            !isItemVisible && "opacity-50"
                          )}
                        >
                          {/* Per-item visibility toggle - fixed left column */}
                          {onToggleItemVisibility && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 shrink-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleItemVisibility(item.id);
                                  }}
                                >
                                  {isItemVisible ? (
                                    <Eye className="h-3 w-3 text-muted-foreground" />
                                  ) : (
                                    <EyeOff className="h-3 w-3 text-muted-foreground/50" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="left">
                                {isItemVisible ? 'Hide' : 'Show'}
                              </TooltipContent>
                            </Tooltip>
                          )}
                          <button
                            type="button"
                            className={cn(
                              "flex-1 text-left pl-2",
                              isSelected && "font-medium"
                            )}
                            onClick={() => handleItemClick(item, key)}
                          >
                            <span className="text-muted-foreground">
                              {itemType === 'walkway' ? 'Walkway' : 'Tray'} {itemIndex + 1}: {Math.min(item.width, item.length).toFixed(2)}m × {Math.max(item.width, item.length).toFixed(1)}m
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

// Helper to find DC cables connected to a specific inverter
const getCablesConnectedToInverter = (
  inverterId: string,
  inverterPosition: Point,
  dcCables: SupplyLine[],
  scaleInfo: ScaleInfo
): SupplyLine[] => {
  if (!scaleInfo.ratio) return [];
  
  // Threshold: ~1 meter in world coords (for snapping tolerance)
  const thresholdMeters = 1.0;
  const thresholdPx = thresholdMeters / scaleInfo.ratio;
  
  return dcCables.filter(cable => {
    if (cable.points.length === 0) return false;
    
    // Check first and last points of cable
    const startDist = Math.hypot(
      cable.points[0].x - inverterPosition.x,
      cable.points[0].y - inverterPosition.y
    );
    const endDist = Math.hypot(
      cable.points[cable.points.length - 1].x - inverterPosition.x,
      cable.points[cable.points.length - 1].y - inverterPosition.y
    );
    
    return startDist < thresholdPx || endDist < thresholdPx;
  });
};

// Helper to find inverters connected to a main board via AC cables
const getInvertersConnectedToMainBoard = (
  mainBoardId: string,
  mainBoardPosition: Point,
  inverters: EquipmentItem[],
  acCables: SupplyLine[],
  scaleInfo: ScaleInfo
): EquipmentItem[] => {
  if (!scaleInfo.ratio) return [];
  const thresholdPx = 1.0 / scaleInfo.ratio;
  
  // Find AC cables connected to this main board
  const mbConnectedCables = acCables.filter(cable => {
    if (cable.points.length === 0) return false;
    const startDist = Math.hypot(cable.points[0].x - mainBoardPosition.x, cable.points[0].y - mainBoardPosition.y);
    const endDist = Math.hypot(cable.points[cable.points.length - 1].x - mainBoardPosition.x, cable.points[cable.points.length - 1].y - mainBoardPosition.y);
    return startDist < thresholdPx || endDist < thresholdPx;
  });
  
  // Find inverters at the other end of these cables
  return inverters.filter(inv => {
    return mbConnectedCables.some(cable => {
      if (cable.points.length === 0) return false;
      const startDist = Math.hypot(cable.points[0].x - inv.position.x, cable.points[0].y - inv.position.y);
      const endDist = Math.hypot(cable.points[cable.points.length - 1].x - inv.position.x, cable.points[cable.points.length - 1].y - inv.position.y);
      return startDist < thresholdPx || endDist < thresholdPx;
    });
  });
};

// Helper to find the PV array connected to a DC cable
const getPVArrayForString = (
  cable: SupplyLine,
  inverterPosition: Point,
  pvArrays: PVArrayItem[],
  pvPanelConfig: PVPanelConfig | null,
  scaleInfo: ScaleInfo
): PVArrayItem | null => {
  if (!scaleInfo.ratio || !pvPanelConfig || cable.points.length === 0) return null;
  
  const thresholdMeters = 1.0;
  const thresholdPx = thresholdMeters / scaleInfo.ratio;
  
  // Determine which end is NOT near the inverter (that's the PV array end)
  const startDist = Math.hypot(
    cable.points[0].x - inverterPosition.x,
    cable.points[0].y - inverterPosition.y
  );
  const pvEndPoint = startDist > thresholdPx 
    ? cable.points[0] 
    : cable.points[cable.points.length - 1];
  
  // Find nearest PV array to this endpoint
  for (const arr of pvArrays) {
    const distToArray = Math.hypot(
      pvEndPoint.x - arr.position.x,
      pvEndPoint.y - arr.position.y
    );
    
    // Account for array size - threshold based on array dimensions
    const panelW = arr.orientation === 'portrait' 
      ? pvPanelConfig.width : pvPanelConfig.length;
    const panelL = arr.orientation === 'portrait' 
      ? pvPanelConfig.length : pvPanelConfig.width;
    const arrayRadius = Math.hypot(
      (arr.columns * panelW) / 2,
      (arr.rows * panelL) / 2
    ) / scaleInfo.ratio;
    
    if (distToArray < (arrayRadius + thresholdPx)) {
      return arr;
    }
  }
  
  return null;
};

// Get AC capacity from inverter config
const getInverterAcCapacity = (
  inv: EquipmentItem,
  plantSetupConfig?: PlantSetupConfig
): number => {
  if (!plantSetupConfig || !inv.configId) return 0;
  const config = plantSetupConfig.inverters.find(i => i.id === inv.configId);
  return config?.acCapacity || 0; // kW
};

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
  onSelectMultiple,
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
  dcCableThicknessVisibility,
  acCableThicknessVisibility,
  onToggleDcCableThicknessVisibility,
  onToggleAcCableThicknessVisibility,
  onShowWalkwayLayer,
  onShowCableTrayLayer,
  onShowCablesLayer,
  itemVisibility,
  onToggleItemVisibility,
  onForceShowItem,
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
  
  // Simulation comparison values - NO FALLBACKS, direct read only
  const simModuleCount = assignedSimulation?.results_json?.moduleCount ?? null;
  const simInverterCount = assignedSimulation?.results_json?.inverterCount ?? null;
  
  // Layout inverter count (placed on canvas) - use enum for reliable matching
  const layoutInverterCount = equipment.filter(e => e.type === EquipmentType.INVERTER).length;
  
  // Check if layout matches simulation (use panelCount = all placed modules)
  const modulesMatch = simModuleCount === null || simModuleCount === panelCount;
  const invertersMatch = simInverterCount === null || simInverterCount === layoutInverterCount;
   
   // State for collapsible "Summary Contents" section
   const [summaryContentOpen, setSummaryContentOpen] = useState(true);
   const [systemDetailsOpen, setSystemDetailsOpen] = useState(false);

   // Accordion behavior: when one opens, close the other
   const handleSummaryContentChange = (open: boolean) => {
     setSummaryContentOpen(open);
     if (open) setSystemDetailsOpen(false);
   };

   const handleSystemDetailsChange = (open: boolean) => {
     setSystemDetailsOpen(open);
     if (open) setSummaryContentOpen(false);
   };
   
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
        </div>

         
          {/* Summary Contents collapsible - wraps all content */}
           <Collapsible
             open={summaryContentOpen}
             onOpenChange={handleSummaryContentChange}
             className={cn(
               "flex flex-col",
               summaryContentOpen && "flex-1 min-h-0",
             )}
           >
           <div className="px-3 py-2 border-b">
             <CollapsibleTrigger asChild>
               <button className="flex items-center gap-2 w-full p-2 hover:bg-accent/50 rounded transition-colors">
                 <ChevronDown className={cn(
                   "h-4 w-4 text-muted-foreground transition-transform",
                   !summaryContentOpen && "-rotate-90"
                 )} />
                 <ListCollapse className="h-4 w-4 text-muted-foreground" />
                 <span className="text-sm font-medium">Summary Contents</span>
               </button>
             </CollapsibleTrigger>
           </div>
           
            <CollapsibleContent className="flex-1 min-h-0">
              <ScrollArea className="h-full">
               <div className="p-3 space-y-3">
                 {/* Simulation Selector */}
                 {simulationSelector && (
                   <div className="pb-2">
                     {simulationSelector}
                   </div>
                 )}
                 
            {/* Static Metrics Grid - 2x2 */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              {/* Modules - Top Left */}
              <Card className={cn(
                simModuleCount !== null && panelCount > simModuleCount && "border-green-500",
                simModuleCount !== null && panelCount < simModuleCount && "border-destructive"
              )}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4 text-blue-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Modules</p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className={cn(
                            "font-semibold text-sm",
                            simModuleCount !== null && panelCount > simModuleCount && "text-green-600",
                            simModuleCount !== null && panelCount < simModuleCount && "text-destructive"
                          )}>
                            {panelCount}{simModuleCount !== null && ` / ${simModuleCount}`}
                          </p>
                        </TooltipTrigger>
                        <TooltipContent>
                          {simModuleCount === null 
                            ? "Total modules placed on layout"
                            : modulesMatch 
                              ? "Matches simulation target" 
                              : panelCount > simModuleCount
                                ? `${panelCount - simModuleCount} more than required`
                                : `${simModuleCount - panelCount} fewer than required`}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Inverters - Top Right */}
              <Card className={cn(!invertersMatch && simInverterCount !== null && "border-amber-500")}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-green-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Inverters</p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className={cn(
                            "font-semibold text-sm",
                            simInverterCount !== null && (invertersMatch ? "text-green-600" : "text-amber-600")
                          )}>
                            {layoutInverterCount}{simInverterCount !== null && ` / ${simInverterCount}`}
                          </p>
                        </TooltipTrigger>
                        <TooltipContent>
                          {simInverterCount === null 
                            ? "No simulation linked"
                            : invertersMatch 
                              ? "Matches simulation target" 
                              : `${layoutInverterCount} placed, ${simInverterCount} required`}
                        </TooltipContent>
                      </Tooltip>
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
                  {roofMasks.map((mask, i) => {
                    const isItemVisible = itemVisibility?.[mask.id] !== false;
                    const handleClick = () => {
                      if (!isItemVisible && onForceShowItem) onForceShowItem(mask.id);
                      onSelectItem(mask.id);
                    };
                    return (
                      <div
                        key={mask.id}
                        className={cn(
                          "w-full flex items-center gap-1 p-2 rounded text-xs transition-colors",
                          selectedItemIds?.has(mask.id)
                            ? 'bg-primary/10 border border-primary' 
                            : 'bg-muted hover:bg-accent',
                          !isItemVisible && 'opacity-50'
                        )}
                      >
{/* Per-item visibility toggle - fixed left column */}
                        {onToggleItemVisibility && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleItemVisibility(mask.id);
                                }}
                              >
                                {isItemVisible ? (
                                  <Eye className="h-3 w-3 text-muted-foreground" />
                                ) : (
                                  <EyeOff className="h-3 w-3 text-muted-foreground/50" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left">
                              {isItemVisible ? 'Hide' : 'Show'}
                            </TooltipContent>
                          </Tooltip>
                        )}
                        <button
                          className="flex-1 text-left pl-2"
                          onClick={handleClick}
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
                    );
                  })}
                </div>
              )}
            </CollapsibleSection>

            {/* Main Boards */}
            <CollapsibleSection
              icon={<LayoutGrid className="h-4 w-4 text-purple-500" />}
              title="Main Boards"
              summary={`${equipment.filter(e => e.type === EquipmentType.MAIN_BOARD).length}`}
              defaultOpen={false}
              isVisible={layerVisibility?.mainBoards}
              onToggleVisibility={onToggleLayerVisibility ? () => onToggleLayerVisibility('mainBoards') : undefined}
            >
              {equipment.filter(e => e.type === EquipmentType.MAIN_BOARD).length === 0 ? (
                <p className="text-xs text-muted-foreground">No main boards placed</p>
              ) : (
                <div className="space-y-1">
                  {equipment
                    .filter((e) => e.type === EquipmentType.MAIN_BOARD)
                    .map((board, i) => {
                      const isItemVisible = itemVisibility?.[board.id] !== false;
                      const handleClick = () => {
                        if (!isItemVisible && onForceShowItem) onForceShowItem(board.id);
                        onSelectItem(board.id);
                      };
                      return (
                        <div
                          key={board.id}
                          className={cn(
                            "w-full flex items-center gap-1 p-2 rounded text-xs transition-colors",
                            selectedItemIds?.has(board.id)
                              ? 'bg-primary/10 border border-primary'
                              : 'bg-muted hover:bg-accent',
                            !isItemVisible && 'opacity-50'
                          )}
                        >
{/* Per-item visibility toggle - fixed left column */}
                          {onToggleItemVisibility && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 shrink-0"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onToggleItemVisibility(board.id);
                                  }}
                                >
                                  {isItemVisible ? (
                                    <Eye className="h-3 w-3 text-muted-foreground" />
                                  ) : (
                                    <EyeOff className="h-3 w-3 text-muted-foreground/50" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="left">
                                {isItemVisible ? 'Hide' : 'Show'}
                              </TooltipContent>
                            </Tooltip>
                          )}
                          <button
                            type="button"
                            className="flex-1 text-left pl-2"
                            onClick={handleClick}
                          >
                            <span className="font-medium">Main Board {i + 1}</span>
                            {board.name && (
                              <span className="text-muted-foreground ml-2">{board.name}</span>
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
                                onDeleteItem(board.id);
                              }}
                              title="Delete main board"
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
                    const isItemVisible = itemVisibility?.[arr.id] !== false;
                    const handleClick = () => {
                      if (!isItemVisible && onForceShowItem) onForceShowItem(arr.id);
                      onSelectItem(arr.id);
                    };
                    return (
                      <div
                        key={arr.id}
                        className={cn(
                          "w-full flex items-center gap-1 p-2 rounded text-xs transition-colors",
                          selectedItemIds?.has(arr.id)
                            ? 'bg-primary/10 border border-primary' 
                            : 'bg-muted hover:bg-accent',
                          !isItemVisible && 'opacity-50'
                        )}
                      >
{/* Per-item visibility toggle - fixed left column */}
                        {onToggleItemVisibility && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleItemVisibility(arr.id);
                                }}
                              >
                                {isItemVisible ? (
                                  <Eye className="h-3 w-3 text-muted-foreground" />
                                ) : (
                                  <EyeOff className="h-3 w-3 text-muted-foreground/50" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left">
                              {isItemVisible ? 'Hide' : 'Show'}
                            </TooltipContent>
                          </Tooltip>
                        )}
                        <button
                          className="flex-1 text-left pl-2"
                          onClick={handleClick}
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
              isVisible={layerVisibility?.inverters}
              onToggleVisibility={onToggleLayerVisibility ? () => onToggleLayerVisibility('inverters') : undefined}
            >
              {layoutInverterCount === 0 ? (
                <p className="text-xs text-muted-foreground">No inverters placed</p>
              ) : (
                <div className="space-y-1">
                  {equipment
                    .filter((e) => e.type === EquipmentType.INVERTER)
                    .map((inv, i) => {
                      const isItemVisible = itemVisibility?.[inv.id] !== false;
                      const handleClick = () => {
                        if (!isItemVisible && onForceShowItem) onForceShowItem(inv.id);
                        onSelectItem(inv.id);
                      };
                      return (
                        <div
                          key={inv.id}
                          className={cn(
                            "w-full flex items-center gap-1 p-2 rounded text-xs transition-colors",
                            selectedItemIds?.has(inv.id)
                              ? 'bg-primary/10 border border-primary'
                              : 'bg-muted hover:bg-accent',
                            !isItemVisible && 'opacity-50'
                          )}
                        >
{/* Per-item visibility toggle - fixed left column */}
                          {onToggleItemVisibility && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 shrink-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleItemVisibility(inv.id);
                                  }}
                                >
                                  {isItemVisible ? (
                                    <Eye className="h-3 w-3 text-muted-foreground" />
                                  ) : (
                                    <EyeOff className="h-3 w-3 text-muted-foreground/50" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="left">
                                {isItemVisible ? 'Hide' : 'Show'}
                              </TooltipContent>
                            </Tooltip>
                          )}
                          <button
                            type="button"
                            className="flex-1 text-left pl-2"
                            onClick={handleClick}
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
                      );
                    })}
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
              itemVisibility={itemVisibility}
              onToggleItemVisibility={onToggleItemVisibility}
              onForceShowItem={onForceShowItem}
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
              itemVisibility={itemVisibility}
              onToggleItemVisibility={onToggleItemVisibility}
              onForceShowItem={onForceShowItem}
            />

            {/* Cabling - DC/AC cables grouped by thickness */}
            <CollapsibleSection
              icon={<Cable className="h-4 w-4 text-orange-500" />}
              title="Cabling"
              summary={`${(dcCableLength + acCableLength).toFixed(0)} m`}
              defaultOpen={false}
              isVisible={layerVisibility?.cables}
              onToggleVisibility={onToggleLayerVisibility ? () => onToggleLayerVisibility('cables') : undefined}
            >
              <div className="space-y-2 text-xs">
                {/* DC Cables grouped by thickness */}
                {(() => {
                  const dcCables = lines.filter(l => l.type === 'dc');
                  if (dcCables.length === 0) return null;
                  
                  // Group by thickness
                  const dcByThickness = dcCables.reduce((acc, cable) => {
                    const thickness = cable.thickness || 6; // Default 6mm
                    if (!acc[thickness]) acc[thickness] = [];
                    acc[thickness].push(cable);
                    return acc;
                  }, {} as Record<number, typeof dcCables>);
                  
                  const thicknesses = Object.keys(dcByThickness).map(Number).sort((a, b) => a - b);
                  
                  return (
                    <Collapsible defaultOpen={false}>
                      <div className="flex items-center gap-1">
                        {/* Visibility toggle for all DC cables */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                // Toggle all DC thicknesses
                                thicknesses.forEach(t => {
                                  onToggleDcCableThicknessVisibility?.(t);
                                });
                              }}
                            >
                              {thicknesses.every(t => dcCableThicknessVisibility?.[t] !== false) ? (
                                <Eye className="h-3 w-3" />
                              ) : (
                                <EyeOff className="h-3 w-3 text-muted-foreground" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Toggle all DC cables visibility</TooltipContent>
                        </Tooltip>
                        
                        <CollapsibleTrigger asChild>
                          <button className="flex-1 flex items-center gap-1 text-left text-muted-foreground text-[10px] font-medium py-1 hover:text-foreground">
                            <div className="w-2 h-0.5 bg-orange-500 rounded" />
                            DC Cables ({dcCableLength.toFixed(1)} m)
                            <ChevronDown className="h-3 w-3 ml-auto transition-transform" />
                          </button>
                        </CollapsibleTrigger>
                      </div>
                      <CollapsibleContent className="space-y-1 pt-1">
                        {thicknesses.map(thickness => {
                          const cablesInGroup = dcByThickness[thickness];
                          const groupLength = cablesInGroup.reduce((sum, c) => 
                            sum + calculateLineLength(c.points, scaleInfo.ratio), 0);
                          const isThicknessVisible = dcCableThicknessVisibility?.[thickness] !== false;
                          
                          return (
                            <Collapsible key={thickness} defaultOpen={false}>
                              <div className="flex items-center w-full">
                                {/* Visibility toggle for this thickness - fixed left column */}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5 shrink-0"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onToggleDcCableThicknessVisibility?.(thickness);
                                      }}
                                    >
                                      {isThicknessVisible ? (
                                        <Eye className="h-3 w-3" />
                                      ) : (
                                        <EyeOff className="h-3 w-3 text-muted-foreground" />
                                      )}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Toggle {thickness}mm DC cables visibility</TooltipContent>
                                </Tooltip>
                                
                                <CollapsibleTrigger asChild>
                                  <button className={cn(
                                    "flex-1 flex items-center gap-1 text-left py-1 hover:text-foreground pl-2",
                                    !isThicknessVisible && "opacity-50"
                                  )}>
                                    <div 
                                      className="rounded bg-orange-500" 
                                      style={{ width: `${Math.max(2, thickness / 4)}px`, height: `${Math.max(2, thickness / 4)}px` }} 
                                    />
                                    <span>{thickness}mm</span>
                                    <span className="text-muted-foreground ml-auto">
                                      {groupLength.toFixed(1)}m ({cablesInGroup.length})
                                    </span>
                                    <ChevronDown className="h-3 w-3 transition-transform shrink-0" />
                                  </button>
                                </CollapsibleTrigger>
                              </div>
                              <CollapsibleContent className="space-y-1 pt-1 pl-6">
                                {cablesInGroup.map((cable, i) => {
                                  const isSelected = selectedItemId === cable.id || selectedItemIds?.has(cable.id);
                                  const cableLength = calculateLineLength(cable.points, scaleInfo.ratio);
                                  const isCableVisible = itemVisibility?.[cable.id] !== false;
                                  const handleClick = () => {
                                    // If hidden, show the layer first
                                    if (!isThicknessVisible) {
                                      onToggleDcCableThicknessVisibility?.(thickness);
                                    }
                                    if (!layerVisibility?.cables) {
                                      onShowCablesLayer?.();
                                    }
                                    // Force-show item if hidden
                                    if (!isCableVisible && onForceShowItem) {
                                      onForceShowItem(cable.id);
                                    }
                                    onSelectItem(cable.id);
                                  };
                                  return (
                                    <div
                                      key={cable.id}
                                      className={cn(
                                        "flex items-center gap-1 p-2 rounded w-full text-left transition-colors",
                                        isSelected 
                                          ? "bg-primary/20 border border-primary" 
                                          : "bg-muted hover:bg-muted/80",
                                        (!isThicknessVisible || !isCableVisible) && "opacity-50"
                                      )}
                                    >
{/* Per-item visibility toggle - fixed left column */}
                                      {onToggleItemVisibility && (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-5 w-5 shrink-0"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                onToggleItemVisibility(cable.id);
                                              }}
                                            >
                                              {isCableVisible ? (
                                                <Eye className="h-3 w-3 text-muted-foreground" />
                                              ) : (
                                                <EyeOff className="h-3 w-3 text-muted-foreground/50" />
                                              )}
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent side="left">
                                            {isCableVisible ? 'Hide' : 'Show'}
                                          </TooltipContent>
                                        </Tooltip>
                                      )}
                                      <button
                                        className="flex-1 flex justify-between items-center pl-2"
                                        onClick={handleClick}
                                      >
                                        <span className="flex items-center gap-1">
                                          <div 
                                            className="rounded bg-orange-500" 
                                            style={{ width: `${Math.max(3, thickness / 3)}px`, height: '2px' }} 
                                          />
                                          DC Cable {i + 1}
                                        </span>
                                        <span>{cableLength.toFixed(1)} m</span>
                                      </button>
                                      {onDeleteItem && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            onDeleteItem(cable.id);
                                          }}
                                          title="Delete DC cable"
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
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })()}
                
                {/* AC Cables grouped by thickness */}
                {(() => {
                  const acCables = lines.filter(l => l.type === 'ac');
                  if (acCables.length === 0) return null;
                  
                  // Group by thickness
                  const acByThickness = acCables.reduce((acc, cable) => {
                    const thickness = cable.thickness || 6;
                    if (!acc[thickness]) acc[thickness] = [];
                    acc[thickness].push(cable);
                    return acc;
                  }, {} as Record<number, typeof acCables>);
                  
                  const thicknesses = Object.keys(acByThickness).map(Number).sort((a, b) => a - b);
                  
                  return (
                    <Collapsible defaultOpen={false}>
                      <div className="flex items-center gap-1">
                        {/* Visibility toggle for all AC cables */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                thicknesses.forEach(t => {
                                  onToggleAcCableThicknessVisibility?.(t);
                                });
                              }}
                            >
                              {thicknesses.every(t => acCableThicknessVisibility?.[t] !== false) ? (
                                <Eye className="h-3 w-3" />
                              ) : (
                                <EyeOff className="h-3 w-3 text-muted-foreground" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Toggle all AC cables visibility</TooltipContent>
                        </Tooltip>
                        
                        <CollapsibleTrigger asChild>
                          <button className="flex-1 flex items-center gap-1 text-left text-muted-foreground text-[10px] font-medium py-1 hover:text-foreground">
                            <div className="w-2 h-0.5 bg-blue-500 rounded" />
                            AC Cables ({acCableLength.toFixed(1)} m)
                            <ChevronDown className="h-3 w-3 ml-auto transition-transform" />
                          </button>
                        </CollapsibleTrigger>
                      </div>
                      <CollapsibleContent className="space-y-1 pt-1">
                        {thicknesses.map(thickness => {
                          const cablesInGroup = acByThickness[thickness];
                          const groupLength = cablesInGroup.reduce((sum, c) => 
                            sum + calculateLineLength(c.points, scaleInfo.ratio), 0);
                          const isThicknessVisible = acCableThicknessVisibility?.[thickness] !== false;
                          
                          return (
                            <Collapsible key={thickness} defaultOpen={false}>
                              <div className="flex items-center w-full">
                                {/* Visibility toggle for this thickness - fixed left column */}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5 shrink-0"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onToggleAcCableThicknessVisibility?.(thickness);
                                      }}
                                    >
                                      {isThicknessVisible ? (
                                        <Eye className="h-3 w-3" />
                                      ) : (
                                        <EyeOff className="h-3 w-3 text-muted-foreground" />
                                      )}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Toggle {thickness}mm AC cables visibility</TooltipContent>
                                </Tooltip>
                                
                                <CollapsibleTrigger asChild>
                                  <button className={cn(
                                    "flex-1 flex items-center gap-1 text-left py-1 hover:text-foreground pl-2",
                                    !isThicknessVisible && "opacity-50"
                                  )}>
                                    <div 
                                      className="rounded bg-blue-500" 
                                      style={{ width: `${Math.max(2, thickness / 4)}px`, height: `${Math.max(2, thickness / 4)}px` }} 
                                    />
                                    <span>{thickness}mm</span>
                                    <span className="text-muted-foreground ml-auto">
                                      {groupLength.toFixed(1)}m ({cablesInGroup.length})
                                    </span>
                                    <ChevronDown className="h-3 w-3 transition-transform shrink-0" />
                                  </button>
                                </CollapsibleTrigger>
                              </div>
                              <CollapsibleContent className="space-y-1 pt-1 pl-6">
                                {cablesInGroup.map((cable, i) => {
                                  const isSelected = selectedItemId === cable.id || selectedItemIds?.has(cable.id);
                                  const cableLength = calculateLineLength(cable.points, scaleInfo.ratio);
                                  const isCableVisible = itemVisibility?.[cable.id] !== false;
                                  const handleClick = () => {
                                    if (!isThicknessVisible) {
                                      onToggleAcCableThicknessVisibility?.(thickness);
                                    }
                                    if (!layerVisibility?.cables) {
                                      onShowCablesLayer?.();
                                    }
                                    // Force-show item if hidden
                                    if (!isCableVisible && onForceShowItem) {
                                      onForceShowItem(cable.id);
                                    }
                                    onSelectItem(cable.id);
                                  };
                                  return (
                                    <div
                                      key={cable.id}
                                      className={cn(
                                        "flex items-center gap-1 p-2 rounded w-full text-left transition-colors",
                                        isSelected 
                                          ? "bg-primary/20 border border-primary" 
                                          : "bg-muted hover:bg-muted/80",
                                        (!isThicknessVisible || !isCableVisible) && "opacity-50"
                                      )}
                                    >
{/* Per-item visibility toggle - fixed left column */}
                                      {onToggleItemVisibility && (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-5 w-5 shrink-0"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                onToggleItemVisibility(cable.id);
                                              }}
                                            >
                                              {isCableVisible ? (
                                                <Eye className="h-3 w-3 text-muted-foreground" />
                                              ) : (
                                                <EyeOff className="h-3 w-3 text-muted-foreground/50" />
                                              )}
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent side="left">
                                            {isCableVisible ? 'Hide' : 'Show'}
                                          </TooltipContent>
                                        </Tooltip>
                                      )}
                                      <button
                                        className="flex-1 flex justify-between items-center pl-2"
                                        onClick={handleClick}
                                      >
                                        <span className="flex items-center gap-1">
                                          <div 
                                            className="rounded bg-blue-500" 
                                            style={{ width: `${Math.max(3, thickness / 3)}px`, height: '2px' }} 
                                          />
                                          AC Cable {i + 1}
                                        </span>
                                        <span>{cableLength.toFixed(1)} m</span>
                                      </button>
                                      {onDeleteItem && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            onDeleteItem(cable.id);
                                          }}
                                          title="Delete AC cable"
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
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })()}
                
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
           </CollapsibleContent>
         </Collapsible>

          {/* System Details collapsible - individual inverters */}
          <Collapsible
            open={systemDetailsOpen}
            onOpenChange={handleSystemDetailsChange}
            className={cn(
              "flex flex-col border-t",
              systemDetailsOpen && "flex-1 min-h-0",
            )}
          >
            <div className="px-3 py-2 border-b">
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-2 w-full p-2 hover:bg-accent/50 rounded transition-colors">
                  <ChevronDown className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform",
                    !systemDetailsOpen && "-rotate-90"
                  )} />
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">System Details</span>
                </button>
              </CollapsibleTrigger>
            </div>
            
            <CollapsibleContent className="flex-1 min-h-0">
              <ScrollArea className="h-full">
                <div className="p-3 space-y-2">
                  {(() => {
                    const inverters = equipment.filter(e => e.type === EquipmentType.INVERTER);
                    const mainBoards = equipment.filter(e => e.type === EquipmentType.MAIN_BOARD);
                    const acCables = lines.filter(l => l.type === 'ac');
                    const dcCables = lines.filter(l => l.type === 'dc');
                    
                    // Find which inverters are connected to which main boards
                    const assignedInverterIds = new Set<string>();
                    const mainBoardData = mainBoards.map(mb => {
                      const connectedInverters = getInvertersConnectedToMainBoard(
                        mb.id, mb.position, inverters, acCables, scaleInfo
                      );
                      connectedInverters.forEach(inv => assignedInverterIds.add(inv.id));
                      return { mainBoard: mb, inverters: connectedInverters };
                    });
                    
                    // Find unassigned inverters
                    const unassignedInverters = inverters.filter(inv => !assignedInverterIds.has(inv.id));
                    
                    // Render inverter content helper
                    const renderInverterContent = (inv: EquipmentItem, invIndex: number) => {
                      const isItemVisible = itemVisibility?.[inv.id] !== false;
                      
                      const connectedCables = getCablesConnectedToInverter(
                        inv.id, inv.position, dcCables, scaleInfo
                      );
                      
                      let totalPanels = 0;
                      let totalDcCapacityKw = 0;
                      const stringData: Array<{
                        cable: SupplyLine;
                        panelCount: number;
                        powerKwp: number;
                        pvArrayId: string | null;
                      }> = [];
                      
                      connectedCables.forEach(cable => {
                        const pvArray = getPVArrayForString(
                          cable, inv.position, pvArrays, pvPanelConfig, scaleInfo
                        );
                        if (pvArray && pvPanelConfig) {
                          const panels = pvArray.rows * pvArray.columns;
                          const powerKwp = (panels * pvPanelConfig.wattage) / 1000;
                          totalPanels += panels;
                          totalDcCapacityKw += powerKwp;
                          stringData.push({ cable, panelCount: panels, powerKwp, pvArrayId: pvArray.id });
                        } else {
                          stringData.push({ cable, panelCount: 0, powerKwp: 0, pvArrayId: null });
                        }
                      });
                      
                      const acCapacityKw = getInverterAcCapacity(inv, plantSetupConfig);
                      const dcAcRatio = acCapacityKw > 0 
                        ? (totalDcCapacityKw / acCapacityKw).toFixed(2) 
                        : '0.00';
                      
                      const handleInverterClick = () => {
                        if (!isItemVisible && onForceShowItem) onForceShowItem(inv.id);
                        onSelectItem(inv.id);
                      };
                      
                      return (
                        <Collapsible key={inv.id} defaultOpen={false}>
                          <div className={cn(
                            "flex flex-col p-2 rounded text-xs transition-colors",
                            selectedItemIds?.has(inv.id)
                              ? 'bg-primary/10 border border-primary'
                              : 'bg-muted hover:bg-accent',
                            !isItemVisible && 'opacity-50'
                          )}>
                            <div className="flex items-center gap-1">
                              {onToggleItemVisibility && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5 shrink-0"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onToggleItemVisibility(inv.id);
                                      }}
                                    >
                                      {isItemVisible ? (
                                        <Eye className="h-3 w-3 text-muted-foreground" />
                                      ) : (
                                        <EyeOff className="h-3 w-3 text-muted-foreground/50" />
                                      )}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="left">
                                    {isItemVisible ? 'Hide' : 'Show'}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              
                              <CollapsibleTrigger asChild>
                                <button 
                                  className="flex-1 flex items-center gap-2 text-left" 
                                  onClick={handleInverterClick}
                                >
                                  <ChevronDown className="h-3 w-3 text-muted-foreground transition-transform [&[data-state=open]>svg]:rotate-180" />
                                  <span className="font-medium">Inverter {invIndex + 1}</span>
                                  {inv.name && <span className="text-muted-foreground">{inv.name}</span>}
                                </button>
                              </CollapsibleTrigger>
                            </div>
                            
                            <div className="flex items-center gap-2 pl-7 pt-1 text-muted-foreground text-[10px]">
                              <span>{totalPanels} panels</span>
                              <span>|</span>
                              <span>DC/AC: {dcAcRatio}</span>
                            </div>
                          </div>
                          
                          <CollapsibleContent className="pl-8 pt-1 space-y-1">
                            {stringData.length === 0 ? (
                              <p className="text-xs text-muted-foreground py-1">No strings connected</p>
                            ) : (
                              stringData.map((data, strIdx) => {
                                const isStringSelected = selectedItemId === data.cable.id || selectedItemIds?.has(data.cable.id) ||
                                  (data.pvArrayId && (selectedItemId === data.pvArrayId || selectedItemIds?.has(data.pvArrayId)));
                                
                                const handleStringClick = () => {
                                  // Select both the cable and the PV array
                                  const idsToSelect: string[] = [data.cable.id];
                                  if (data.pvArrayId) {
                                    idsToSelect.push(data.pvArrayId);
                                  }
                                  if (onSelectMultiple && idsToSelect.length > 1) {
                                    onSelectMultiple(idsToSelect);
                                  } else {
                                    onSelectItem(data.cable.id);
                                  }
                                };
                                
                                return (
                                  <button
                                    key={data.cable.id}
                                    className={cn(
                                      "flex items-center gap-2 text-xs py-1 px-2 w-full rounded hover:bg-accent transition-colors text-left",
                                      isStringSelected && "bg-primary/10 border border-primary"
                                    )}
                                    onClick={handleStringClick}
                                  >
                                    <div className="w-2 h-0.5 bg-orange-500 rounded" />
                                    <span>String {strIdx + 1}</span>
                                    <span className="text-muted-foreground">-</span>
                                    <span>{data.panelCount}p</span>
                                    <span className="text-muted-foreground ml-auto">{data.powerKwp.toFixed(1)} kWp</span>
                                  </button>
                                );
                              })
                            )}
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    };
                    
                    if (mainBoards.length === 0 && inverters.length === 0) {
                      return <p className="text-xs text-muted-foreground">No equipment placed</p>;
                    }
                    
                    return (
                      <>
                        {/* Main Boards with nested inverters */}
                        {mainBoardData.map((mbData, mbIdx) => {
                          const isMbVisible = itemVisibility?.[mbData.mainBoard.id] !== false;
                          const isMbSelected = selectedItemIds?.has(mbData.mainBoard.id);
                          
                          return (
                            <Collapsible key={mbData.mainBoard.id} defaultOpen={false}>
                              <div className={cn(
                                "flex flex-col p-2 rounded text-xs transition-colors",
                                isMbSelected
                                  ? 'bg-primary/10 border border-primary'
                                  : 'bg-muted/50 hover:bg-accent',
                                !isMbVisible && 'opacity-50'
                              )}>
                                <div className="flex items-center gap-1">
                                  {onToggleItemVisibility && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-5 w-5 shrink-0"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onToggleItemVisibility(mbData.mainBoard.id);
                                          }}
                                        >
                                          {isMbVisible ? (
                                            <Eye className="h-3 w-3 text-muted-foreground" />
                                          ) : (
                                            <EyeOff className="h-3 w-3 text-muted-foreground/50" />
                                          )}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent side="left">
                                        {isMbVisible ? 'Hide' : 'Show'}
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                  
                                  <CollapsibleTrigger asChild>
                                    <button 
                                      className="flex-1 flex items-center gap-2 text-left"
                                      onClick={() => {
                                        if (!isMbVisible && onForceShowItem) onForceShowItem(mbData.mainBoard.id);
                                        onSelectItem(mbData.mainBoard.id);
                                      }}
                                    >
                                      <ChevronDown className="h-3 w-3 text-muted-foreground transition-transform [&[data-state=open]>svg]:rotate-180" />
                                      <Box className="h-3.5 w-3.5 text-blue-500" />
                                      <span className="font-medium">Main Board {mbIdx + 1}</span>
                                      {mbData.mainBoard.name && <span className="text-muted-foreground">{mbData.mainBoard.name}</span>}
                                    </button>
                                  </CollapsibleTrigger>
                                </div>
                                
                                <div className="flex items-center gap-2 pl-7 pt-1 text-muted-foreground text-[10px]">
                                  <span>{mbData.inverters.length} inverter{mbData.inverters.length !== 1 ? 's' : ''}</span>
                                </div>
                              </div>
                              
                              <CollapsibleContent className="pl-4 pt-1 space-y-1">
                                {mbData.inverters.length === 0 ? (
                                  <p className="text-xs text-muted-foreground py-1 pl-4">No inverters connected</p>
                                ) : (
                                  mbData.inverters.map((inv, invIdx) => renderInverterContent(inv, invIdx))
                                )}
                              </CollapsibleContent>
                            </Collapsible>
                          );
                        })}
                        
                        {/* Unassigned inverters */}
                        {unassignedInverters.length > 0 && (
                          <Collapsible defaultOpen={mainBoards.length === 0}>
                            <div className="flex flex-col p-2 rounded text-xs bg-muted/30 hover:bg-accent/50 transition-colors">
                              <div className="flex items-center gap-1">
                                <div className="w-5" /> {/* Spacer for alignment */}
                                <CollapsibleTrigger asChild>
                                  <button className="flex-1 flex items-center gap-2 text-left">
                                    <ChevronDown className="h-3 w-3 text-muted-foreground transition-transform [&[data-state=open]>svg]:rotate-180" />
                                    <span className="font-medium text-muted-foreground">Unassigned Inverters</span>
                                  </button>
                                </CollapsibleTrigger>
                              </div>
                              
                              <div className="flex items-center gap-2 pl-7 pt-1 text-muted-foreground text-[10px]">
                                <span>{unassignedInverters.length} inverter{unassignedInverters.length !== 1 ? 's' : ''}</span>
                              </div>
                            </div>
                            
                            <CollapsibleContent className="pl-4 pt-1 space-y-1">
                              {unassignedInverters.map((inv, invIdx) => renderInverterContent(inv, invIdx))}
                            </CollapsibleContent>
                          </Collapsible>
                        )}
                      </>
                    );
                  })()}
                </div>
              </ScrollArea>
            </CollapsibleContent>
          </Collapsible>
      </div>
    </TooltipProvider>
  );
}
