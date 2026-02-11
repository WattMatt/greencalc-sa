

# System Summary: Daily Performance Table with Worksheet Tabs

## Overview
Add a daily performance table to the System Summary pane that mirrors the spreadsheet shown in the reference image. The pane will feature a Google Sheets-style tab bar at the top to switch between different summary views (starting with "Daily Performance" as the first tab, with placeholders for future tabs).

## Data Source
The table will query the `generation_readings` table (which has `actual_kwh`, `building_load_kwh` per timestamp) and the `generation_records` table (which has the monthly `guaranteed_kwh`). Data will be aggregated per day to compute the columns shown.

## Table Columns (matching reference image)

| Column | Source / Calculation |
|--------|---------------------|
| Days | Date from grouped readings |
| Yield Guarantee | `monthly guaranteed_kwh / days in month` (constant per day) |
| Metered Generation | Sum of `actual_kwh` for that day |
| Down Time Between 06:00 And 18:00 | Sum of `actual_kwh` where value is 0 or null during sun hours (theoretical minus actual during those periods) |
| Theoretical Generation | `Yield Guarantee` (daily share, representing expected output) |
| Over Production | `max(0, Metered Generation - Theoretical Generation)` |
| Realised Consumption | Same as Metered Generation (energy actually delivered) |
| Actual Guaranteed Generation Surplus/Deficit | `Metered Generation - Yield Guarantee` |

A totals row at the bottom will sum each column for the month.

## UI Design

### Worksheet-style Tab Bar
- Positioned at the top of the Card, below the title
- Small, flat tabs styled like Google Sheets worksheet tabs (compact, bottom-border highlight on active)
- First tab: **"Daily Performance"** (active)
- Future placeholder tabs can be added later

### Table
- Compact, dense table using the existing `Table` component
- Alternating row colors for readability
- Totals row at the bottom with bold styling and a colored background (similar to the green row in the reference)
- Numbers formatted with locale-aware comma separators
- Negative surplus/deficit values shown in a distinct color

## Technical Details

### File: `src/components/projects/generation/PerformanceSummaryTable.tsx`
- Accept `projectId`, `month`, `year`, and `monthData` as props
- Add a `useQuery` hook to fetch all `generation_readings` for the selected month
- Aggregate readings into daily rows using `useMemo`
- Add state for the active worksheet tab
- Render the worksheet tab bar and the daily performance table
- Include a horizontal scroll wrapper for the wide table

### File: `src/components/projects/generation/GenerationTab.tsx`
- Update the `PerformanceSummaryTable` usage to pass `projectId`, `month`, and `year` as additional props
