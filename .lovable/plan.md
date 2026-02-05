

## Summary

This plan enhances the System Details section by converting each inverter into a collapsible dropdown that shows connected DC strings with detailed electrical information. Each string displays panel quantity and power, while the inverter header shows total connected panels and the DC/AC ratio.

---

## Current State

```text
+--------------------------------------------+
|  [v] System Details                        |
|  +--------------------------------------+  |
|  |  [Eye] Inverter 1  Sungrow 125kW  [X]|  |
|  |  [Eye] Inverter 2  Sungrow 125kW  [X]|  |
+--------------------------------------------+
```

---

## Proposed Changes

```text
+--------------------------------------------+
|  [v] System Details                        |
|  +--------------------------------------+  |
|  |  [Eye] [v] Inverter 1               |  |
|  |        156 panels | DC/AC: 1.24  [X]|  |
|  |     > String 1 - 26p | 14.3 kWp     |  |
|  |     > String 2 - 26p | 14.3 kWp     |  |
|  |     > String 3 - 26p | 14.3 kWp     |  |
|  |  [Eye] [>] Inverter 2               |  |
|  |        130 panels | DC/AC: 1.04     |  |
+--------------------------------------------+
```

When an inverter has no connected strings:

```text
|  [Eye] [v] Inverter 2                  |
|        0 panels | DC/AC: 0.00       [X]|
|     No strings connected               |
```

---

## Technical Implementation

**File: `src/components/floor-plan/components/SummaryPanel.tsx`**

### 1. Add Helper Function to Find Connected DC Cables

A function to find DC cables geometrically connected to an inverter:

```tsx
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
```

### 2. Add Helper Function to Find PV Array Connected to a String

A function to find which PV array a DC cable connects to (at the opposite end from the inverter):

```tsx
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
    // Get approximate array center (position is center)
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
```

### 3. Add Helper to Get Inverter AC Capacity

```tsx
// Get AC capacity from inverter config
const getInverterAcCapacity = (
  inv: EquipmentItem,
  plantSetupConfig?: PlantSetupConfig
): number => {
  if (!plantSetupConfig || !inv.configId) return 0;
  const config = plantSetupConfig.inverters.find(i => i.id === inv.configId);
  return config?.acCapacity || 0; // kW
};
```

### 4. Transform Inverter List into Collapsible Dropdowns

Replace flat inverter items with collapsible sections:

```tsx
{equipment
  .filter(e => e.type === EquipmentType.INVERTER)
  .map((inv, i) => {
    const isItemVisible = itemVisibility?.[inv.id] !== false;
    
    // Find connected DC cables
    const dcCables = lines.filter(l => l.type === 'dc');
    const connectedCables = getCablesConnectedToInverter(
      inv.id, inv.position, dcCables, scaleInfo
    );
    
    // Calculate totals for this inverter
    let totalPanels = 0;
    let totalDcCapacityKw = 0;
    const stringData: Array<{
      cable: SupplyLine;
      panelCount: number;
      powerKwp: number;
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
        stringData.push({ cable, panelCount: panels, powerKwp });
      } else {
        // Cable with no detected array - show as unknown
        stringData.push({ cable, panelCount: 0, powerKwp: 0 });
      }
    });
    
    const acCapacityKw = getInverterAcCapacity(inv, plantSetupConfig);
    const dcAcRatio = acCapacityKw > 0 
      ? (totalDcCapacityKw / acCapacityKw).toFixed(2) 
      : '0.00';
    
    return (
      <Collapsible key={inv.id} defaultOpen={false}>
        <div className={cn(
          "flex flex-col p-2 rounded text-xs transition-colors",
          selectedItemIds?.has(inv.id)
            ? 'bg-primary/10 border border-primary'
            : 'bg-muted hover:bg-accent',
          !isItemVisible && 'opacity-50'
        )}>
          {/* Header row with eye, trigger, and delete */}
          <div className="flex items-center gap-1">
            {/* Eye toggle */}
            {onToggleItemVisibility && (
              <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0"
                onClick={(e) => { e.stopPropagation(); onToggleItemVisibility(inv.id); }}>
                {isItemVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              </Button>
            )}
            
            {/* Collapsible trigger - inverter name */}
            <CollapsibleTrigger asChild>
              <button className="flex-1 flex items-center gap-2 text-left" onClick={handleClick}>
                <ChevronDown className="h-3 w-3 transition-transform [&[data-state=open]]:rotate-180" />
                <span className="font-medium">Inverter {i + 1}</span>
                {inv.name && <span className="text-muted-foreground">{inv.name}</span>}
              </button>
            </CollapsibleTrigger>
            
            {/* Delete button */}
            {onDeleteItem && (
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-destructive"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDeleteItem(inv.id); }}>
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
          
          {/* Summary row: total panels and DC/AC ratio */}
          <div className="flex items-center gap-2 pl-7 pt-1 text-muted-foreground text-[10px]">
            <span>{totalPanels} panels</span>
            <span>|</span>
            <span>DC/AC: {dcAcRatio}</span>
          </div>
        </div>
        
        {/* Connected strings content */}
        <CollapsibleContent className="pl-8 pt-1 space-y-1">
          {stringData.length === 0 ? (
            <p className="text-xs text-muted-foreground py-1">No strings connected</p>
          ) : (
            stringData.map((data, strIdx) => (
              <div key={data.cable.id} className="flex items-center gap-2 text-xs py-1">
                <div className="w-2 h-0.5 bg-orange-500 rounded" />
                <span>String {strIdx + 1}</span>
                <span className="text-muted-foreground">-</span>
                <span>{data.panelCount}p</span>
                <span className="text-muted-foreground ml-auto">{data.powerKwp.toFixed(1)} kWp</span>
              </div>
            ))
          )}
        </CollapsibleContent>
      </Collapsible>
    );
  })}
```

### 5. Import Point Type

Ensure the `Point` type is available in the import statement:

```tsx
import { PVArrayItem, RoofMask, SupplyLine, EquipmentItem, PVPanelConfig, ScaleInfo, PlantSetupConfig, PlacedWalkway, PlacedCableTray, EquipmentType, LayerVisibility, ItemVisibility, Point } from '../types';
```

---

## Technical Notes

- Connection detection uses a 1-meter proximity threshold, matching the cable snapping tolerance used during drawing
- The DC capacity is calculated as: (panel count) x (module wattage) / 1000 = kWp
- The DC/AC ratio is: (sum of all string DC capacities) / (inverter AC capacity from config)
- If no inverter config is found (configId missing), AC capacity defaults to 0 and ratio shows "0.00"
- Each string in the dropdown shows its panel count (from the connected PV array's rows x columns) and power
- Strings without a detectable PV array connection show "0p | 0.0 kWp"
- The inverter header shows cumulative totals for all connected strings

