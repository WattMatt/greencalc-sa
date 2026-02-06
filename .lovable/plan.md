
## Click-Based Cable Endpoint Editing with Ghost Preview

### Overview
Change the cable endpoint editing workflow from a drag-based interaction to a click-click interaction that mirrors the cable drawing experience, complete with ghost preview and full snap/Tab cycling functionality.

### Current Behavior
- First click on endpoint handle starts a drag operation
- Mouse movement while button is held updates the endpoint position
- Mouse up commits the change

### New Behavior
1. **First click** on endpoint handle: Selects the endpoint for editing (visual indicator)
2. **Second click** anywhere on canvas: Detaches the endpoint and attaches it to the mouse cursor, showing the cable ghost preview
3. **Mouse movement**: Ghost preview follows cursor with full snapping (equipment, PV arrays, cable trays, existing cables) and Tab cycling through overlapping snap targets
4. **Third click** on valid target or canvas: Commits the new endpoint position
5. **ESC key**: Cancels the operation and restores the original endpoint position

---

### Technical Changes

#### File: `src/components/floor-plan/components/Canvas.tsx`

**1. Replace drag state with two-stage edit state (around lines 150-159)**

Replace:
```typescript
const [draggingCableEndpoint, setDraggingCableEndpoint] = useState<{
  cableId: string;
  endpoint: 'start' | 'end';
} | null>(null);
const [cableEndpointDragPos, setCableEndpointDragPos] = useState<Point | null>(null);
const [cableEndpointSnapResult, setCableEndpointSnapResult] = useState<{...} | null>(null);
```

With:
```typescript
// Cable endpoint editing state - two-stage: selected -> editing
const [selectedCableEndpoint, setSelectedCableEndpoint] = useState<{
  cableId: string;
  endpoint: 'start' | 'end';
  originalPoints: Point[]; // Store original for cancel/restore
} | null>(null);
const [isEditingCableEndpoint, setIsEditingCableEndpoint] = useState(false);
const [cableEndpointEditPos, setCableEndpointEditPos] = useState<Point | null>(null);
const [cableEndpointSnapResult, setCableEndpointSnapResult] = useState<{
  snappedToId: string | null;
  snappedToType: 'equipment' | 'pvArray' | 'cableTray' | 'cable' | null;
  allTargets?: Array<{...}>;
  currentIndex?: number;
} | null>(null);
```

**2. Update keyboard handler for ESC key (around lines 216-246)**

Add handling for ESC to cancel endpoint editing:
```typescript
// Cancel cable endpoint editing
if (e.key === 'Escape' && selectedCableEndpoint) {
  e.preventDefault();
  if (isEditingCableEndpoint && selectedCableEndpoint.originalPoints) {
    // Restore original cable points
    setLines(prev => prev.map(line => 
      line.id === selectedCableEndpoint.cableId 
        ? { ...line, points: selectedCableEndpoint.originalPoints }
        : line
    ));
  }
  setSelectedCableEndpoint(null);
  setIsEditingCableEndpoint(false);
  setCableEndpointEditPos(null);
  setCableEndpointSnapResult(null);
}

// Tab cycling for endpoint editing (same as cable drawing)
if (e.key === 'Tab' && isEditingCableEndpoint) {
  e.preventDefault();
  flushSync(() => {
    setCableSnapCycleIndex(prev => prev + 1);
  });
}
```

**3. Update handleMouseDown for two-click workflow (around lines 1049-1078)**

Change from starting a drag to a two-stage click:
```typescript
// Stage 1: First click selects the endpoint
if (!selectedCableEndpoint) {
  // Check if clicking on an endpoint handle of a selected cable
  for (const cable of selectedCables) {
    const startPoint = cable.points[0];
    const endPoint = cable.points[cable.points.length - 1];
    
    if (distance(worldPos, startPoint) <= endpointHitRadius) {
      setSelectedCableEndpoint({
        cableId: cable.id,
        endpoint: 'start',
        originalPoints: [...cable.points],
      });
      return;
    }
    if (distance(worldPos, endPoint) <= endpointHitRadius) {
      setSelectedCableEndpoint({
        cableId: cable.id,
        endpoint: 'end',
        originalPoints: [...cable.points],
      });
      return;
    }
  }
}

// Stage 2: Second click starts the editing (attaches to cursor)
if (selectedCableEndpoint && !isEditingCableEndpoint) {
  const cable = lines.find(l => l.id === selectedCableEndpoint.cableId);
  if (cable) {
    // Start ghost editing mode
    setIsEditingCableEndpoint(true);
    setCableEndpointEditPos(worldPos);
    setCableSnapCycleIndex(0);
    return;
  }
}

// Stage 3: Third click commits the new position
if (isEditingCableEndpoint && cableEndpointEditPos) {
  // Commit the endpoint change (similar to current mouseUp logic)
  // ... commit logic ...
  // Reset all states
  setSelectedCableEndpoint(null);
  setIsEditingCableEndpoint(false);
  setCableEndpointEditPos(null);
  setCableEndpointSnapResult(null);
  return;
}
```

**4. Update handleMouseMove for ghost preview (around lines 1749-1777)**

Change from drag handling to passive mouse tracking during edit mode:
```typescript
// Handle cable endpoint editing with ghost preview
if (isEditingCableEndpoint && selectedCableEndpoint) {
  const cable = lines.find(l => l.id === selectedCableEndpoint.cableId);
  if (cable) {
    const cableType: CableType = cable.type;
    const snapResult = snapCablePointToTarget(
      worldPos,
      cableType,
      equipment,
      pvArrays,
      pvPanelConfig,
      roofMasks,
      scaleInfo,
      viewState,
      plantSetupConfig,
      placedCableTrays,
      lines.filter(l => l.id !== cable.id),
      undefined,
      cableSnapCycleIndex
    );
    
    setCableEndpointEditPos(snapResult.current.position);
    setCableEndpointSnapResult({
      snappedToId: snapResult.current.snappedToId || null,
      snappedToType: snapResult.current.snappedToType || null,
      allTargets: snapResult.allTargets,
      currentIndex: snapResult.currentIndex,
    });
  }
  // No return here - allow mouse tracking to continue for other purposes
}
```

**5. Update rendering for visual feedback (around lines 722-807)**

Update the endpoint handle rendering to show different states:
- **Selected (Stage 1)**: Highlighted handle with pulsing/glowing effect
- **Editing (Stage 2)**: Ghost cable preview from fixed points to cursor position

```typescript
// Draw endpoint handles with selection state
selectedCables.forEach(cable => {
  const isThisCableBeingEdited = selectedCableEndpoint?.cableId === cable.id;
  const editingStart = isThisCableBeingEdited && selectedCableEndpoint?.endpoint === 'start';
  const editingEnd = isThisCableBeingEdited && selectedCableEndpoint?.endpoint === 'end';
  
  // Draw selected endpoint with glow effect
  if (editingStart || editingEnd) {
    ctx.save();
    ctx.shadowBlur = 10 / viewState.zoom;
    ctx.shadowColor = cableColor;
    // ... draw glowing handle ...
    ctx.restore();
  }
  
  // Draw ghost cable line during edit mode
  if (isEditingCableEndpoint && cableEndpointEditPos) {
    ctx.beginPath();
    if (editingStart) {
      ctx.moveTo(cableEndpointEditPos.x, cableEndpointEditPos.y);
      for (let i = 1; i < cable.points.length; i++) {
        ctx.lineTo(cable.points[i].x, cable.points[i].y);
      }
    } else if (editingEnd) {
      ctx.moveTo(cable.points[0].x, cable.points[0].y);
      for (let i = 1; i < cable.points.length - 1; i++) {
        ctx.lineTo(cable.points[i].x, cable.points[i].y);
      }
      ctx.lineTo(cableEndpointEditPos.x, cableEndpointEditPos.y);
    }
    ctx.setLineDash([4 / viewState.zoom, 4 / viewState.zoom]);
    ctx.strokeStyle = cableColor;
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Draw snap indicator (same style as cable drawing)
    if (cableEndpointSnapResult?.snappedToId) {
      ctx.beginPath();
      ctx.arc(cableEndpointEditPos.x, cableEndpointEditPos.y, 12 / viewState.zoom, 0, Math.PI * 2);
      ctx.strokeStyle = cableColor;
      ctx.lineWidth = 3 / viewState.zoom;
      ctx.stroke();
      
      // Show Tab hint if multiple targets
      if (cableEndpointSnapResult.allTargets && cableEndpointSnapResult.allTargets.length > 1) {
        // Draw [Tab: X/Y - Target Name] label
      }
    }
  }
});
```

**6. Remove handleMouseUp endpoint logic (around lines 1992-2028)**

Remove the drag-completion logic since we now use click-to-commit instead.

---

### User Experience Flow

```text
1. Select a cable (click on it)
   - Endpoint handles appear at both ends

2. Click on an endpoint handle
   - Handle becomes highlighted (glowing)
   - Cursor changes to indicate "click to detach"

3. Click anywhere on canvas
   - Endpoint detaches and follows mouse
   - Ghost cable preview appears (dashed line)
   - Snap indicators appear when near valid targets
   - [Tab: X/Y - Target] overlay shows when multiple targets overlap

4. Press Tab to cycle through overlapping snap targets
   - Same behavior as drawing a new cable

5. Click to commit OR press ESC to cancel
   - Click: New endpoint position is saved
   - ESC: Original cable is restored
```

---

### Files Modified

| File | Changes |
|------|---------|
| `src/components/floor-plan/components/Canvas.tsx` | Replace drag-based state with click-based two-stage state; update mouse handlers; update rendering for ghost preview and snap indicators |

---

### Edge Cases Handled

1. **Clicking elsewhere to deselect**: If user clicks on canvas (not on handle) while endpoint is selected but not editing, deselect the endpoint
2. **Cancel with ESC**: Restores original cable points from stored `originalPoints`
3. **Tab cycling**: Works identically to cable drawing mode
4. **Shift+45-degree snapping**: Can be added if desired (currently not in scope)
5. **Selecting different cable**: Auto-cancels current endpoint edit

