
# Add Unit Selection to Distance/Length Inputs

## Overview
Update all modals and forms in the floor-plan components to use the `DimensionInput` component for distance/length inputs, allowing users to select between meters (m), centimeters (cm), and millimeters (mm).

---

## Summary of Changes

The `DimensionInput` component already exists and is used in `PlantSetupModal.tsx` for module and equipment dimensions. This same component should be used consistently across all distance/length inputs in:

1. **PlacementOptionsModal.tsx** - Minimum Spacing field
2. **ScaleModal.tsx** - Real-world distance field  
3. **PVArrayModal.tsx** - Minimum Spacing Between Arrays field

---

## Technical Implementation

### File: `src/components/floor-plan/components/PlacementOptionsModal.tsx`

**Current Implementation (lines 129-142):**
```typescript
<div className="space-y-2">
  <Label htmlFor="placement-spacing">Minimum Spacing (m)</Label>
  <Input
    id="placement-spacing"
    type="number"
    min="0"
    max="10"
    step="0.1"
    value={minSpacing}
    onChange={(e) => setMinSpacing(e.target.value)}
  />
  <p className="text-xs text-muted-foreground">
    Minimum gap between placed items for maintenance access.
  </p>
</div>
```

**Changes:**
1. Import `DimensionInput` component
2. Change state from `string` to `number` for minSpacing
3. Replace `<Input>` with `<DimensionInput>` component

**New Implementation:**
```typescript
import { DimensionInput } from './DimensionInput';

// State change
const [minSpacing, setMinSpacing] = useState<number>(defaultMinSpacing);

// JSX change
<div className="space-y-2">
  <DimensionInput
    label="Minimum Spacing"
    value={minSpacing}
    onChange={setMinSpacing}
  />
  <p className="text-xs text-muted-foreground">
    Minimum gap between placed items for maintenance access.
  </p>
</div>
```

### File: `src/components/floor-plan/components/ScaleModal.tsx`

**Current Implementation (lines 44-56):**
```typescript
<div className="space-y-2">
  <Label htmlFor="distance">Real-world distance (meters)</Label>
  <Input
    id="distance"
    type="number"
    step="0.01"
    min="0.01"
    placeholder="e.g., 10.5"
    value={realDistance}
    onChange={(e) => setRealDistance(e.target.value)}
    onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
    autoFocus
  />
</div>
```

**Changes:**
1. Import `DimensionInput` component
2. Change state from `string` to `number` for realDistance
3. Replace `<Input>` with `<DimensionInput>` component
4. The component always stores/returns values in meters, so the logic remains the same

**New Implementation:**
```typescript
import { DimensionInput } from './DimensionInput';

// State change
const [realDistance, setRealDistance] = useState<number>(0);

// JSX change
<div className="space-y-2">
  <DimensionInput
    label="Real-world distance"
    value={realDistance}
    onChange={setRealDistance}
  />
</div>
```

Note: Need to handle keyboard Enter support and autofocus - may need to extend DimensionInput or add wrapper.

### File: `src/components/floor-plan/components/PVArrayModal.tsx`

**Current Implementation (lines 147-161):**
```typescript
<div className="space-y-2">
  <Label htmlFor="minSpacing">Minimum Spacing Between Arrays (m)</Label>
  <Input
    id="minSpacing"
    type="number"
    min="0"
    max="10"
    step="0.1"
    value={minSpacing}
    onChange={(e) => setMinSpacing(e.target.value)}
  />
  <p className="text-xs text-muted-foreground">
    Minimum gap between array groups for walkways and maintenance access.
  </p>
</div>
```

**Changes:**
1. Import `DimensionInput` component
2. Change state from `string` to `number` for minSpacing
3. Replace `<Input>` with `<DimensionInput>` component

**New Implementation:**
```typescript
import { DimensionInput } from './DimensionInput';

// State change
const [minSpacing, setMinSpacing] = useState<number>(0.5);

// JSX change
<div className="space-y-2">
  <DimensionInput
    label="Minimum Spacing Between Arrays"
    value={minSpacing}
    onChange={setMinSpacing}
  />
  <p className="text-xs text-muted-foreground">
    Minimum gap between array groups for walkways and maintenance access.
  </p>
</div>
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/floor-plan/components/PlacementOptionsModal.tsx` | Replace spacing input with DimensionInput |
| `src/components/floor-plan/components/ScaleModal.tsx` | Replace distance input with DimensionInput |
| `src/components/floor-plan/components/PVArrayModal.tsx` | Replace spacing input with DimensionInput |

---

## State Changes Summary

| Modal | Field | Before | After |
|-------|-------|--------|-------|
| PlacementOptionsModal | minSpacing | `useState<string>('0.3')` | `useState<number>(0.3)` |
| ScaleModal | realDistance | `useState<string>('')` | `useState<number>(0)` |
| PVArrayModal | minSpacing | `useState<string>('0.5')` | `useState<number>(0.5)` |

All values continue to be stored and returned in meters (the DimensionInput component handles unit conversion internally).

---

## Visual Changes

**Before (PlacementOptionsModal):**
```
Minimum Spacing (m)
┌─────────────────────────────┐
│ 0.3                         │
└─────────────────────────────┘
```

**After (PlacementOptionsModal):**
```
Minimum Spacing
┌─────────────────────┬──────┐
│ 0.3                 │ m  ▼ │
└─────────────────────┴──────┘
```

The dropdown allows selecting: m, cm, mm

---

## Implementation Order

1. **PlacementOptionsModal.tsx** - Add DimensionInput for minimum spacing
2. **PVArrayModal.tsx** - Add DimensionInput for array spacing
3. **ScaleModal.tsx** - Add DimensionInput for scale distance

