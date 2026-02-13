

## Fix Chart Legends, "csv" Source, Column Separators, and Table Layout

### 1. Chart Legend Labels: Use Guarantee Display Names + Tooltip with Original File Source

**Problem:** The chart legend shows raw CSV source names like `31190 - Parkdene Solar Checkers` instead of the user-friendly guarantee labels (e.g., "Tie-In 1").

**Fix in `PerformanceChart.tsx`:**
- Query `generation_source_guarantees` for the current project/month/year to build a `displayNameMap` (same logic as `PerformanceSummaryTable.tsx`)
- In `activeChartConfig`, use the mapped display name as the label and store the original CSV source for tooltip
- In the custom single-day legend and the Recharts `Legend`, wrap each source label in a Tooltip component showing "Source: 31190 - Parkdene Solar Checkers" on hover while displaying "Tie-In 1" as the visible text

### 2. The "csv" Legend Label — Explanation and Fix

**Cause:** Some `generation_readings` rows have `source = 'csv'`. This happens when data was uploaded before per-source tracking was implemented — the upload code defaults to `"csv"` when no source label exists. This creates a 4th bar in the chart with a "csv" legend entry.

**Fix:** Two options:
- **Data fix (recommended):** Update the stale rows: `UPDATE generation_readings SET source = NULL WHERE source = 'csv' AND project_id = '...'` — or reassign them to the correct source. This can be surfaced to the user.
- **Code fix:** In `PerformanceChart.tsx`, filter out or merge readings where `source === 'csv'` into the aggregated total, so they don't appear as a separate bar in Sources mode. The chart's `sourceLabels` extraction (line 121-126) will skip `'csv'` entries, and their kWh values will be summed into the non-source aggregated view instead.

I will implement the code fix: skip `'csv'` from per-source breakdown and aggregate it into the total. Additionally, inform the user about the stale data.

### 3. Column Separator Lines on All Tables

**Problem:** Only the Down Time tab has `border-l` separators. The Production, Revenue, and Performance tabs lack visual column separators.

**Fix:** Add `border-l` to column groups in:
- **Production tab** (lines 399-442): Add `border-l` between major column groups (Yield Guarantee, Metered Gen, Down Time kWh, Theoretical Gen, Surplus/Deficit)
- **Revenue tab** (lines 514-567): Add `border-l` between each revenue column
- **Performance tab** (lines 571-639): Add `border-l` to each source group header and sub-columns (same pattern as Down Time tab), plus alternating `bg-muted/20`

### 4. Better Column Width Distribution Across All Tables

**Fix:** Standardize column widths:
- Days column: `w-12` across all tabs
- Numeric columns: `min-w-[100px]` for single-value columns, `min-w-[90px]` for source sub-columns
- Remove the overly wide `w-40` on the Days column in Revenue and Performance tabs

### Technical Details

**Files to modify:**

**`src/components/projects/generation/PerformanceChart.tsx`:**
- Add query for `generation_source_guarantees` to get display name mappings
- Update `activeChartConfig` (lines 370-380) to use display names as labels
- Filter `'csv'` from `sourceLabels` (lines 121-126)
- Add Tooltip wrapper around legend items in single-day legend (lines 569-585) showing original CSV source on hover
- Import Tooltip components

**`src/components/projects/generation/PerformanceSummaryTable.tsx`:**
- **Production tab** (lines 399-442): Add `border-l` to columns after Days
- **Revenue tab** (lines 514-567): Add `border-l` to columns after Days, fix `w-40` to `w-12`
- **Performance tab** (lines 571-639): Add `border-l` and alternating `bg-muted/20` to source group headers and sub-columns, fix `w-40` to `w-12`
