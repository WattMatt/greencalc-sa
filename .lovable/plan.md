

## Remove Envelope Clamping and Add Mode Toggle

### Problem
The `useEnvelopeData` hook currently clamps max/min values so they never cross the average line (`Math.max(rawMax, avgVal)` / `Math.min(rawMin, avgVal)`). This masks data issues rather than showing actual percentile values. Instead, the Envelope view should expose the same **Avg / Max / Min** toggle that exists on the "By Meter" view, allowing users to select which profile to display.

### Changes

#### 1. Remove clamping in `useEnvelopeData.ts`
- Revert the `Math.min` / `Math.max` clamping on lines 198-199 back to raw values:
  - `min: rawMin` (not `Math.min(rawMin, avgVal)`)
  - `max: rawMax` (not `Math.max(rawMax, avgVal)`)

#### 2. Show mode toggle for Envelope view in `LoadEnvelopeChart.tsx`
- Move the **Avg / Max / Min** `ToggleGroup` so it also appears when `viewMode === "envelope"` (currently it only renders when `viewMode === "stacked"`)
- Position it to the right of the Envelope / By Meter toggle, matching the existing layout

#### 3. Wire the mode toggle to the Envelope chart rendering
- When in **Avg** mode: show the full envelope (band + max/min lines + dashed avg) as it works today
- When in **Max** mode: show only the max (99th percentile) line as a solid line
- When in **Min** mode: show only the min (1st percentile) line as a solid line
- This mirrors how the "By Meter" stacked chart already switches between avg/max/min

### Technical Details

**`useEnvelopeData.ts`** (line ~198-199):
```typescript
// Before (clamped):
min: Math.min(rawMin, avgVal),
max: Math.max(rawMax, avgVal),

// After (raw values):
min: rawMin,
max: rawMax,
```

**`LoadEnvelopeChart.tsx`** (line ~97):
- Change the condition `viewMode === "stacked"` to `true` (or remove the condition) so the Avg/Max/Min toggle is always visible
- Conditionally render chart series based on the active mode:
  - `avg`: render Area band + max line + min line + avg dashed line (current default)
  - `max`: render only max solid line
  - `min`: render only min solid line

**`index.tsx`**: No changes needed -- `stackedMode` and `onStackedModeChange` are already passed through.

