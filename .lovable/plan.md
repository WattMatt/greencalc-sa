

## Fix: Capture Cable Connections During Placement

### Problem Analysis
The current implementation calculates which PV array a string (DC cable) is connected to by using distance-based proximity matching in `SummaryPanel.tsx`. This is fragile and error-prone because:

1. The `SupplyLine` interface already has `from` and `to` fields for storing connected object IDs
2. During cable placement, the snap logic already knows exactly what the cable is connected to (`snapResult.current.snappedToId`)
3. However, this connection information is **never stored** when the cable is created

### Solution
Capture the `snappedToId` at both the start and end of cable drawing, then store these in the `from`/`to` fields when the cable is created.

---

### Technical Changes

**File: `src/components/floor-plan/components/Canvas.tsx`**

#### 1. Add State to Track Start Connection
Add a ref or state to capture what the cable's first point snapped to:

```typescript
// Track what the cable start point snapped to
const [cableStartConnection, setCableStartConnection] = useState<{
  id: string | null;
  type: 'equipment' | 'pvArray' | 'cableTray' | 'cable' | null;
} | null>(null);
```

#### 2. Capture Start Connection on First Click
When the first point of a cable is placed, capture the snap target:

```typescript
// When placing the first point of a cable
if (currentDrawing.length === 0 && snapResult.current.snappedToId) {
  setCableStartConnection({
    id: snapResult.current.snappedToId,
    type: snapResult.current.snappedToType
  });
}
```

#### 3. Store Connections When Cable is Completed
Update both cable creation locations (~line 170 and ~line 1243) to include `from` and `to`:

```typescript
const newLine: SupplyLine = {
  id: `line-${Date.now()}`,
  name: cableConfig?.name || `${cableType === 'dc' ? 'DC' : 'AC'} Cable`,
  type: cableType,
  points: [...currentDrawing, snappedPos],
  length: calculateLineLength([...currentDrawing, snappedPos], scaleInfo.ratio),
  configId: cableConfig?.id,
  thickness: cableConfig?.diameter,
  material: cableConfig?.material,
  from: cableStartConnection?.id || undefined,  // Start connection
  to: snapResult.current.snappedToId || undefined,  // End connection
};
```

#### 4. Reset Start Connection When Drawing Completes/Cancels
Clear the start connection state:

```typescript
setCableStartConnection(null);
setCurrentDrawing([]);
```

---

**File: `src/components/floor-plan/components/SummaryPanel.tsx`**

#### 5. Simplify String-to-PV-Array Association
Replace the complex `getPVArrayForString` distance calculation with a direct lookup:

```typescript
// BEFORE - complex distance calculation
const getPVArrayForString = (...) => { /* 50+ lines of distance math */ };

// AFTER - simple direct lookup
const getPVArrayIdForString = (cable: SupplyLine): string | null => {
  // DC cables have from/to storing the connected object IDs
  // One end connects to inverter, other end connects to PV array
  if (cable.from) {
    const fromArray = pvArrays.find(a => a.id === cable.from);
    if (fromArray) return cable.from;
  }
  if (cable.to) {
    const toArray = pvArrays.find(a => a.id === cable.to);
    if (toArray) return cable.to;
  }
  return null;
};
```

#### 6. Update String Data Collection
Simplify the string data collection to use the direct lookup:

```typescript
inverterStrings.forEach(cable => {
  const pvArrayId = getPVArrayIdForString(cable);
  if (pvArrayId) {
    const pvArray = pvArrays.find(a => a.id === pvArrayId);
    if (pvArray) {
      const panels = pvArray.rows * pvArray.columns;
      const powerKwp = (panels * (pvPanelConfig?.wattage || 0)) / 1000;
      totalPanels += panels;
      totalDcCapacityKw += powerKwp;
      stringData.push({ cable, panelCount: panels, powerKwp, pvArrayId });
    }
  } else {
    stringData.push({ cable, panelCount: 0, powerKwp: 0, pvArrayId: null });
  }
});
```

---

### Migration for Existing Cables
Existing cables without `from`/`to` fields will fall back to showing `pvArrayId: null` until they are re-drawn. Optionally, we could add a one-time migration helper that uses the old distance logic to populate missing connections, but this is not critical for new cables.

---

### Benefits

| Aspect | Before | After |
|--------|--------|-------|
| Accuracy | Proximity-based (can match wrong array) | Exact connection stored at creation |
| Performance | O(n) distance calculations per cable | O(1) direct lookup |
| Reliability | Breaks if objects move | Connection persists regardless of movement |
| Code complexity | 60+ lines of geometry | 10 lines of simple lookup |

---

### Files to Modify

1. **`src/components/floor-plan/components/Canvas.tsx`**
   - Add state to track cable start connection
   - Capture start connection when first point is placed
   - Store `from`/`to` when cable is completed
   - Reset state on drawing complete/cancel

2. **`src/components/floor-plan/components/SummaryPanel.tsx`**
   - Replace `getPVArrayForString` with simple direct lookup using `cable.from`/`cable.to`
   - Simplify string data collection logic

