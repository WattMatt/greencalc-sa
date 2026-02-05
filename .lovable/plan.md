

## Fix: Show Configuration Parameters for Multi-Selected Objects with Same Values

### Problem
When right-clicking on a single PV array, the configuration modal correctly shows the Rows, Columns, and Orientation values. However, when selecting multiple PV arrays that all have the **same** configuration values, the modal shows empty placeholders instead of pre-populating the shared values.

### Root Cause
In `FloorPlanMarkup.tsx`, the `handleContextMenuOpen` function (lines 1731-1834) only extracts properties when exactly one object is selected:

```typescript
// Line 1785-1786: Only extracts properties for single selection
if (objectIds.length === 1) {
  switch (objectType) {
    case 'pvArray': {
      const arr = pvArrays.find(a => a.id === objectIds[0]);
      if (arr) {
        currentProps = { rows: arr.rows, columns: arr.columns, orientation: arr.orientation };
        // ...
      }
      break;
    }
    // ... other cases
  }
}
```

For multi-selections, it only checks if the `configId` is uniform, but ignores the actual property values (rows, columns, orientation).

---

### Solution
Extend the multi-selection logic to also extract and compare properties. If all selected objects of the same type share identical property values, pre-populate those values in the modal.

**File: `src/components/floor-plan/FloorPlanMarkup.tsx`**

Modify the `handleContextMenuOpen` function to:

1. For multi-selected PV arrays, collect all rows, columns, and orientation values
2. If all values are identical across the selection, populate `currentProps` with those values
3. If values differ, leave them undefined (showing placeholders)

---

### Technical Changes

**Lines ~1763-1783** - Add property extraction for multi-selected PV arrays:

```typescript
case 'pvArray':
  const pvProps: { rows: number[]; columns: number[]; orientations: string[] } = {
    rows: [], columns: [], orientations: []
  };
  objectIds.forEach(id => {
    const arr = pvArrays.find(a => a.id === id);
    if (arr) {
      configIds.push(arr.moduleConfigId);
      pvProps.rows.push(arr.rows);
      pvProps.columns.push(arr.columns);
      pvProps.orientations.push(arr.orientation);
    }
  });
  // Check if all properties are uniform
  const uniqueRows = [...new Set(pvProps.rows)];
  const uniqueCols = [...new Set(pvProps.columns)];
  const uniqueOrients = [...new Set(pvProps.orientations)];
  if (uniqueRows.length === 1 && uniqueCols.length === 1 && uniqueOrients.length === 1) {
    currentProps = {
      rows: uniqueRows[0],
      columns: uniqueCols[0],
      orientation: uniqueOrients[0] as PanelOrientation
    };
  }
  break;
```

Apply similar logic for other object types:
- **Walkways**: Extract and compare `length` values
- **Cable Trays**: Extract and compare `length` and `cableType` values
- **Inverters**: Extract and compare `name` values

---

### Expected Result

| Scenario | Before | After |
|----------|--------|-------|
| 13 PV arrays with same rows/cols/orientation | Empty placeholders | Pre-populated with shared values |
| 13 PV arrays with different rows/cols | Empty placeholders | Empty placeholders (correct) |
| 1 PV array selected | Pre-populated values | Pre-populated values (unchanged) |

The modal will show:
- **Shared values**: Pre-populated in the inputs
- **Mixed values**: Empty placeholders with the option to set a new value for all

---

### Files to Modify

1. **`src/components/floor-plan/FloorPlanMarkup.tsx`** - Extend `handleContextMenuOpen` to extract properties for multi-selections when values are uniform

