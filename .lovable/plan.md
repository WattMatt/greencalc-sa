
# Fix: Set Distance Tool Not Moving Cable Tray

## Problem Identified

The "Set Distance Between Objects" tool fails to move the cable tray when reducing the distance (e.g., from 1.57m to 1.5m). The user sees no movement at all - the object stays in place.

### Root Cause

The `handleDimensionApply` function makes **four separate `commitState` calls** - one for each object type (PV arrays, equipment, walkways, cable trays). While the atomic state management system is designed to handle sequential commits, this pattern is inefficient and potentially fragile.

More critically, when moving a single cable tray, the first three commits (for PV arrays, equipment, walkways) create history entries with **no actual changes**. This clutters the undo history with no-op entries and may cause subtle timing issues.

The fix is to consolidate all object movements into a **single atomic state update** that modifies all object types at once, consistent with the pattern used elsewhere in the codebase (e.g., deletion operations).

---

## Solution

### File: `src/components/floor-plan/FloorPlanMarkup.tsx`

Replace the four separate state setter calls with a single `commitState` call that updates all object types atomically:

```typescript
const handleDimensionApply = useCallback((newDistance: number) => {
  if (!dimensionObject1Id || !dimensionObject2Id || !scaleInfo.ratio) return;
  
  const pos1 = getObjectPosition(dimensionObject1Id);
  const pos2 = getObjectPosition(dimensionObject2Id);
  const dims1 = getObjectDimensions(dimensionObject1Id);
  const dims2 = getObjectDimensions(dimensionObject2Id);
  
  if (!pos1 || !pos2 || !dims1 || !dims2) return;
  
  const newPos = calculateNewPositionAtDistance(
    pos1,
    { width: dims1.width, height: dims1.height },
    dims1.rotation,
    pos2,
    { width: dims2.width, height: dims2.height },
    dims2.rotation,
    newDistance,
    scaleInfo.ratio
  );
  
  // Calculate delta to apply to all selected items
  const delta: Point = {
    x: newPos.x - pos1.x,
    y: newPos.y - pos1.y,
  };
  
  console.log('[Set Distance] Applying:', {
    object1Id: dimensionObject1Id,
    oldPos: pos1,
    newPos,
    delta,
    targetDistance: newDistance,
  });
  
  // Skip if no movement needed (delta is effectively zero)
  if (Math.abs(delta.x) < 0.001 && Math.abs(delta.y) < 0.001) {
    console.warn('[Set Distance] Delta is zero - no movement');
    toast.error('No movement needed - already at target distance');
    return;
  }
  
  // Determine which IDs to move
  const idsToMove = selectedItemIds.size > 1 
    ? new Set(Array.from(selectedItemIds).filter(id => id !== dimensionObject2Id))
    : new Set([dimensionObject1Id]);
  
  // Apply movement to ALL object types in a SINGLE atomic commit
  commitState((prev) => ({
    ...prev,
    pvArrays: prev.pvArrays.map(arr => 
      idsToMove.has(arr.id) 
        ? { ...arr, position: { x: arr.position.x + delta.x, y: arr.position.y + delta.y } }
        : arr
    ),
    equipment: prev.equipment.map(eq => 
      idsToMove.has(eq.id)
        ? { ...eq, position: { x: eq.position.x + delta.x, y: eq.position.y + delta.y } }
        : eq
    ),
    placedWalkways: prev.placedWalkways.map(w => 
      idsToMove.has(w.id)
        ? { ...w, position: { x: w.position.x + delta.x, y: w.position.y + delta.y } }
        : w
    ),
    placedCableTrays: prev.placedCableTrays.map(c => 
      idsToMove.has(c.id)
        ? { ...c, position: { x: c.position.x + delta.x, y: c.position.y + delta.y } }
        : c
    ),
  }));
  
  const movedCount = idsToMove.size;
  
  // Reset dimension tool state
  setDimensionObject1Id(null);
  setDimensionObject2Id(null);
  setIsSetDistanceModalOpen(false);
  setActiveTool(Tool.SELECT);
  toast.success(`Distance set to ${newDistance.toFixed(2)}m${movedCount > 1 ? ` (${movedCount} items moved)` : ''}`);
}, [dimensionObject1Id, dimensionObject2Id, scaleInfo.ratio, getObjectPosition, getObjectDimensions, selectedItemIds, commitState]);
```

---

## Key Changes

| Aspect | Before | After |
|--------|--------|-------|
| State updates | 4 separate `commitState` calls via wrappers | 1 single `commitState` call |
| History entries | Creates 4 history entries per operation | Creates 1 history entry |
| Undo behavior | 4 undos required to revert | 1 undo to revert |
| Zero-delta handling | Silently does nothing | Shows warning toast |
| Debug logging | Logged selection info | Logs actual positions and delta |

---

## Benefits

1. **Atomic operation**: All movements happen in a single state transaction
2. **Cleaner undo history**: One entry per distance operation instead of four
3. **Better debugging**: Console log shows actual delta values to diagnose issues
4. **User feedback**: If delta is zero, user sees an error message instead of silent failure
5. **Consistent pattern**: Matches the single-commit pattern used in other multi-object operations

---

## Testing Plan

1. Open PV Layout editor
2. Place a cable tray to the right of a PV array
3. Use "Tools > Distance Between" - click cable tray (Object 1), then PV array (Object 2)
4. In the modal, change distance from current value (e.g., 1.57m) to a smaller value (e.g., 1.5m)
5. Click Apply
6. **Verify**: Cable tray moves toward the PV array
7. Check console for `[Set Distance] Applying:` log with non-zero delta
8. Test undo - should revert in a single Ctrl+Z
9. Repeat with cable tray to the LEFT of PV array
10. Test group selection - select multiple objects, set distance between one of them and a reference
