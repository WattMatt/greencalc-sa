
## Restore Unified Envelope Chart (Min + Max + Avg on Single Graph)

### What Changes
Combine all three series back into a single unified envelope view:
- **Shaded band** between min and max (using stacked Area: base + band)
- **Solid boundary lines** for min and max edges
- **Dashed average line** through the middle
- **Unified tooltip** showing Max, Avg, and Min values together with the TOU period badge

### Technical Details

**File: `LoadEnvelopeChart.tsx`**

1. **Remove the Avg/Max/Min toggle group** (lines 103-122) -- no longer needed since all three are shown simultaneously.

2. **Remove `stackedMode` and `onStackedModeChange` props** from the interface and destructuring (can remain optional for backward compatibility but won't be used in envelope view).

3. **Replace the three conditional `<Line>` blocks** (lines 238-246) with the unified envelope rendering:
   - `<Area>` for `base` (invisible, transparent -- acts as baseline)
   - `<Area>` for `band` (shaded fill using the existing `envelopeFill` gradient, stacked on base)
   - `<Line>` for `max` (solid boundary, primary colour, thin)
   - `<Line>` for `min` (solid boundary, primary colour, thin)
   - `<Line>` for `avg` (dashed, primary colour, slightly thicker)

4. **Update the tooltip** (lines 215-232) to show all three values:
   ```
   Max: 123.4 kW
   Avg: 100.2 kW
   Min:  80.1 kW
   ```

### Props Cleanup
- The `stackedMode` / `onStackedModeChange` props can remain on the interface for the "By Meter" stacked view but won't render the toggle when in envelope mode.
