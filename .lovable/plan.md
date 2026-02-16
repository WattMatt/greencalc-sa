

## Add Lifetime Performance Overview Chart

### What It Does

A new chart placed between the month/year selector row and the three summary cards. It shows the system's performance across all recorded months, with:

- **Blue bars**: Guaranteed Generation (kWh)
- **Yellow bars**: Actual Production (kWh)
- **Dashed line (right Y-axis)**: Cumulative Performance % (running actual / running guaranteed x 100)
- **X-axis ticks**: "Jan-25", "Feb-26", etc.
- **Year filter dropdown**: "All", "2025", "2026", etc. (derived from available data)
- **Data table below chart**: Rows for Guarantee, Production, Monthly %, and Cumulative %

### Layout

```text
[Month selector + Sync SCADA button]
[NEW: Lifetime Performance Overview]    <-- inserted here
[Actual Gen | Guaranteed Gen | Council Demand cards]
[System Performance chart (existing)]
[System Summary table (existing)]
```

### Technical Details

**New file: `src/components/projects/generation/LifetimePerformanceChart.tsx`**

- Props: `projectId: string`
- Queries all `generation_records` for the project (no month/year filter)
- State: `yearFilter` ("all" | specific year)
- Year options derived from distinct years in the fetched data
- Data sorted chronologically, filtered by selected year
- Computes per-month %: `actual / guaranteed x 100`
- Computes cumulative %: `runningActual / runningGuaranteed x 100`
- Uses `ComposedChart` from recharts with two `Bar` components and one `Line` component
- Left Y-axis: kWh with "K" suffix formatting for thousands
- Right Y-axis: 0-100% for cumulative line
- Horizontal scroll table below for monthly breakdown
- Card wrapper with title "Lifetime Performance Overview" and year filter in the header

**Modified file: `src/components/projects/generation/GenerationTab.tsx`**

- Import and render `<LifetimePerformanceChart projectId={projectId} />` between the SyncScadaDialog and the cards grid (after line 128, before line 130)

### No Database Changes

All data already exists in the `generation_records` table. The query simply fetches all rows for the project without month/year filters.

