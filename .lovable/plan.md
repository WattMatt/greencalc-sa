
## Add Performance Log Content Block to Monthly Report

### What This Does
Adds the missing "Performance" tab from the Generation system summary as a new content block in the Monthly Report. This table shows per-source daily Yield Guarantee vs Metered Generation with colour-coded performance indicators.

### Changes Required

**1. Update `src/components/proposals/types.ts`**
- Add `'performanceLog'` to the `ContentBlockId` union type
- Add the new content block entry in the `DEFAULT_CONTENT_BLOCKS` array with `category: 'monthly_report'`, positioned after `financialYield` (order 6)
- Label: "Performance Log", Description: "Per-source daily yield guarantee vs metered generation with performance indicators"

**2. Add LaTeX snippet in `src/lib/latex/templates/monthlyReportSnippets.ts`**
- New function `performanceLog(data: MonthlyReportData)` that generates a longtable with:
  - One "Day" column on the left
  - Two sub-columns per source: "Yield Guarantee" and "Metered Gen"
  - A row for each day (1 to totalDays)
  - A totals row at the bottom
  - Since LaTeX cannot do dynamic cell background colours the same way React can, the Metered Gen cells will use conditional formatting commands: `\cellcolor{green!20}` for >100%, `\cellcolor{yellow!20}` for 95-100%, `\cellcolor{red!20}` for 50-95%, and plain for ≤50%
- Corresponding `performanceLogPlaceholder()` fallback

**3. Update `src/lib/latex/templates/proposalTemplate.ts`**
- Add a new case `"performanceLog"` in the `generateBlockContent` switch that routes to the new snippet functions (real data vs placeholder)

### Technical Details

The Performance table is source-aware -- it dynamically creates column pairs based on the number of generation sources. The data already exists in `MonthlyReportData.sourceDayMap` and `MonthlyReportData.sourceTotals`, so no changes to the data utility or hook are needed.

The colour-coding logic (from the Generation tab's Performance view):
- Green: actual/guarantee > 1.0 (over 100%)
- Yellow: actual/guarantee > 0.95 (95-100%)
- Red: actual/guarantee > 0.50 (50-95%)
- Grey/plain: actual/guarantee ≤ 0.50

LaTeX colour commands use the `xcolor` package (already loaded via `colortbl`/`table` option in the preamble) with percentage-based tinting for subtle backgrounds matching the UI.
