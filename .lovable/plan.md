

## Enhance System Details: Remove Delete, Add Selectability & Main Board Hierarchy

### Overview
This plan modifies the **System Details** section in the `SummaryPanel.tsx` to:
1. Remove the delete option for inverters (keeping only visibility toggle)
2. Make inverters AND strings clickable to highlight them on the canvas
3. Add a new top-level "Main Board" hierarchy grouping inverters underneath

---

### Changes Summary

| Change | Description |
|--------|-------------|
| Remove inverter delete button | Remove the `<Button>` with `<Trash2>` icon from System Details inverter rows |
| Make strings selectable | Convert string rows from static `<div>` to clickable `<button>` that calls `onSelectItem(cable.id)` |
| Add Main Board hierarchy | Create a new nested structure: Main Board → Inverter → String |

---

### Technical Details

**File: `src/components/floor-plan/components/SummaryPanel.tsx`**

#### 1. Remove Delete Button for Inverters (lines 1698-1713)
Remove the entire delete button block from the System Details inverter section:

```typescript
// DELETE THIS BLOCK (lines 1698-1713)
{onDeleteItem && (
  <Button
    variant="ghost"
    size="icon"
    className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
    onClick={(e) => { ... onDeleteItem(inv.id) ... }}
    title="Delete inverter"
  >
    <Trash2 className="h-3 w-3" />
  </Button>
)}
```

#### 2. Make Strings Selectable (lines 1729-1737)
Transform the static string display into clickable elements:

```typescript
// BEFORE - static div
<div key={data.cable.id} className="flex items-center gap-2 text-xs py-1">
  <div className="w-2 h-0.5 bg-orange-500 rounded" />
  <span>String {strIdx + 1}</span>
  ...
</div>

// AFTER - clickable button with highlight state
<button
  key={data.cable.id}
  className={cn(
    "flex items-center gap-2 text-xs py-1 px-2 w-full rounded hover:bg-accent transition-colors text-left",
    (selectedItemId === data.cable.id || selectedItemIds?.has(data.cable.id))
      && "bg-primary/10 border border-primary"
  )}
  onClick={() => onSelectItem(data.cable.id)}
>
  <div className="w-2 h-0.5 bg-orange-500 rounded" />
  <span>String {strIdx + 1}</span>
  <span className="text-muted-foreground">-</span>
  <span>{data.panelCount}p</span>
  <span className="text-muted-foreground ml-auto">{data.powerKwp.toFixed(1)} kWp</span>
</button>
```

#### 3. Add Main Board Hierarchy (restructure lines 1599-1743)

Create a new helper function to find inverters connected to main boards via AC cables:

```typescript
// New helper - find inverters connected to a main board via AC cables
const getInvertersConnectedToMainBoard = (
  mainBoardId: string,
  mainBoardPosition: Point,
  inverters: EquipmentItem[],
  acCables: SupplyLine[],
  scaleInfo: ScaleInfo
): EquipmentItem[] => {
  if (!scaleInfo.ratio) return [];
  const thresholdPx = 1.0 / scaleInfo.ratio;
  
  // Find AC cables connected to this main board
  const mbConnectedCables = acCables.filter(cable => {
    if (cable.points.length === 0) return false;
    const startDist = Math.hypot(cable.points[0].x - mainBoardPosition.x, cable.points[0].y - mainBoardPosition.y);
    const endDist = Math.hypot(cable.points[cable.points.length - 1].x - mainBoardPosition.x, cable.points[cable.points.length - 1].y - mainBoardPosition.y);
    return startDist < thresholdPx || endDist < thresholdPx;
  });
  
  // Find inverters at the other end of these cables
  return inverters.filter(inv => {
    return mbConnectedCables.some(cable => {
      if (cable.points.length === 0) return false;
      const startDist = Math.hypot(cable.points[0].x - inv.position.x, cable.points[0].y - inv.position.y);
      const endDist = Math.hypot(cable.points[cable.points.length - 1].x - inv.position.x, cable.points[cable.points.length - 1].y - inv.position.y);
      return startDist < thresholdPx || endDist < thresholdPx;
    });
  });
};
```

Restructure the System Details rendering to:

```text
System Details
├── Main Board 1
│   ├── Inverter 1
│   │   ├── String 1 - 14p  8.6 kWp
│   │   └── String 2 - 14p  8.6 kWp
│   └── Inverter 2
│       └── String 1 - 14p  8.6 kWp
├── Main Board 2
│   └── Inverter 3
│       └── ...
└── Unassigned Inverters (if any not connected to a Main Board)
    └── Inverter N
```

---

### Result

After these changes:
- Inverters in System Details will **NOT** have a delete button (users must delete via canvas right-click or Summary Contents section)
- Clicking an inverter OR a string row will select and highlight it on the canvas
- System Details will be organized hierarchically: Main Board → Inverters → Strings

---

### Files to Modify

1. **`src/components/floor-plan/components/SummaryPanel.tsx`**
   - Add new helper function `getInvertersConnectedToMainBoard`
   - Restructure System Details section with Main Board hierarchy
   - Remove delete button from inverters
   - Make strings clickable with selection highlighting

