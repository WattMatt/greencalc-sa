
## Add Chart View Toggle: Load Envelope vs Individual Meters

### Overview
Add a toggle bar above the chart area that switches between two views:
1. **Load Envelope** (default) -- the existing min/max/avg band chart
2. **Individual Meters** -- a stacked area chart where each tenant with SCADA data gets its own coloured band, visually decomposing the "Max" line into per-tenant contributions

### How It Works

The per-tenant data already exists in `validatedSiteData.tenantDateMaps`. For the "Individual Meters" view, a new hook will compute the **maximum daily profile** for each tenant (the hourly values from the date with the highest daily total for that tenant, matching the selected day/month filters). These per-tenant max profiles are then stacked in the chart, so the top of the stack equals the site maximum.

### File Changes

**1. New file: `src/components/projects/load-profile/hooks/useStackedMeterData.ts`**
- Takes `validatedSiteData`, `selectedDays`, `selectedMonths`, `displayUnit`, `powerFactor`, `diversityFactor`, and year range as inputs
- For each tenant in `tenantDateMaps`:
  - Filter dates by selected days, months, and year range
  - For each hour, find the **maximum** value across all filtered dates (mirrors the envelope "Max" logic but per tenant)
- Returns an array of 24 data points, each containing `hour` and a key per tenant ID with that tenant's max value
- Also returns a colour map (tenant ID to a colour from a predefined palette)

**2. New file: `src/components/projects/load-profile/charts/StackedMeterChart.tsx`**
- Renders a Recharts `ComposedChart` with stacked `Area` components, one per tenant
- Each area uses a unique colour from the palette
- Includes TOU background bands (same as envelope chart)
- Tooltip shows each tenant's contribution at the hovered hour
- Reuses the same `syncId="loadProfileSync"` for cursor sync with other charts
- Includes a small legend showing tenant name + colour

**3. Edit: `src/components/projects/load-profile/charts/LoadEnvelopeChart.tsx`**
- Add a `viewMode` prop: `"envelope" | "stacked"`
- Add a segmented toggle (two small buttons) in the header row next to "Load Envelope" label
- When `viewMode === "stacked"`, render the new `StackedMeterChart` instead of the envelope chart
- Pass through all shared props (TOU, unit, year selectors, loading state)

**4. Edit: `src/components/projects/load-profile/index.tsx`**
- Add state: `const [chartViewMode, setChartViewMode] = useState<"envelope" | "stacked">("envelope")`
- Call `useStackedMeterData` hook (only computes when needed)
- Pass `chartViewMode`, stacked data, tenant key map, and colour map to `LoadEnvelopeChart`

### Technical Details

**Colour palette** -- a set of 20 distinguishable colours cycled for tenants:
```text
["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#3b82f6", "#84cc16", ...]
```

**Max profile calculation per tenant:**
```text
For tenant T, hour H:
  stackedValue[T][H] = max( T.dateMap[date][H] ) for all filtered dates
```

This mirrors how the envelope Max line works, but broken down by tenant so the stacked areas visually explain the composition of the peak.

**Toggle UI** -- two compact buttons ("Envelope" / "By Meter") placed in the chart header row, styled consistently with the existing kW/kVA toggle.
