
# Plan: Fix Cable Tray/Walkway Length Calculation and Subgroup Visibility

## Issues Identified

### Issue 1: Incorrect Total Length Calculation
The Summary Panel displays wrong total lengths for cable trays and walkways. For example, 15 cable trays that are 3m long each show a total of 2.3m instead of 45m.

**Root Cause**: When a cable tray or walkway is placed in "landscape" orientation, the `width` and `length` properties are swapped in `FloorPlanMarkup.tsx`. The original template might have:
- width: 0.152m (152mm)
- length: 3.0m

But in landscape mode, these become:
- width: 3.0m
- length: 0.152m

The grouping logic in `SummaryPanel.tsx` sums up `item.length`, which is now 0.152m (the original width), not 3.0m (the actual length). This gives: 15 × 0.15 = 2.25m ≈ 2.3m.

**Solution**: The length calculation should use `Math.max(item.width, item.length)` to always get the longest dimension (the "length" in practical terms), or better yet, preserve the original length value when placing items regardless of orientation.

### Issue 2: Subgroup Visibility Not Hiding Objects on Canvas
When a subdropdown (e.g., "Onvlee 76×76") is hidden using its eye icon, the corresponding objects remain visible on the canvas.

**Root Cause**: The subgroup visibility state (`walkwaySubgroupVisibility`, `cableTraySubgroupVisibility`) is managed locally inside `SummaryPanel` and is never passed to the `Canvas` component. The `Canvas` only receives `layerVisibility`, which controls visibility of entire categories (all walkways, all cable trays), not individual template types.

**Solution**: 
1. Lift the subgroup visibility state up to `FloorPlanMarkup`
2. Pass it down to both `SummaryPanel` (for UI) and `Canvas` (for rendering)
3. Filter objects in `Canvas` based on their `configId` and the corresponding visibility state

---

## Technical Implementation

### File 1: `src/components/floor-plan/types.ts`
- Add `SubgroupVisibility` type to the `LayerVisibility` interface or create a new type
- Example: `walkwaySubgroups?: Record<string, boolean>` and `cableTraySubgroups?: Record<string, boolean>`

### File 2: `src/components/floor-plan/FloorPlanMarkup.tsx`
- Add state for walkway and cable tray subgroup visibility
- Create toggle handlers for subgroups
- Pass subgroup visibility to both `Canvas` and `SummaryPanel`

### File 3: `src/components/floor-plan/components/SummaryPanel.tsx`
- **Fix length calculation**: Change the grouping logic to use `Math.max(item.width, item.length)` for the length calculation
- Also fix the individual item display to show dimensions consistently (largest first)
- Accept subgroup visibility and toggle handlers as props (from parent) instead of managing locally

### File 4: `src/components/floor-plan/components/Canvas.tsx`
- Accept subgroup visibility as a prop
- In `renderAllMarkups` call, filter `placedWalkways` and `placedCableTrays` based on their `configId` visibility before rendering

### File 5: `src/components/floor-plan/utils/drawing.ts`
- Update `RenderAllParams` interface to include subgroup visibility
- Filter walkways and cable trays in `renderAllMarkups` based on subgroup visibility state

---

## Summary of Changes

| Component | Change |
|-----------|--------|
| `types.ts` | Add subgroup visibility types |
| `FloorPlanMarkup.tsx` | State management for subgroup visibility |
| `SummaryPanel.tsx` | Fix length calculation using `Math.max(width, length)` + accept visibility as props |
| `Canvas.tsx` | Pass subgroup visibility to drawing utils |
| `drawing.ts` | Filter objects by configId before rendering |

This approach ensures:
1. Cable tray/walkway lengths are calculated correctly regardless of placement orientation
2. Hiding a subgroup (e.g., "Onvlee 152×76") hides those specific objects on the canvas while keeping other types visible
