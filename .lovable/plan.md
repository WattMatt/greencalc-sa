

## Down Time Tab: All Pending Changes

All of the following approved changes will be implemented in a single edit to `src/components/projects/generation/PerformanceSummaryTable.tsx` (lines 434-490):

### 1. Column Renames

| Current | New |
|---|---|
| `Slots` (line 447) | `30-Min Intervals` |
| `Production (kWh)` (line 450) | `Lost Production (kWh)` |
| `DT Slots` (line 451) | `30-Min Intervals` |

### 2. Value Changes

- **Lost Production column** (line 466): change `sd?.actual` to `sd?.downtimeEnergy`
- **Footer Lost Production** (line 483): change `st?.actual` to `st?.downtimeEnergy`

### 3. Visual Source Grouping

- Add `border-l` on the first sub-column of each source group so there's a clear vertical separator between Tie-In 1, Tie-In 2, Tie-In 3
- Source name headers already use `colSpan={2}` -- add `border-l` and `text-center` styling
- Apply alternating subtle background (`bg-muted/20`) on even-indexed source groups for extra clarity

### 4. Better Column Width Distribution

- Days column: `w-12` (keep compact)
- 30-Min Intervals (global): `min-w-[80px]`
- Each source sub-column: `min-w-[90px]`

All changes in one file: `src/components/projects/generation/PerformanceSummaryTable.tsx`, lines 434-490.

