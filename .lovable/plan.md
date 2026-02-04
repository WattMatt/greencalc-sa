

# Plan: Fix Show/Hide Logic to Work Independently for Each Object Type

## Problem Summary

The current visibility implementation has several issues:

1. **Main Boards and Inverters are tied together**: Both sections use `layerVisibility.equipment` - when you hide Main Boards, it affects Inverters (and vice versa) because they share the same layer visibility key.

2. **Per-item visibility missing for individual cables**: The Cabling section has per-thickness visibility and category-level visibility, but individual cables (DC Cable 1, DC Cable 2, etc.) don't have their own eye icons for per-item hiding.

3. **Inconsistent structure**: Some object types have proper per-item visibility, while others don't.

## Root Cause Analysis

Looking at the code:

**SummaryPanel.tsx lines 737-744 (Main Boards section)**:
```typescript
<CollapsibleSection
  ...
  isVisible={layerVisibility?.equipment}  // Uses 'equipment' layer
  onToggleVisibility={onToggleLayerVisibility ? () => onToggleLayerVisibility('equipment') : undefined}
```

**SummaryPanel.tsx lines 914-920 (Inverters section)**:
```typescript
<CollapsibleSection
  ...
  isVisible={layerVisibility?.equipment}  // SAME 'equipment' layer - this is the bug!
  onToggleVisibility={onToggleLayerVisibility ? () => onToggleLayerVisibility('equipment') : undefined}
```

Both Main Boards AND Inverters toggle the exact same `equipment` layer visibility, causing them to be tied together.

Additionally, individual cables in the Cabling section don't have per-item eye icons like other object types do.

## Solution

### Step 1: Add Separate Layer Visibility for Main Boards vs Inverters

**File: `src/components/floor-plan/types.ts`**

Extend `LayerVisibility` interface to separate equipment types:
```typescript
export interface LayerVisibility {
  roofMasks: boolean;
  pvArrays: boolean;
  equipment: boolean;      // Keep for backward compatibility / DC Combiners / AC Disconnects
  mainBoards: boolean;     // NEW: Separate visibility for main boards
  inverters: boolean;      // NEW: Separate visibility for inverters
  walkways: boolean;
  cableTrays: boolean;
  cables: boolean;
}

export const defaultLayerVisibility: LayerVisibility = {
  roofMasks: true,
  pvArrays: true,
  equipment: true,
  mainBoards: true,     // NEW
  inverters: true,      // NEW
  walkways: true,
  cableTrays: true,
  cables: true,
};
```

### Step 2: Update FloorPlanMarkup State Handling

**File: `src/components/floor-plan/FloorPlanMarkup.tsx`**

The existing `handleToggleLayerVisibility` callback already works generically with any key of `LayerVisibility`, so no changes needed to the handler itself - it will automatically support the new keys.

### Step 3: Update SummaryPanel to Use Separate Layer Keys

**File: `src/components/floor-plan/components/SummaryPanel.tsx`**

**Main Boards section** - Use `mainBoards` layer:
```typescript
<CollapsibleSection
  icon={<LayoutGrid className="h-4 w-4 text-purple-500" />}
  title="Main Boards"
  summary={...}
  isVisible={layerVisibility?.mainBoards}  // CHANGED from 'equipment'
  onToggleVisibility={onToggleLayerVisibility ? () => onToggleLayerVisibility('mainBoards') : undefined}
```

**Inverters section** - Use `inverters` layer:
```typescript
<CollapsibleSection
  icon={<Zap className="h-4 w-4 text-green-500" />}
  title="Inverters"
  summary={...}
  isVisible={layerVisibility?.inverters}  // CHANGED from 'equipment'
  onToggleVisibility={onToggleLayerVisibility ? () => onToggleLayerVisibility('inverters') : undefined}
```

### Step 4: Update Canvas Rendering to Respect Separate Equipment Layers

**File: `src/components/floor-plan/utils/drawing.ts`**

Update the equipment rendering logic to check the appropriate layer visibility based on equipment type:

```typescript
// Draw equipment - filter by equipment type and layer visibility
for (const item of equipment) {
  if (!isItemVisible(item.id)) continue;
  
  // Check specific layer visibility based on equipment type
  if (item.type === EquipmentType.MAIN_BOARD) {
    if (layerVisibility.mainBoards === false) continue;
  } else if (item.type === EquipmentType.INVERTER) {
    if (layerVisibility.inverters === false) continue;
  } else {
    // Other equipment (DC Combiner, AC Disconnect) use generic 'equipment' layer
    if (!layerVisibility.equipment) continue;
  }
  
  drawEquipmentIcon(ctx, item, isItemSelected(item.id), zoom, scaleInfo, plantSetupConfig);
}
```

### Step 5: Update Canvas Hit-Testing for Separate Equipment Layers

**File: `src/components/floor-plan/components/Canvas.tsx`**

Update the hit-testing and marquee selection logic to respect the new separate layer visibility for Main Boards and Inverters:

```typescript
// In hit-testing:
const isMainBoardVisible = layerVisibility?.mainBoards !== false;
const isInverterVisible = layerVisibility?.inverters !== false;

// When checking equipment hits:
if (e.type === EquipmentType.MAIN_BOARD && !isMainBoardVisible) continue;
if (e.type === EquipmentType.INVERTER && !isInverterVisible) continue;
```

### Step 6: Add Per-Item Eye Icons to Individual Cables

**File: `src/components/floor-plan/components/SummaryPanel.tsx`**

For each individual cable row (both DC and AC), add the eye icon:

```typescript
// Inside the cablesInGroup.map() for DC cables:
<div className="flex items-center gap-1 p-2 rounded w-full text-left transition-colors ...">
  {/* Per-item visibility toggle - NEW */}
  {onToggleItemVisibility && (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 shrink-0 -ml-0.5"
          onClick={(e) => {
            e.stopPropagation();
            onToggleItemVisibility(cable.id);
          }}
        >
          {itemVisibility?.[cable.id] !== false ? (
            <Eye className="h-3 w-3 text-muted-foreground" />
          ) : (
            <EyeOff className="h-3 w-3 text-muted-foreground/50" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left">
        {itemVisibility?.[cable.id] !== false ? 'Hide' : 'Show'}
      </TooltipContent>
    </Tooltip>
  )}
  <button className="flex-1 text-left" onClick={handleClick}>
    <span>DC Cable {i + 1}</span>
  </button>
  <span>{cableLength.toFixed(1)} m</span>
</div>
```

Same pattern applies to AC cables.

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/floor-plan/types.ts` | Add `mainBoards` and `inverters` to `LayerVisibility` interface and defaults |
| `src/components/floor-plan/components/SummaryPanel.tsx` | 1. Update Main Boards section to use `mainBoards` layer<br>2. Update Inverters section to use `inverters` layer<br>3. Add per-item eye icons to individual DC/AC cables |
| `src/components/floor-plan/utils/drawing.ts` | Update equipment rendering to check specific layer visibility per equipment type |
| `src/components/floor-plan/components/Canvas.tsx` | Update hit-testing/selection to respect separate Main Board and Inverter layer visibility |

## Expected Behavior After Implementation

1. **Main Boards visibility** - Toggling the Main Boards section eye icon will only hide/show Main Boards, not Inverters
2. **Inverters visibility** - Toggling the Inverters section eye icon will only hide/show Inverters, not Main Boards
3. **Other equipment** (DC Combiner, AC Disconnect) - Continue using the generic `equipment` layer
4. **Individual cables** - Each DC Cable and AC Cable will have its own eye icon to hide/show that specific cable
5. **All per-item visibility** - Every object in every dropdown can be individually hidden using its own eye icon
6. **Layer hierarchy preserved** - Category-level visibility still cascades to items, and per-item visibility works independently within visible categories

