
# Fix: Distance Between and Edge Align Selection Logic

## Problem Analysis

The "Distance Between" and "Edge Align" tools are incorrectly moving objects from a previous selection instead of respecting the currently clicked objects.

**Current Behavior (Buggy):**
1. User selects multiple items (e.g., via marquee selection)
2. User activates the Dimension tool
3. User clicks on Object A (cable tray) as "object to move"
4. User clicks on Object B (walkway) as "reference"
5. **Bug:** ALL previously selected items move, even if Object A wasn't part of that selection

**Root Cause:**

In `handleDimensionApply`, `performDirectEdgeAlign`, and `handleAlignEdgesApply`:

```typescript
const idsToMove = selectedItemIds.size > 1 
  ? new Set(Array.from(selectedItemIds).filter(id => id !== dimensionObject2Id))
  : new Set([dimensionObject1Id]);
```

This checks if there's a multi-selection (`size > 1`), but **doesn't verify** that the clicked object (`dimensionObject1Id` or `alignObject1Id`) is actually IN that selection. If the object isn't in the selection, only that single object should move.

**Expected Behavior:**
- If the clicked object is part of a multi-selection: move the entire selection (minus the reference)
- If the clicked object is NOT part of the selection: move only that single clicked object

---

## Solution

Update the `idsToMove` logic in all three functions to check whether the primary object is actually in the current selection before deciding to batch-move:

```typescript
// Only use selection for batch movement if the primary object is IN the selection
const primaryObject = dimensionObject1Id; // or alignObject1Id
const isPrimaryInSelection = selectedItemIds.has(primaryObject);

const idsToMove = (isPrimaryInSelection && selectedItemIds.size > 1)
  ? new Set(Array.from(selectedItemIds).filter(id => id !== referenceObjectId))
  : new Set([primaryObject]);
```

---

## Files to Modify

| File | Function | Change |
|------|----------|--------|
| `src/components/floor-plan/FloorPlanMarkup.tsx` | `handleDimensionApply` | Add check that `dimensionObject1Id` is in `selectedItemIds` before batch moving |
| `src/components/floor-plan/FloorPlanMarkup.tsx` | `performDirectEdgeAlign` | Add check that `alignObject1Id` is in `selectedItemIds` before batch moving |
| `src/components/floor-plan/FloorPlanMarkup.tsx` | `handleAlignEdgesApply` | Add check that `alignObject1Id` is in `selectedItemIds` before batch moving |

---

## Technical Details

### Change 1: `handleDimensionApply` (around line 1271-1274)

**Before:**
```typescript
const idsToMove = selectedItemIds.size > 1 
  ? new Set(Array.from(selectedItemIds).filter(id => id !== dimensionObject2Id))
  : new Set([dimensionObject1Id]);
```

**After:**
```typescript
// Only batch-move if the primary object is actually in the current selection
const isPrimaryInSelection = selectedItemIds.has(dimensionObject1Id);
const idsToMove = (isPrimaryInSelection && selectedItemIds.size > 1)
  ? new Set(Array.from(selectedItemIds).filter(id => id !== dimensionObject2Id))
  : new Set([dimensionObject1Id]);
```

### Change 2: `performDirectEdgeAlign` (around line 1348-1351)

**Before:**
```typescript
const idsToMove = selectedItemIds.size > 1 
  ? new Set(Array.from(selectedItemIds).filter(id => id !== object2Id))
  : new Set([alignObject1Id]);
```

**After:**
```typescript
// Only batch-move if the primary object is actually in the current selection
const isPrimaryInSelection = selectedItemIds.has(alignObject1Id);
const idsToMove = (isPrimaryInSelection && selectedItemIds.size > 1)
  ? new Set(Array.from(selectedItemIds).filter(id => id !== object2Id))
  : new Set([alignObject1Id]);
```

### Change 3: `handleAlignEdgesApply` (around line 1451-1454)

**Before:**
```typescript
const idsToMove = selectedItemIds.size > 1 
  ? new Set(Array.from(selectedItemIds).filter(id => id !== alignObject2Id))
  : new Set([alignObject1Id]);
```

**After:**
```typescript
// Only batch-move if the primary object is actually in the current selection
const isPrimaryInSelection = selectedItemIds.has(alignObject1Id);
const idsToMove = (isPrimaryInSelection && selectedItemIds.size > 1)
  ? new Set(Array.from(selectedItemIds).filter(id => id !== alignObject2Id))
  : new Set([alignObject1Id]);
```

---

## Testing Plan

1. Place two cable trays and one walkway on the canvas
2. Use marquee selection to select both cable trays
3. Activate the "Distance Between" tool
4. Click on the walkway (NOT in the selection) as object to move
5. Click on one of the cable trays as the reference
6. **Verify:** Only the walkway moves, not the previously selected cable trays
7. Repeat test for Edge Align tool
8. Also verify: when the clicked object IS in a selection, the whole selection still moves as expected
