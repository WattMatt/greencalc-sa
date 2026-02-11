

## Add "Sources" Toggle Button to Performance Chart

### Overview
Add a new toggle button labeled "Sources" to the left of the existing "kWh" button. When active, the single yellow "Solar Generation" bar will split into stacked bars showing individual source contributions (e.g., "Parkdene Solar DB2.1", "Parkdene Solar DB3.1", etc.), each with a distinct color.

### Changes

**File: `src/components/projects/generation/PerformanceChart.tsx`**

1. **New state**: Add `const [showSources, setShowSources] = useState(false);`

2. **Fetch source column**: Update the query to also select the `source` field from `generation_readings`.

3. **Track distinct sources**: Extract unique source names from the readings data and assign each a color from a predefined palette (e.g., shades of yellow/gold/amber to stay in the solar color family).

4. **Build chart data with per-source columns**: When `showSources` is true, skip the aggregation step. Instead, build data points where each source gets its own key (e.g., `source_0`, `source_1`, etc.) containing that source's `actual_kwh` value. When `showSources` is false, keep the existing aggregated `actual` field.

5. **Dynamic chart config**: Extend `chartConfig` with entries for each source when `showSources` is active.

6. **Render multiple Bar components**: When `showSources` is true, render one `<Bar>` per source (stacked via `stackId="solar"`), replacing the single "Solar Generation" bar. When false, render the existing single bar as before.

7. **New button in header**: Add the "Sources" toggle button to the left of the "kWh" button:
   ```
   [Sources] [kWh] [Building] [All Hours | Sun Hours] [30 Min v]
   ```

### Technical Details

- Source colors will use a palette like: `["#f0e442", "#e6c619", "#d4a017", "#c2842a", "#b0683d", "#9e4c50"]` to differentiate sources while keeping a warm/solar tone.
- The per-source data keys will be sanitized versions of source names (e.g., `source_0`, `source_1`) mapped via an index, with a lookup array for display names.
- The stacked bars will all share `stackId="solar"` so they stack on top of each other, showing the total while revealing individual contributions.
- The "Building" toggle and "Council Demand" bar remain independent and unaffected.
- Unit conversion (kW/kWh) and sun-hour filtering apply to per-source values the same way as the aggregated value.
- Legend entries will show individual source names when in sources mode.

