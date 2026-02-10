

# Add "Generation" Tab After Documents

## Overview

Add a "Generation" tab as the last tab (after Documents) in the project detail page. It will track monthly kWh data from two sources:

1. **Actual kWh** -- from CSV upload or manual entry (real inverter/meter readings)
2. **Guaranteed kWh** -- manually entered monthly contractual guarantee values
3. **Forecasted kWh** -- placeholder only (coming later)

A performance chart and summary table will compare actual vs guaranteed, with the forecasted column greyed out as "coming soon."

## Database

### New table: `generation_records`

One row per project per month per year:

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| project_id | UUID FK | References projects, CASCADE delete |
| month | INTEGER | 1-12 |
| year | INTEGER | e.g. 2026 |
| actual_kwh | NUMERIC, nullable | From CSV or manual |
| guaranteed_kwh | NUMERIC, nullable | Contractual target |
| expected_kwh | NUMERIC, nullable | Placeholder for future |
| source | TEXT | 'csv' or 'manual' |
| created_at / updated_at | TIMESTAMPTZ | |

Unique constraint on (project_id, month, year). RLS for authenticated users.

## New Components

All in `src/components/projects/generation/`:

- **GenerationTab.tsx** -- Main container with year selector, the three cards, chart, and table
- **ActualGenerationCard.tsx** -- CSV upload + 12 monthly manual inputs for actual kWh
- **GuaranteedGenerationCard.tsx** -- 12 monthly manual inputs for guaranteed kWh
- **ExpectedGenerationCard.tsx** -- Placeholder card saying "Forecasted generation -- coming soon"
- **PerformanceChart.tsx** -- Recharts bar/line chart comparing actual vs guaranteed (expected greyed out)
- **PerformanceSummaryTable.tsx** -- Monthly table with actual, guaranteed, expected (greyed), and performance ratios

## Changes to ProjectDetail.tsx

- Add `generation` entry to `tabStatuses` (pending if no data, partial if some months, complete if all 12 months have actual data)
- Add `TabWithStatus` for "Generation" with `TrendingUp` icon **after** the Documents tab
- Add `TabsContent` for "generation" rendering `GenerationTab` with `projectId` prop

## Tab Placement

The tab order will be:
Overview, Tenants, Load Profile, Costs, Tariff, Simulation, PV Layout, Solar Forecast, Proposals, Reports, Schedule, Documents, **Generation**

