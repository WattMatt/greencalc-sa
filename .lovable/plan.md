

# Fix TOU Bar Clipping and Coverage

## Issues
1. **Left Y-axis clipping**: The first TOU bar extends into the Y-axis area
2. **First bar overflows left**: Hour 0's bar extends past the start of the X-axis
3. **Last bar doesn't reach end**: Hour 23's bar stops short of the X-axis endpoint

## Changes

**File**: `src/components/projects/load-profile/utils/touReferenceAreas.tsx`

### 1. Move bars down slightly
Increase `barY` offset from `+2` to `+4` to add more clearance below the axis line.

### 2. Clip first bar (hour 0) to half-width
For hour 0, set `x = cx` (no left offset) and `width = bandSize / 2`, so the bar only extends rightward from the tick centre -- not past the axis origin.

### 3. Add trailing half-bar for hour 23
After hour 23, add an extra rect from `cx + bandSize/2` extending another `bandSize/2` to the right, using the same colour as hour 23. This fills the gap to the end of the axis.

### Technical Detail
All changes are confined to the `TOUBarsLayer` function. The loop logic becomes:

```text
for h = 0..23:
  if h == 0:  x = cx,               width = bandSize / 2    (right half only)
  else:       x = cx - bandSize / 2, width = bandSize        (full width)

  if h == 23: also render extra rect at cx + bandSize/2, width = bandSize / 2
```

No other files need changes.

