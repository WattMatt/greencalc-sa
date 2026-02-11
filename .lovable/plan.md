

## Daily Performance Chart

### Overview
Replace the current monthly bar chart with a daily bar chart showing solar generation and building load as bars for each day, plus the guaranteed generation as a flat horizontal line across all days.

### What Changes

**1. New Database Table: `generation_daily_records`**
- Columns: `id`, `project_id`, `date` (DATE), `year`, `month`, `actual_kwh`, `building_load_kwh`, `source`
- Unique constraint on `(project_id, date)`
- RLS policies matching the existing `generation_records` table
- This stores the per-day breakdown from CSV uploads

**2. Modify CSV Parser Output**
- Update `CSVPreviewDialog` to return daily totals (`Map<string, number>` keyed by date string like `"2026-01-15"`) in addition to the existing monthly totals
- The `onParsed` callback signature changes to include daily data
- The `extractMonth` helper already parses dates; we extend it to return the full date

**3. Update ActualGenerationCard and BuildingLoadCard**
- After receiving parsed daily data, upsert rows into `generation_daily_records` (one row per day)
- Continue saving the monthly total to `generation_records` as before (backward compatible)

**4. Rewrite PerformanceChart**
- Query `generation_daily_records` for the selected month/year
- Build chart data: one entry per day (1-31) with `actual_kwh` and `building_load_kwh` bars
- Calculate daily guarantee as `guaranteed_kwh / days_in_month` and render as a `ReferenceLine` (horizontal line)
- X-axis labels: `1-Jan`, `2-Jan`, etc. (matching the reference image)
- Y-axis: Energy Generation (kWh)
- Legend: Generation (bars), Building Load (bars), Guarantee (line)
- Use recharts `ComposedChart` with `Bar` + `ReferenceLine`

### Technical Details

```text
generation_daily_records
+------------------+--------+
| column           | type   |
+------------------+--------+
| id               | uuid   |
| project_id       | uuid   |
| date             | date   |
| year             | int    |
| month            | int    |
| actual_kwh       | numeric|
| building_load_kwh| numeric|
| source           | text   |
| created_at       | timestamptz |
+------------------+--------+
UNIQUE(project_id, date)
```

**Data flow:**
1. User uploads CSV -> CSVPreviewDialog parses daily totals
2. Card component saves daily rows to `generation_daily_records` + monthly total to `generation_records`
3. PerformanceChart queries daily records and renders the daily bar chart
4. Guarantee line = `monthData.guaranteed_kwh / daysInMonth`

### Files to Create/Modify
- **New migration**: Create `generation_daily_records` table with RLS
- **`CSVPreviewDialog.tsx`**: Return daily Map alongside monthly Map
- **`ActualGenerationCard.tsx`**: Save daily records on CSV parse
- **`BuildingLoadCard.tsx`**: Save daily records on CSV parse
- **`PerformanceChart.tsx`**: Complete rewrite to daily ComposedChart with bars + ReferenceLine
- **`GenerationTab.tsx`**: Pass year to PerformanceChart for querying daily data

