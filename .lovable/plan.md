
# Plan: Auto-Complete Cable Placement on Valid Endpoint Snap

## Problem
When drawing AC or DC cables, the cable placement does not automatically finish when clicking on the second valid target. Users expect:
- **AC Cable**: Start on Inverter → End on Main Board (auto-complete)
- **DC Cable**: Start on PV Array → End on Inverter (auto-complete)

Currently, clicks just keep adding points indefinitely, requiring a manual double-click or Enter key to complete.

## Solution
Auto-complete the cable when the second (or subsequent) point snaps to a valid "endpoint" target:
- **AC Cables**: Auto-complete when snapping to a Main Board
- **DC Cables**: Auto-complete when snapping to an Inverter

This creates a natural workflow where the cable automatically finishes when connecting to the appropriate destination.

---

## Technical Implementation

### File: `src/components/floor-plan/utils/geometry.ts`

Update `snapCablePointToTarget` return type to include `equipmentType` so we can determine if this is a valid endpoint:

```typescript
export const snapCablePointToTarget = (
  // ... existing params
): { 
  position: Point; 
  snappedToId: string | null; 
  snappedToType: 'equipment' | 'pvArray' | null;
  equipmentType?: EquipmentType;  // NEW: Include equipment type for endpoint detection
} => {
```

Update the return statement when snapping to equipment to include the equipmentType.

---

### File: `src/components/floor-plan/components/Canvas.tsx`

**Update the click handler (around lines 1076-1099):**

After snapping, check if this is a valid endpoint and auto-complete:

```typescript
if (activeTool === Tool.LINE_DC || activeTool === Tool.LINE_AC) {
  const cableType: CableType = activeTool === Tool.LINE_DC ? 'dc' : 'ac';
  const snapResult = snapCablePointToTarget(/* ... */);
  finalPos = snapResult.position;
  
  // Check if this is a valid endpoint for auto-completion
  const isValidEndpoint = (() => {
    if (currentDrawing.length === 0) return false; // Need at least one point first
    
    if (cableType === 'ac' && snapResult.snappedToType === 'equipment') {
      // AC cables auto-complete when snapping to Main Board
      return snapResult.equipmentType === EquipmentType.MAIN_BOARD;
    }
    if (cableType === 'dc' && snapResult.snappedToType === 'equipment') {
      // DC cables auto-complete when snapping to Inverter
      return snapResult.equipmentType === EquipmentType.INVERTER;
    }
    return false;
  })();
  
  if (isValidEndpoint) {
    // Add the final point and complete
    const snappedPos = (isShiftHeld && currentDrawing.length > 0)
      ? snapTo45Degrees(currentDrawing[currentDrawing.length - 1], finalPos)
      : finalPos;
    
    // Complete the cable immediately
    const newLine: SupplyLine = {
      id: `line-${Date.now()}`,
      name: `${cableType === 'dc' ? 'DC' : 'AC'} Cable`,
      type: cableType,
      points: [...currentDrawing, snappedPos],
      length: calculateLineLength([...currentDrawing, snappedPos], scaleInfo.ratio),
    };
    setLines(prev => [...prev, newLine]);
    setCurrentDrawing([]);
    setPreviewPoint(null);
    return; // Don't add another point
  }
}
```

---

## Expected Behavior After Change

| Cable Type | Start Point | Waypoints | End Point | Behavior |
|------------|-------------|-----------|-----------|----------|
| AC Cable | Inverter | Any clicks | Main Board | Auto-completes on Main Board click |
| DC Cable | PV Array | Any clicks | Inverter | Auto-completes on Inverter click |

Users can still:
- Add intermediate waypoints by clicking on empty areas (not snapping to endpoints)
- Cancel with ESC key
- Manually complete with Enter or double-click

---

## Files to Modify

| File | Changes |
|------|---------|
| `geometry.ts` | Return `equipmentType` from `snapCablePointToTarget` |
| `Canvas.tsx` | Add auto-completion logic when snapping to valid endpoint |

## Summary

This change adds intelligent auto-completion for cable placement: AC cables finish when reaching a Main Board, DC cables finish when reaching an Inverter. This creates a natural "connect the dots" workflow that matches user expectations for electrical cabling.
