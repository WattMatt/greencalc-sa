
# Shift TOU Bars Left by Half a Bar Width

## Problem
The first TOU bar at hour 0 is a half-width bar starting at the tick centre. The user wants to remove this half-bar and instead shift the entire series left by half a `bandSize`, so each bar is centred between tick marks rather than on them.

## Change

**File**: `src/components/projects/load-profile/utils/touReferenceAreas.tsx`

Update the loop in `TOUBarsLayer`:

1. **Remove the special `h === 0` half-bar logic** -- all bars get the same width (`bandSize`).
2. **Shift every bar left by an additional `bandSize / 2`**, so each bar starts one full `bandSize` to the left of the tick centre (i.e. `x = cx - bandSize`). This effectively positions each bar from `[tick - bandSize, tick]` instead of `[tick - bandSize/2, tick + bandSize/2]`.
3. **Remove the trailing half-bar after hour 23** since the shift already aligns the series correctly -- the last bar (hour 23) will now end at its tick centre, reaching the visual end of the axis.

### Resulting logic
```text
for h = 0..23:
  x = cx - bandSize      // shifted left by half a bar
  width = bandSize        // uniform width, no special cases
```

No trailing bar, no first-bar special case. One file, ~10 lines changed.
