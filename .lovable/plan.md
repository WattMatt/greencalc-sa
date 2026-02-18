

## Data Pipeline: Populate Monthly Report from Generation Tab

### Overview

The monthly report LaTeX snippets currently use hardcoded placeholders like `[GUARANTEE]`, `[METERED]`, etc. This plan creates a data-fetching utility that queries the same database tables used by the Generation tab's `PerformanceSummaryTable`, computes daily performance metrics, and passes them into the snippet generators so the LaTeX output contains real numbers.

### Architecture

The pipeline follows the project's "Calculation Firewall" pattern:

1. **Data layer** (`src/utils/monthlyReportData.ts`) -- Pure async function that fetches and computes all daily metrics for a given project/month/year
2. **Hook** (`src/hooks/useMonthlyReportData.ts`) -- TanStack Query wrapper that calls the data layer
3. **Snippet update** (`src/lib/latex/templates/monthlyReportSnippets.ts`) -- Accepts the computed data object instead of generating placeholders
4. **Wiring** (`src/components/proposals/ProposalWorkspaceInline.tsx` + `proposalTemplate.ts`) -- Extends `TemplateData` with monthly report data; adds month/year selector to the Monthly Report workspace

### Data Flow

```text
Database Tables                     Utility                          LaTeX Snippets
--------------------               -----------------------          --------------------------
generation_readings    ----+
generation_records     ----|
generation_source_     ----|----->  computeMonthlyReport()  ------>  executiveSummary(data)
  guarantees           ----|        returns MonthlyReportData        dailyPerformanceLog(data)
downtime_comments      ----|                                        operationalDowntime(data)
downtime_slot_overrides----|                                        financialYieldReport(data)
tariff_rates           ----+
```

### Step 1: Create `MonthlyReportData` type and computation utility

**New file: `src/utils/monthlyReportData.ts`**

Defines the `MonthlyReportData` interface:

```typescript
interface DailyMetrics {
  day: number;
  yieldGuarantee: number;      // kWh
  meteredGeneration: number;   // kWh
  downtimeEnergy: number;      // kWh
  theoreticalGeneration: number; // metered + downtimeEnergy
  surplusDeficit: number;      // metered - guarantee
}

interface SourceDayMetrics {
  downtimeEnergy: number;
  downtimeSlots: number;
}

interface MonthlyReportData {
  month: number;
  year: number;
  totalDays: number;
  dailyRows: DailyMetrics[];
  totals: { yieldGuarantee; meteredGeneration; downtimeEnergy; theoreticalGeneration; surplusDeficit };
  // Per-source downtime for the Operational Downtime table
  sourceLabels: string[];           // e.g. ["Tie-In 1", "Tie-In 2"]
  sourceDayMap: Map<string, SourceDayMetrics>;
  sourceTotals: Map<string, { downtimeEnergy: number; downtimeSlots: number }>;
  // Comments
  comments: Map<number, string>;    // day -> comment
  // Tariff rate for financial yield
  tariffRate: number;               // R/kWh
  // Monthly totals from generation_records
  monthlyGuarantee: number;
  monthlyActual: number;
}
```

The `computeMonthlyReportData(projectId, month, year)` function replicates the exact same query and computation logic from `PerformanceSummaryTable`:
- Paginated fetch of `generation_readings` for the month
- Fetch `generation_source_guarantees` with source classification
- Fetch `downtime_comments`
- Fetch `downtime_slot_overrides`
- Fetch tariff rate via project -> tariff_plans -> tariff_rates
- Filter out council meters
- Build guarantee map with the 3-tier mapping (explicit reading_source, direct label match, fallback distribution)
- Calculate downtime using the 06:00-17:30 sun-hour window with 0.05% threshold and consecutive-slot rule
- Apply slot overrides
- Return the fully computed `MonthlyReportData`

This is extracted from the existing `useMemo` logic in `PerformanceSummaryTable.tsx` (lines 218-453) into a standalone pure function.

### Step 2: Create TanStack Query hook

**New file: `src/hooks/useMonthlyReportData.ts`**

```typescript
export function useMonthlyReportData(projectId: string, month: number, year: number) {
  return useQuery({
    queryKey: ["monthly-report-data", projectId, year, month],
    queryFn: () => computeMonthlyReportData(projectId, month, year),
    enabled: !!projectId && month > 0 && year > 0,
  });
}
```

### Step 3: Update LaTeX snippet generators

**Modified file: `src/lib/latex/templates/monthlyReportSnippets.ts`**

Each function receives `MonthlyReportData` and populates real values:

- **`executiveSummary(data, project)`**: Populates `[ACTUAL_KWH]`, `[GUARANTEE_KWH]`, `[THEO_KWH]`, variance percentages, and `[MONTH_YEAR]`. Equipment table remains as placeholders (requires separate equipment data entry -- not in scope).

- **`dailyPerformanceLog(data)`**: Generates one row per day (up to `data.totalDays`), each with real values for Yield Guarantee, Metered, Down Time, Theoretical, Realised Consumption (metered -- retained as same value), and Surplus/Deficit. Includes a totals row.

- **`operationalDowntime(data)`**: Generates rows with per-source downtime energy and slots. Dynamically creates columns based on `data.sourceLabels` (not hardcoded to "Tie-In 1/2"). Includes the comment for each day.

- **`financialYieldReport(data)`**: Multiplies each metric by `data.tariffRate` and formats as Rand values.

All numeric formatting uses `toFixed(2)` with LaTeX-safe escaping.

### Step 4: Extend `TemplateData` and add month/year selector

**Modified file: `src/lib/latex/templates/proposalTemplate.ts`**

Add optional field to `TemplateData`:
```typescript
export interface TemplateData {
  // ... existing fields ...
  monthlyReportData?: MonthlyReportData;
}
```

Update `generateBlockContent` to pass `data.monthlyReportData` to the monthly snippet functions.

**Modified file: `src/components/proposals/ProposalWorkspaceInline.tsx`**

For `documentType === 'monthly_report'`:
- Add month/year state (defaulting to previous month)
- Add month/year `Select` dropdowns in the header area
- Call `useMonthlyReportData(projectId, month, year)`
- Include the result in `templateData.monthlyReportData`

### Step 5: Update `proposalTemplate.ts` block routing

Update the switch cases for monthly report blocks to pass the data through:

```typescript
case "executiveSummary":
  return data.monthlyReportData
    ? monthlySnippets.executiveSummary(data.monthlyReportData, data.project)
    : monthlySnippets.executiveSummaryPlaceholder(data.simulation, data.project);
case "dailyLog":
  return data.monthlyReportData
    ? monthlySnippets.dailyPerformanceLog(data.monthlyReportData)
    : monthlySnippets.dailyPerformanceLogPlaceholder();
// ... same pattern for operationalDowntime and financialYield
```

If no `monthlyReportData` is available (e.g. no generation data uploaded for that month), the functions fall back to the current placeholder output.

### Files Changed

| File | Action |
|------|--------|
| `src/utils/monthlyReportData.ts` | **New** -- computation utility |
| `src/hooks/useMonthlyReportData.ts` | **New** -- TanStack Query hook |
| `src/lib/latex/templates/monthlyReportSnippets.ts` | **Modified** -- accept real data |
| `src/lib/latex/templates/proposalTemplate.ts` | **Modified** -- extend TemplateData, update routing |
| `src/components/proposals/ProposalWorkspaceInline.tsx` | **Modified** -- add month/year selector, fetch data |

### No new dependencies required

All queries use the existing Supabase client and existing tables. The computation logic is extracted from `PerformanceSummaryTable.tsx`.

