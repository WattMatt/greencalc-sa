
## Add Min/Max/Average Envelope Chart with Year Range Filter

### What You Get

A new chart placed below the existing Load Profile chart showing:
- **Upper line**: Maximum kW per hour across all days in the selected year range
- **Lower line**: Minimum kW per hour across all days in the selected year range
- **Dotted middle line**: Average kW per hour
- **Shaded fill** between the upper and lower boundaries
- **Year range dropdowns**: `[From] to [To]` -- no labels, just the from dropdown, the word "to", and the to dropdown. Dropdowns are constrained to years present in the dataset.

### Architecture

```text
src/components/projects/load-profile/
  hooks/useEnvelopeData.ts       (NEW) - Computes min/max/avg per hour from raw_data
  charts/EnvelopeChart.tsx       (NEW) - Renders the shaded envelope chart
  index.tsx                      (EDIT) - Adds the EnvelopeChart below LoadChart
```

### Technical Details

#### 1. `hooks/useEnvelopeData.ts` (New)

- Reuses the existing `parseRawData` function pattern from `useSpecificDateData.ts`
- Iterates all tenants' `scada_imports.raw_data`, parsing each `RawDataPoint`
- Extracts available years from `date_range_start` / `date_range_end` (or from the actual data points)
- For each hour (0-23), across all days within the selected year range:
  - Sums all tenant kW values for that hour on each day (same as `useSpecificDateData` does for a single date)
  - Tracks the min, max, and running average of those daily totals per hour
- Returns: `{ envelopeData, availableYears, yearFrom, setYearFrom, yearTo, setYearTo }`
- `envelopeData` is an array of 24 objects: `{ hour, min, max, avg }`

#### 2. `charts/EnvelopeChart.tsx` (New)

- Uses Recharts `ComposedChart` with `Area` for the shaded region and `Line` for the dotted average
- The shaded fill uses an `Area` with `dataKey="max"` as upper bound and a second `Area` with `dataKey="min"` subtracted (using the Recharts stacking pattern where min is rendered as a transparent base area, and the gap between min and max is the visible shaded fill)
- Average line: dashed/dotted stroke style
- Year range controls rendered inline above the chart: two `<Select>` dropdowns with no labels, separated by the word "to"
- Follows existing chart styling conventions (same axis formatting, muted grid, 200px height)

#### 3. `index.tsx` (Edit)

- Import and render `EnvelopeChart` below the existing `LoadChart`, passing `tenants` and `displayUnit`/`powerFactor`
- The envelope chart is always visible when there is SCADA raw data (it self-hides if no raw data exists)

### Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/projects/load-profile/hooks/useEnvelopeData.ts` | Create |
| `src/components/projects/load-profile/charts/EnvelopeChart.tsx` | Create |
| `src/components/projects/load-profile/index.tsx` | Add EnvelopeChart below LoadChart |
