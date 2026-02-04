
# Plan: Add Ghost Preview for AC/DC Cable Placement

## Problem
When using the AC or DC cable tools, there is no visual indicator (ghost) showing where the cable will be placed or what target it will snap to before clicking. This makes it difficult to confirm if the snapping functionality is working and where the first point will be placed.

## Current Behavior
- PV arrays, equipment, walkways, and cable trays all show a "ghost" preview that follows the cursor
- Cable tools only show a preview line AFTER the first click has been made
- No visual feedback about valid snap targets (Inverters, Main Boards, Solar Modules)

## Proposed Solution
Add a ghost preview system for cable tools that shows:
1. **Snap Indicator**: A glowing circle/highlight on valid snap targets when the cursor is within snap range
2. **Cursor Indicator**: A small crosshair/dot at the current mouse position showing where the cable point will be placed
3. **Target Highlighting**: Valid snap targets highlighted to show they are "active"

---

## Technical Implementation

### File 1: `src/components/floor-plan/components/Canvas.tsx`

**A. Track mouse position for cable tools (handleMouseMove)**

Update lines 1536-1548 to include LINE_DC and LINE_AC in the mouse tracking:

```typescript
const equipmentPlacementTools = [Tool.PLACE_INVERTER, Tool.PLACE_DC_COMBINER, Tool.PLACE_AC_DISCONNECT, Tool.PLACE_MAIN_BOARD];
const materialPlacementTools = [Tool.PLACE_WALKWAY, Tool.PLACE_CABLE_TRAY];
const cableTools = [Tool.LINE_DC, Tool.LINE_AC];

if (
  (activeTool === Tool.PV_ARRAY && (pendingPvArrayConfig || pendingBatchPlacement)) || 
  equipmentPlacementTools.includes(activeTool) ||
  materialPlacementTools.includes(activeTool) ||
  cableTools.includes(activeTool)
) {
  setMouseWorldPos(worldPos);
} else {
  setMouseWorldPos(null);
}
```

**B. Add ghost preview rendering in the useEffect drawing code (around line 498)**

Add new ghost preview section for cable tools:

```typescript
// Draw ghost preview for cable placement (before any points are placed)
if ((activeTool === Tool.LINE_DC || activeTool === Tool.LINE_AC) && mouseWorldPos) {
  const cableType: CableType = activeTool === Tool.LINE_DC ? 'dc' : 'ac';
  const snapResult = snapCablePointToTarget(
    mouseWorldPos,
    cableType,
    equipment,
    pvArrays,
    pvPanelConfig,
    roofMasks,
    scaleInfo,
    viewState,
    plantSetupConfig
  );
  
  // Draw snap indicator if snapped to a target
  if (snapResult.snappedToId) {
    // Draw glowing ring around snap point
    ctx.beginPath();
    ctx.arc(snapResult.position.x, snapResult.position.y, 12 / viewState.zoom, 0, Math.PI * 2);
    ctx.strokeStyle = cableType === 'dc' ? '#ef4444' : '#22c55e'; // Red for DC, Green for AC
    ctx.lineWidth = 3 / viewState.zoom;
    ctx.stroke();
    
    // Inner filled circle
    ctx.beginPath();
    ctx.arc(snapResult.position.x, snapResult.position.y, 6 / viewState.zoom, 0, Math.PI * 2);
    ctx.fillStyle = cableType === 'dc' ? 'rgba(239, 68, 68, 0.6)' : 'rgba(34, 197, 94, 0.6)';
    ctx.fill();
  } else {
    // Draw crosshair at current position when not snapping
    const crossSize = 8 / viewState.zoom;
    ctx.strokeStyle = cableType === 'dc' ? '#ef4444' : '#22c55e';
    ctx.lineWidth = 1.5 / viewState.zoom;
    
    // Horizontal line
    ctx.beginPath();
    ctx.moveTo(mouseWorldPos.x - crossSize, mouseWorldPos.y);
    ctx.lineTo(mouseWorldPos.x + crossSize, mouseWorldPos.y);
    ctx.stroke();
    
    // Vertical line
    ctx.beginPath();
    ctx.moveTo(mouseWorldPos.x, mouseWorldPos.y - crossSize);
    ctx.lineTo(mouseWorldPos.x, mouseWorldPos.y + crossSize);
    ctx.stroke();
  }
}
```

**C. Update useEffect dependency array**

Ensure the drawing effect re-runs when mouseWorldPos changes for cable tools by confirming mouseWorldPos is in the dependency array (it should already be there).

---

## Visual Design

| State | Visual Feedback |
|-------|-----------------|
| DC Cable - Hovering near Inverter/PV Array | Red glowing ring + filled circle on snap target |
| DC Cable - Not near valid target | Red crosshair at cursor position |
| AC Cable - Hovering near Inverter/Main Board | Green glowing ring + filled circle on snap target |
| AC Cable - Not near valid target | Green crosshair at cursor position |

Color rationale:
- **Red (DC)**: Matches typical DC cable color coding in electrical systems
- **Green (AC)**: Matches typical AC cable color coding

---

## Files to Modify

| File | Changes |
|------|---------|
| `Canvas.tsx` | Add mouse tracking for cable tools; Add ghost preview rendering |

## Summary

This change adds visual feedback for cable placement, showing:
1. A colored crosshair at the cursor position when not snapping
2. A glowing ring indicator when hovering over valid snap targets
3. Clear color-coding (red for DC, green for AC) to differentiate cable types

Users will now be able to see exactly where their cable points will be placed and confirm that snapping is working before clicking.
