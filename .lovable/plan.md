
# Plan: Enable Walkway/Cable Tray Selection from Summary Panel

## Issue Identified

When clicking on a walkway or cable tray item in the Summary Panel, it cannot be selected or made visible on the canvas. This is because:

1. **Missing Selection Functionality**: The `GroupedMaterialSection` component (used for Walkways and Cable Trays) doesn't have click handlers to select items - unlike Inverters, Modules, and Roof Areas which have `onClick={() => onSelectItem(item.id)}`

2. **Hidden Items Remain Hidden**: When clicking to select an item whose layer or subgroup is hidden, it should auto-unhide so the user can see it on the canvas

## Technical Solution

### File 1: `src/components/floor-plan/components/SummaryPanel.tsx`

**Changes to `GroupedMaterialSection` Component:**

1. Add new props:
   - `selectedItemId?: string | null`
   - `onSelectItem?: (id: string) => void`
   - `layerKey?: 'walkways' | 'cableTrays'`
   - `onShowLayer?: () => void` - to force-show the layer when selecting

2. Make individual items clickable with selection highlight:
   ```tsx
   <button
     className={cn(
       "flex-1 text-left",
       selectedItemId === item.id && "font-medium"
     )}
     onClick={() => {
       // Auto-show layer and subgroup if hidden
       if (isVisible === false) onShowLayer?.();
       if (isSubgroupVisible === false) onToggleSubgroupVisibility?.(key);
       onSelectItem?.(item.id);
     }}
   >
   ```

3. Add visual selection indicator (matching Inverter styling):
   ```tsx
   <div className={cn(
     "flex items-center justify-between p-1.5 rounded text-xs transition-colors",
     selectedItemId === item.id 
       ? "bg-primary/10 border border-primary" 
       : "bg-muted hover:bg-accent"
   )}>
   ```

**Changes to `SummaryPanelProps`:**
- No changes needed - `selectedItemId` and `onSelectItem` are already passed

**Changes to `GroupedMaterialSection` Usage:**
- Pass `selectedItemId`, `onSelectItem`, and visibility override handlers to both Walkways and Cable Trays sections

### File 2: `src/components/floor-plan/FloorPlanMarkup.tsx`

**Add Layer/Subgroup Show Handlers:**

Create helper functions to force-show layers when selecting hidden items:
```tsx
const forceShowWalkways = useCallback(() => {
  setLayerVisibility(prev => ({ ...prev, walkways: true }));
}, []);

const forceShowCableTrays = useCallback(() => {
  setLayerVisibility(prev => ({ ...prev, cableTrays: true }));
}, []);
```

Pass these to SummaryPanel as `onShowWalkwayLayer` and `onShowCableTrayLayer`

---

## Summary of Changes

| File | Change |
|------|--------|
| `SummaryPanel.tsx` | Add click-to-select on walkway/cable tray items with selection styling; auto-unhide when selecting hidden items |
| `FloorPlanMarkup.tsx` | Add force-show layer handlers; pass to SummaryPanel |

This ensures:
1. Clicking any item in the Summary Panel selects it
2. Hidden items become visible when selected
3. Visual feedback matches existing Inverter/Module selection styling
