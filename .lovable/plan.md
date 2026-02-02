

# Plan: Add Selection Highlighting with Object Numbers for Distance Between and Edge Align Tools

## Overview

This plan adds visual highlighting for selected objects when using the "Distance Between" and "Edge Align" tools. When objects are selected:
1. A semi-transparent colored mask overlay is placed over each selected object, constrained to its boundary
2. The object number ("1" or "2") is displayed prominently within the mask
3. Object 1 (the one that will move) uses one color (e.g., blue)
4. Object 2 (the stationary reference) uses a different color (e.g., green)

## Visual Design

```text
+----------------------------------+
|  [PV Array]                      |
|  +----------+                    |
|  |  [1]     |  <- Blue overlay   |
|  |  Object  |     with "1"       |
|  +----------+                    |
|                                  |
|     [Inverter]                   |
|     +----+                       |
|     |[2] |  <- Green overlay     |
|     +----+      with "2"         |
+----------------------------------+
```

## Implementation Details

### 1. Add Highlight Drawing Function to `drawing.ts`

Create a new function `drawObjectHighlight` that:
- Takes object position, dimensions, rotation, zoom, and selection number
- Draws a semi-transparent overlay matching the object's bounding box
- Renders the selection number (1 or 2) centered within the overlay

```typescript
/**
 * Draw a highlight overlay on a selected object for dimension/align tools
 */
export const drawObjectHighlight = (
  ctx: CanvasRenderingContext2D,
  position: Point,
  dimensions: { width: number; height: number },
  rotation: number,
  zoom: number,
  selectionNumber: 1 | 2
) => {
  ctx.save();
  ctx.translate(position.x, position.y);
  ctx.rotate(rotation * Math.PI / 180);
  
  const { width, height } = dimensions;
  
  // Draw semi-transparent overlay
  ctx.fillStyle = selectionNumber === 1 
    ? 'rgba(59, 130, 246, 0.3)'  // Blue for object 1
    : 'rgba(34, 197, 94, 0.3)';  // Green for object 2
  ctx.fillRect(-width / 2, -height / 2, width, height);
  
  // Draw border
  ctx.strokeStyle = selectionNumber === 1 
    ? 'rgba(59, 130, 246, 0.8)'
    : 'rgba(34, 197, 94, 0.8)';
  ctx.lineWidth = 3 / zoom;
  ctx.strokeRect(-width / 2, -height / 2, width, height);
  
  // Draw selection number
  const fontSize = Math.min(width, height) * 0.4;
  ctx.font = `bold ${Math.max(fontSize, 14 / zoom)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = selectionNumber === 1 
    ? 'rgba(59, 130, 246, 1)'
    : 'rgba(34, 197, 94, 1)';
  ctx.fillText(selectionNumber.toString(), 0, 0);
  
  ctx.restore();
};
```

### 2. Update `RenderAllParams` Interface

Add new parameters to track tool selection state:

```typescript
export interface RenderAllParams {
  // ... existing params
  dimensionObject1Id?: string | null;
  dimensionObject2Id?: string | null;
  alignObject1Id?: string | null;
  alignObject2Id?: string | null;
}
```

### 3. Update `renderAllMarkups` Function

Add logic to draw highlights for selected objects after drawing the normal objects:

```typescript
export const renderAllMarkups = (ctx, params) => {
  // ... existing drawing code ...
  
  // Draw dimension/align tool highlights at the end (on top of everything)
  const highlightIds = [
    { id: params.dimensionObject1Id, num: 1 as const },
    { id: params.dimensionObject2Id, num: 2 as const },
    { id: params.alignObject1Id, num: 1 as const },
    { id: params.alignObject2Id, num: 2 as const },
  ].filter(h => h.id);
  
  for (const { id, num } of highlightIds) {
    const objInfo = findObjectById(id, params);
    if (objInfo) {
      drawObjectHighlight(ctx, objInfo.position, objInfo.dimensions, objInfo.rotation, zoom, num);
    }
  }
};
```

### 4. Add Helper Function to Find Object Info

Create a helper function that finds an object by ID and returns its position, dimensions, and rotation:

```typescript
const findObjectForHighlight = (
  id: string,
  params: RenderAllParams
): { position: Point; dimensions: { width: number; height: number }; rotation: number } | null => {
  // Check PV arrays
  const pvArray = params.pvArrays.find(a => a.id === id);
  if (pvArray && params.pvPanelConfig && params.scaleInfo.ratio) {
    const dims = getPVArrayDimensions(pvArray, params.pvPanelConfig, params.roofMasks, params.scaleInfo, pvArray.position);
    return { position: pvArray.position, dimensions: dims, rotation: pvArray.rotation };
  }
  
  // Check equipment
  const equip = params.equipment.find(e => e.id === id);
  if (equip) {
    const dims = getEquipmentDimensions(equip.type, params.scaleInfo, params.plantSetupConfig);
    return { position: equip.position, dimensions: dims, rotation: equip.rotation };
  }
  
  // Check walkways
  const walkway = params.placedWalkways?.find(w => w.id === id);
  if (walkway && params.scaleInfo.ratio) {
    return {
      position: walkway.position,
      dimensions: { width: walkway.width / params.scaleInfo.ratio, height: walkway.length / params.scaleInfo.ratio },
      rotation: walkway.rotation || 0,
    };
  }
  
  // Check cable trays
  const tray = params.placedCableTrays?.find(t => t.id === id);
  if (tray && params.scaleInfo.ratio) {
    return {
      position: tray.position,
      dimensions: { width: tray.width / params.scaleInfo.ratio, height: tray.length / params.scaleInfo.ratio },
      rotation: tray.rotation || 0,
    };
  }
  
  return null;
};
```

### 5. Update Canvas.tsx

Pass the dimension/align object IDs to `renderAllMarkups`:

```typescript
renderAllMarkups(ctx, {
  // ... existing params
  dimensionObject1Id,
  dimensionObject2Id: dimensionObject2Id, // Need to add this prop
  alignObject1Id,
  alignObject2Id: alignObject2Id,         // Need to add this prop
});
```

### 6. Update Canvas Props

Add the missing `dimensionObject2Id` and `alignObject2Id` props to Canvas:

```typescript
interface CanvasProps {
  // ... existing props
  dimensionObject1Id?: string | null;
  dimensionObject2Id?: string | null;  // NEW
  alignObject1Id?: string | null;
  alignObject2Id?: string | null;      // NEW
}
```

### 7. Update FloorPlanMarkup.tsx

Pass the second object IDs to Canvas:

```typescript
<Canvas
  // ... existing props
  dimensionObject1Id={dimensionObject1Id}
  dimensionObject2Id={dimensionObject2Id}  // NEW
  alignObject1Id={alignObject1Id}
  alignObject2Id={alignObject2Id}          // NEW
/>
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/floor-plan/utils/drawing.ts` | Add `drawObjectHighlight` function, update `RenderAllParams` interface, update `renderAllMarkups` to draw highlights |
| `src/components/floor-plan/components/Canvas.tsx` | Add `dimensionObject2Id` and `alignObject2Id` props, pass to `renderAllMarkups` |
| `src/components/floor-plan/FloorPlanMarkup.tsx` | Pass `dimensionObject2Id` and `alignObject2Id` to Canvas |

## Color Scheme

| Selection | Fill Color | Border Color | Label Color |
|-----------|------------|--------------|-------------|
| Object 1 (moves) | `rgba(59, 130, 246, 0.3)` (Blue 30%) | `rgba(59, 130, 246, 0.8)` | Blue |
| Object 2 (stationary) | `rgba(34, 197, 94, 0.3)` (Green 30%) | `rgba(34, 197, 94, 0.8)` | Green |

## Expected Behavior

1. **When using Distance Between tool:**
   - Click first object: Blue overlay appears with "1" inside
   - Click second object: Green overlay appears with "2" inside, modal opens
   - Both overlays visible until modal is closed

2. **When using Edge Align tool:**
   - Same behavior as Distance Between tool
   - Object 1 (blue, "1") will move to align with Object 2 (green, "2")

3. **Overlay appearance:**
   - Semi-transparent fill matching object boundary
   - Solid border for visibility
   - Large centered number indicating selection order
   - Respects object rotation

## Technical Notes

- Highlights are drawn last in `renderAllMarkups` so they appear on top of all other elements
- The highlight follows the object's bounding box (axis-aligned after rotation)
- Font size scales with object size but has a minimum size for readability
- Colors match Tailwind's blue-500 and green-500 for consistency with the UI

