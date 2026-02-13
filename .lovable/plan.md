

# Add Tab Structure: Production, Down Time, Revenue, Performance

## Overview

Rename the existing "Daily Performance" tab to "Production" and add three new tabs: "Down Time", "Revenue", and "Performance". Each tab displays a different view of the daily generation data, matching the reference spreadsheets provided.

## Tab Definitions

### 1. Production (renamed from "Daily Performance")
Existing table, no changes to content. Columns stay the same:
- Days, Yield Guarantee, Metered Generation, Down Time kWh (06:00-17:30), Theoretical Generation, Surplus / Deficit

### 2. Down Time (reference: image-489)
Shows downtime broken down per source/tie-in. Columns:
- **Days** (1-31)
- **Down Time Between 06:00 And 18:00** (total downtime slots for the day)
- Then **per source/tie-in** columns: Daily Production (kWh), Downtime Slots count
- **Comment** (placeholder, empty for now)

Footer row with Grand Totals.

### 3. Revenue (reference: image-490)
Financial view using the project's assigned tariff rate. Columns:
- **Days** (with day-of-week and date, e.g. "Thu 01/01/2026")
- **Yield Guarantee** (R) = daily guarantee kWh x tariff rate
- **Metered Generation** (R) = daily metered kWh x tariff rate
- **Down Time Between 06:00 And 18:00** (R) = downtime kWh x tariff rate
- **Theoretical Generation** (R) = theoretical kWh x tariff rate
- **Over Production** (R) = max(0, metered - guarantee) x tariff rate
- **Realised Consumption** (R) = same as Theoretical Generation (R) (energy the client "consumed" from solar)
- **Guaranteed Generation Actual** (R) = Metered - Yield Guarantee (surplus/deficit in Rand)

The tariff rate is fetched from the `tariff_rates` table using the project's `tariff_id`. For this project it is a flat rate (R1.42/kWh). For TOU tariffs, rates would need to be applied per time period -- but since the current project uses a fixed rate, the initial implementation will use the single flat rate.

Footer row with Grand Totals.

### 4. Performance (reference: image-491)
Per-source/tie-in performance breakdown. Columns:
- **Days** (with day-of-week and date)
- Then **per source/tie-in** pair of columns: **Yield Guarantee** (source daily guarantee), **Metered Generation** (source daily actual)
- Color coding: green for days meeting/exceeding guarantee, amber/red for underperformance

Footer row with Grand Totals.

## Technical Details

### File Changes

**`src/components/projects/generation/PerformanceSummaryTable.tsx`** -- single file, all changes here:

1. Update `TABS` constant:
```typescript
const TABS = ["Production", "Down Time", "Revenue", "Performance"] as const;
```

2. Update the `activeTab === "Daily Performance"` check to `activeTab === "Production"`.

3. Extend daily data computation to also track **per-source daily values** (needed for Down Time and Performance tabs). The existing `readingLookup` and `dayMap` already exist -- add a parallel `sourceDay` map keyed by `${day}-${source}` storing `{ actual, downtimeSlots, downtimeEnergy, guarantee }`.

4. Add a query to fetch the project's tariff rate:
   - Fetch project `tariff_id` from `projects` table
   - Fetch `rate_per_kwh` from `tariff_rates` where `tariff_id` matches
   - Use the flat rate for all Revenue calculations (fallback: three-tier lookup for TOU tariffs using season/time_of_use)

5. Add three new conditional render blocks for each tab, each with its own `<Table>` structure matching the reference layouts.

6. For the **Revenue** tab, format values with "R" prefix using `toLocaleString("en-ZA")`.

7. For the **Performance** tab, apply conditional cell background colors:
   - Green: metered >= guarantee
   - Amber/Yellow: metered >= 50% of guarantee
   - Red: metered < 50% of guarantee

### Data Flow

All four tabs share the same underlying data queries (generation_readings, source_guarantees). The only new query is for the tariff rate (needed by Revenue tab). The per-source daily breakdown is computed in the same `useMemo` that produces `dailyRows`.

### No Database Changes Required

All data needed already exists in the database. The tariff rate lookup uses existing tables (`projects.tariff_id` -> `tariff_rates.rate_per_kwh`).

