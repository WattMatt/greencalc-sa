

## Combine Load Profile and Envelope into a Single "Load Envelope" Chart

### What Changes

Replace the two separate charts (Load Profile + Envelope) with a single combined chart called **Load Envelope** that shows:
- The min/max shaded band (envelope area)
- The min and max boundary lines
- The average dashed line
- TOU colour bars in the background
- A unified tooltip showing Max, Avg, Min values plus the TOU period badge

### File Changes

**1. New file: `src/components/projects/load-profile/charts/LoadEnvelopeChart.tsx`**
- A single `ComposedChart` combining elements from both `LoadChart` and `EnvelopeChart`
- TOU `ReferenceArea` bands from `LoadChart` (conditional on `showTOU` prop)
- Stacked area trick (transparent base + filled band) from `EnvelopeChart`
- Min/Max solid lines and Avg dashed line from `EnvelopeChart`
- Combined tooltip: hour label, TOU badge, Max/Avg/Min values
- Year range selectors in the header (from `EnvelopeChart`)
- Loading spinner state
- Title: "Load Envelope"

**2. Edit: `src/components/projects/load-profile/index.tsx`**
- Remove the `<LoadChart>` render (line 282)
- Remove the `<EnvelopeChart>` render (lines 284-293)
- Replace with a single `<LoadEnvelopeChart>` that receives:
  - `envelopeData`, `availableYears`, `yearFrom`, `yearTo`, `setYearFrom`, `setYearTo` (from envelope hook)
  - `showTOU`, `isWeekend`, `unit`, `isLoading` (from existing state)
- Update imports accordingly

**3. Delete or leave unused: `LoadChart.tsx` and `EnvelopeChart.tsx`**
- These become unused after the merge. They can be removed to keep the codebase clean.

### Technical Details

The combined chart component will:
- Use the envelope data (24 hourly points with min/max/avg) as its primary dataset
- Transform it into `{ hour, base, band, avg, min, max }` (same as current EnvelopeChart)
- Render TOU `ReferenceArea` blocks behind the data (same logic as current LoadChart)
- The tooltip will show the TOU period badge alongside Max/Avg/Min values
- The `syncId="loadProfileSync"` is preserved for synchronisation with Solar/Grid/Battery charts
- Year range selectors remain in the chart header area

### What Stays the Same
- All data hooks (`useEnvelopeData`, `useLoadProfileData`) remain untouched
- Solar, Grid Flow, and Battery charts are unaffected
- ChartStats, export handlers, and all other UI components unchanged
- TOULegend component continues to work as before

