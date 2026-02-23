

## Unified Validated-Date Dataset for Load Profile and Envelope

### Problem
The Load Profile and Envelope charts each independently parse raw data, build per-tenant date maps, and filter for overlapping dates. This duplication means:
- Double the parsing work (slow)
- Potentially different validated date sets if logic drifts
- The user's requirement -- "build ONE dataset from overlapping dates, use it for both charts" -- isn't met

### Solution
Create a single shared hook (`useValidatedSiteData`) that:
1. For each meter, parses raw data and identifies dates with non-zero values
2. Finds the overlapping date range where ALL meters have valid data
3. Sums all meters at each time interval to produce a single site-level dataset: `Map<dateKey, number[24]>` (hourly kW totals per date)
4. Both the Load Profile and Envelope hooks consume this shared dataset instead of re-parsing raw data independently

### Technical Details

**New file: `src/components/projects/load-profile/hooks/useValidatedSiteData.ts`**

This hook does the heavy lifting once:
- Inputs: `tenants`, `rawDataMap`
- Pass 1: For each included tenant with raw SCADA data, call `parseRawData()`, group into `Map<tenantId, Map<dateKey, number[24]>>`, apply area scaling, average sub-hourly to hourly, discard outage days (< 75 kW daily total)
- Pass 2: Find dates where ALL SCADA tenants have valid data (the "overlapping" or "validated" dates)
- Pass 3: For each validated date, sum all tenants' hourly arrays into a single site-level hourly array
- Returns:
  - `siteDataByDate: Map<dateKey, number[24]>` -- the unified dataset
  - `validatedDateCount: number`
  - `tenantsWithScada: number`
  - `tenantsEstimated: number`
  - `availableYears: number[]`
  - `tenantKeys: Map<string, string>` -- for per-tenant breakdown in the stacked chart
  - `tenantDateMaps: Map<string, Map<string, number[]>>` -- for per-tenant breakdown
  - `nonScadaTenants: Tenant[]` -- for fallback handling

**Modified file: `src/components/projects/load-profile/hooks/useLoadProfileData.ts`**

- Import and consume `useValidatedSiteData` instead of building its own tenant date maps
- The `baseChartData` useMemo simplifies to:
  - Filter `siteDataByDate` by `selectedDays` (day-of-week filter)
  - Average across those filtered dates to get 24-hour profile
  - Add fallback tenant contributions on top (Priorities 2-4 unchanged)
  - Build per-tenant breakdown from `tenantDateMaps` for the stacked chart
- Remove the duplicated Pass 1 and Pass 2 logic (it now lives in the shared hook)
- `weekdayDailyKwh` / `weekendDailyKwh` also use the shared data

**Modified file: `src/components/projects/load-profile/hooks/useEnvelopeData.ts`**

- Import and consume `useValidatedSiteData` instead of parsing raw data independently
- The computation simplifies to:
  - Filter `siteDataByDate` by year range
  - Sweep each hour across all filtered dates for min/max/avg
  - Apply unit conversion
- Remove all raw data parsing, tenant iteration, and date validation logic
- Keep the deferred `setTimeout(0)` pattern since the min/max sweep is still moderately heavy
- Remove `availableYears` computation (comes from shared hook now)

**Modified file: `src/components/projects/load-profile/index.tsx`**

- Call `useValidatedSiteData` once and pass the result into both `useLoadProfileData` and `useEnvelopeData`
- Pass `availableYears` from the shared hook to `useEnvelopeData`
- No visual changes

### Data Flow

```text
Raw SCADA Data (rawDataMap)
        |
        v
useValidatedSiteData (single parse, single validation)
        |
        +---> siteDataByDate (Map<date, number[24]>)
        |         |
        |         +---> useLoadProfileData (filter by day-of-week, average, + fallbacks)
        |         |
        |         +---> useEnvelopeData (filter by year range, min/max/avg sweep)
        |
        +---> tenantDateMaps (for per-tenant stacked chart breakdown)
        +---> validatedDateCount, availableYears, tenant counts
```

### What Stays the Same
- `parseRawData` utility is unchanged
- PV, battery, grid flow calculations downstream are unchanged
- Export functions, annotations, TOU colouring remain
- The outage threshold (75 kW) stays
- Fallback logic (Priorities 2-4) stays in `useLoadProfileData`
- The deferred computation pattern stays in the envelope

### Performance Benefit
Raw data is parsed once instead of twice. The validated-date filtering runs once. Both charts derive from the same pre-computed site totals, guaranteeing numerical consistency.

