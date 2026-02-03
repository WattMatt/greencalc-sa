
# Fix: Multi-Selection Not Working for Inverters, Walkways, Cable Trays, and Solar Modules

## Problem Identified

After investigating the `Canvas.tsx` hit-testing logic, I found the root cause:

**Equipment (inverters) is being checked AFTER roof masks in the selection order.**

Current order in `handleMouseDown`:
1. PV Arrays (solar modules)
2. Walkways
3. Cable Trays
4. **Roof Masks** ← Problem: checked before equipment
5. **Equipment (inverters)** ← Too late in priority

Since roof masks are large polygons covering the entire roof area, clicking on an inverter positioned on or near a roof will select the roof mask instead of the equipment.

## Solution

Reorder the hit-testing in `Canvas.tsx` so equipment (inverters, DC combiners, AC disconnects, main boards) is checked **before** roof masks:

```text
Current Order:                      Fixed Order:
1. PV Arrays                        1. PV Arrays
2. Walkways                         2. Walkways  
3. Cable Trays                      3. Cable Trays
4. Roof Masks  <-- wrong            4. Equipment  <-- moved up
5. Equipment                        5. Roof Masks <-- moved down
```

## Technical Changes

### File: `src/components/floor-plan/components/Canvas.tsx`

**Lines ~620-650**: Move the equipment hit-testing block (currently at lines 627-649) to occur BEFORE the roof mask hit-testing (lines 620-625).

The code block to move:
```typescript
// Select equipment (inverters, etc.) using bounding box hit-test
const hitEquipment = [...equipment].reverse().find(item => {
  const realSize = EQUIPMENT_REAL_WORLD_SIZES[item.type] || 0.5;
  const sizePx = scaleInfo.ratio ? realSize / scaleInfo.ratio : 20;
  const padding = 5 / viewState.zoom;
  const halfSize = sizePx / 2 + padding;
  
  return Math.abs(worldPos.x - item.position.x) <= halfSize &&
         Math.abs(worldPos.y - item.position.y) <= halfSize;
});

if (hitEquipment) {
  handleItemSelection(hitEquipment.id, () => {
    setDraggingEquipmentId(hitEquipment.id);
    setEquipmentDragOffset({ 
      x: worldPos.x - hitEquipment.position.x, 
      y: worldPos.y - hitEquipment.position.y 
    });
  });
  return;
}
```

This block should be placed **after cable trays** (line 618) and **before roof masks** (line 620).

## Expected Behavior After Fix

| Object Type | Shift+Click Multi-Select |
|-------------|-------------------------|
| PV Arrays (solar modules) | Works |
| Walkways | Works |
| Cable Trays | Works |
| Inverters (equipment) | **Now works** |
| Roof Masks | Works (lowest priority) |

## Testing Scenarios

1. Place an inverter on the canvas
2. Place another inverter nearby
3. Shift+click on first inverter → selected
4. Shift+click on second inverter → both selected with group bounding box
5. Repeat with walkways and cable trays
6. Verify mixed selection (e.g., inverter + walkway) shows warning on copy
