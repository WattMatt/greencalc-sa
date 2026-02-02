

# Fix: Minimum Spacing Not Applied When Placing Walkways

## Problem

Looking at the user's screenshot, the walkways are being placed edge-to-edge with **zero gap** between them, even though minimum spacing functionality should be enforced. The PlacementOptionsModal shows "Min Spacing: 0.0m" in the preview area.

## Root Cause

The `snapMaterialToSpacing` function in `geometry.ts` has an early exit condition (line 522-525):

```typescript
// If not force-aligning and no spacing configured, allow free placement
if (!forceAlign && minSpacingMeters <= 0) {
  return { position: mousePos, rotation: ghostConfig.rotation, snappedToId: null };
}
```

**When `minSpacingMeters = 0`, the snapping algorithm exits immediately without enforcing any spacing.**

This means:
1. User opens PlacementOptionsModal with default spacing of 0.3m
2. User (possibly accidentally) sets spacing to 0.0m or clears the input
3. User clicks "Ready to Place"
4. All subsequent walkway placements have NO snapping protection

Additionally, the snapping logic is designed to be **reactive** (only activates when items are getting too close) rather than **proactive** (always maintaining minimum distance). This is fine for preventing overlaps but doesn't help when the configured spacing is 0.

## Solution

### Option A: Enforce Minimum Threshold (Recommended)

Prevent the user from setting minSpacing below a reasonable threshold (e.g., 0.05m = 5cm):

**File: `src/components/floor-plan/components/PlacementOptionsModal.tsx`**

```typescript
const handleConfirm = () => {
  onConfirm({
    orientation,
    minSpacing: Math.max(0.05, spacingNum), // Enforce minimum 5cm
  });
};
```

Or add validation in the DimensionInput:

```typescript
const handleValueChange = (inputValue: string) => {
  setDisplayValue(inputValue);
  const numericValue = parseFloat(inputValue);
  if (!isNaN(numericValue)) {
    const meters = displayToMeters(numericValue, unit);
    onChange(Math.max(0, meters)); // Already allows 0
  }
};
```

### Option B: Always Allow Snapping for Alignment (Even at 0 Spacing)

Modify the snapping algorithm to still snap for alignment purposes even when minSpacing is 0:

**File: `src/components/floor-plan/utils/geometry.ts`**

Change lines 522-525:

```typescript
// BEFORE
if (!forceAlign && minSpacingMeters <= 0) {
  return { position: mousePos, rotation: ghostConfig.rotation, snappedToId: null };
}

// AFTER - Remove this early exit, let snapping still work for alignment
// (snapping will just enforce 0 gap, which is edge-to-edge)
```

This allows snapping behavior to still work for alignment (matching rotations, grid alignment) even when the user explicitly sets 0 spacing.

### Option C: Add Visual Warning for 0 Spacing

Add a warning in the PlacementOptionsModal when spacing is 0:

```typescript
{spacingNum === 0 && (
  <p className="text-xs text-amber-600">
    Warning: Items will be placed edge-to-edge without gap.
  </p>
)}
```

## Recommended Implementation

Combine **Option A** (enforce minimum threshold) with **Option C** (visual warning):

1. Set a minimum enforced spacing of **0.05m (5cm)** to ensure there's always some gap
2. If user tries to set below this, clamp the value and show a note
3. This matches real-world requirements (maintenance access, thermal expansion, etc.)

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/floor-plan/components/PlacementOptionsModal.tsx` | Enforce minimum spacing threshold of 0.05m, add validation message |
| `src/components/floor-plan/components/DimensionInput.tsx` | (Optional) Add `min` prop for enforcing minimum values |
| `src/components/floor-plan/utils/geometry.ts` | (Optional) Remove early-exit for 0 spacing to allow alignment snapping |

## Expected Behavior After Fix

1. **PlacementOptionsModal**: Default remains 0.3m, minimum enforced at 0.05m
2. **Validation**: If user enters 0 or negative, value clamps to 0.05m with visual feedback
3. **Snapping**: Always activates when items are within threshold distance
4. **Edge-to-edge placement**: No longer possible - minimum 5cm gap enforced

