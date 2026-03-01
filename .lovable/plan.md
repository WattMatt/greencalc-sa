

## Generation Tab Code Review and Optimisation

### Issues Found

**1. Heavy Code Duplication: ActualGenerationCard and BuildingLoadCard**

These two files are ~90% identical (314 vs 322 lines). The only differences are:
- Column name: `actual_kwh` vs `building_load_kwh`
- Card title and icon
- Council meter type flag on source guarantees
- Slightly different reading upsert logic (BuildingLoadCard preserves `actual_kwh` when upserting)

**Fix:** Extract a shared `GenerationDataCard` component that accepts a `dataType: "solar" | "council"` prop. All save, reset, and CSV upload logic is parameterised by this single flag. Reduces ~640 lines to ~350.

---

**2. Duplicate `MonthData` Interface (4 files)**

The `MonthData` interface is independently defined in `ActualGenerationCard.tsx`, `BuildingLoadCard.tsx`, `GuaranteedGenerationCard.tsx`, `PerformanceChart.tsx`, and `PerformanceSummaryTable.tsx` — each with slightly different fields. Some include `building_load_kwh`, others do not.

**Fix:** Define a single canonical `MonthData` type in `GenerationTab.tsx` (which already has the superset) and export it. All child components import from there.

---

**3. Duplicate Paginated Readings Fetch (2 components)**

Both `PerformanceChart.tsx` (line 87-111) and `PerformanceSummaryTable.tsx` (line 144-167) independently paginate through `generation_readings` with identical logic. For a month with 30-min intervals across multiple sources, this can be 5,000+ rows fetched twice.

**Fix:** Create a shared `useGenerationReadings(projectId, year, month)` hook that handles the paginated fetch. Both components consume the same cached query via TanStack Query (same query key = single fetch).

---

**4. Duplicate CSV Parsing Utilities (3 locations)**

`extractDateInfo`, `extractTimestamp`, `timeDiffMinutes`, and `strip` are duplicated across:
- `CSVPreviewDialog.tsx` (lines 40-74)
- `csvUtils.ts` (lines 35-121)  
- `supabase/functions/upload-generation-csv/index.ts` (lines 14-43)

**Fix:** Consolidate into `csvUtils.ts` as the single source of truth. Import from there in `CSVPreviewDialog.tsx`. The edge function copy is acceptable (Deno can't import from `src/`).

---

**5. Unused Import: `parseCSVFiles`**

Both `ActualGenerationCard.tsx` (line 8) and `BuildingLoadCard.tsx` (line 8) import `parseCSVFiles` from `csvUtils.ts`, but neither calls it — the `CSVPreviewDialog` handles all parsing now.

**Fix:** Remove the unused imports. Evaluate whether `csvUtils.ts`'s `parseCSVFiles` function itself is still used anywhere; if not, mark it as legacy or remove.

---

**6. Stale Date Filter in PerformanceChart**

`dateStart` and `dateEnd` are initialised from `startDate`/`endDate` (derived from `month`/`year`), but when the user changes month or year via the parent selectors, these state values are never reset. The chart shows stale data until the user manually adjusts the date inputs.

**Fix:** Add a `useEffect` that resets `dateStart` and `dateEnd` whenever `startDate` or `endDate` changes.

---

**7. PerformanceChart.tsx is 656 Lines**

Chart data aggregation (lines 223-300), Y-axis max calculation (lines 338-398), and per-source reading aggregation (lines 164-200) are all inline. This makes the component hard to maintain.

**Fix:** Extract:
- `useChartAggregation(readings, timeframe, showSources, ...)` — returns `chartData`
- `useYAxisMax(filteredReadings, timeframe, ...)` — returns `yAxisMax`
- Move helper functions (`parseLocal`, `formatTimeLabel`, `daysInMonth`) to a shared `generationUtils.ts`

---

**8. PerformanceSummaryTable.tsx is 776 Lines**

The main `useMemo` (lines 218-439) contains ~220 lines of downtime calculation, source mapping, and reading aggregation. Four tab renders are all inline.

**Fix:** Extract:
- `useDailyPerformanceData(readings, sourceGuarantees, ...)` — returns `dailyRows`, `sourceDayMap`, etc.
- Optionally extract each tab's table into a sub-component (`ProductionTab`, `DownTimeTab`, `RevenueTab`, `PerformanceTab`)

---

**9. N+1 Database Writes in CSV Save**

`saveCSVTotals` in both cards performs individual `upsert` calls inside loops — one per month, one per daily record, plus batch inserts for readings. For a 3-month CSV with 90 daily records, this is ~100 sequential DB calls.

**Fix:** Batch the monthly and daily upserts where possible. For daily records, collect all upsert payloads and use a single `.upsert()` call with an array. For monthly records (typically 1-3), the overhead is minor but can still be batched.

---

### Proposed File Changes

| File | Action |
|---|---|
| `GenerationTab.tsx` | Export `MonthData` type; remove duplicate interface from children |
| `ActualGenerationCard.tsx` | Replace with thin wrapper around new `GenerationDataCard` |
| `BuildingLoadCard.tsx` | Replace with thin wrapper around new `GenerationDataCard` |
| `GenerationDataCard.tsx` | **New** — unified card component parameterised by `dataType` |
| `hooks/useGenerationReadings.ts` | **New** — shared paginated readings fetch hook |
| `generationUtils.ts` | **New** — shared helpers (`parseLocal`, `formatTimeLabel`, `daysInMonth`, etc.) |
| `csvUtils.ts` | Add missing exports (`extractDateInfo`, `extractTimestamp`, `strip`); remove or mark `parseCSVFiles` as legacy |
| `CSVPreviewDialog.tsx` | Import parsing utils from `csvUtils.ts` instead of inline |
| `PerformanceChart.tsx` | Use shared readings hook; extract aggregation logic; add date filter reset effect |
| `PerformanceSummaryTable.tsx` | Use shared readings hook; extract daily performance computation |

### Priority Order

1. Fix stale date filter (quick, high-impact bug fix)
2. Remove unused `parseCSVFiles` imports
3. Consolidate `MonthData` type
4. Create shared readings hook (eliminates duplicate fetches)
5. Unify ActualGenerationCard + BuildingLoadCard
6. Extract chart aggregation logic
7. Extract summary table computation logic
8. Batch DB writes in CSV save

### Estimated Impact

- ~400 lines of duplicated code removed
- One fewer redundant network fetch per page load
- Stale date filter bug fixed
- Clearer separation of calculation logic from UI (per project conventions)

