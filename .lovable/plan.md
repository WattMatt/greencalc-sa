
## Incorporate WM-tariffs Features into Tariff Management Dashboard

### Overview

Three features from the WM-tariffs project will be adapted to work with this project's NERSA-compliant schema (`tariff_plans` + `tariff_rates`).

---

### Feature 1: Tariff Period Comparison Charts

**What it does:** A dialog with bar charts showing how charges (basic, energy, demand) change across tariff periods, with YoY trend indicators (percentage change, average annual increase).

**Challenge:** The current `tariff_plans` table has no `effective_from`/`effective_to` date columns. WM-tariffs uses these to group tariffs by period. Without date columns, period comparison is not possible.

**Implementation:**

1. **Database migration** -- Add two nullable columns to `tariff_plans`:
   - `effective_from DATE` (nullable, defaults to NULL)
   - `effective_to DATE` (nullable, defaults to NULL)

2. **New component** -- `src/components/tariffs/TariffPeriodComparisonDialog.tsx`
   - Adapted from WM-tariffs but queries `tariff_rates` (charge, season, tou, amount) instead of `tariff_charges`
   - Accepts a tariff name + municipality ID; fetches all `tariff_plans` with matching name, grouped by `effective_from`
   - Bar chart (Recharts) with a charge-type selector dropdown (Basic Charge, Energy - Low Season, Energy - High Season, Demand - Low Season, Demand - High Season)
   - Trend indicators: total % change and average YoY % using `TrendingUp`/`TrendingDown` icons
   - Requires at least 2 periods to display

3. **Integration** -- Add a "Compare Periods" button in `TariffList.tsx` (municipality preview dialog or inline), visible when 2+ tariff plans share the same name within a municipality

---

### Feature 2: Multi-Period Support per Tariff Name

**What it does:** Allows multiple tariff records with the same name but different effective date ranges (e.g., "Domestic Conventional" for 2023/24 and 2024/25).

**Implementation:**

1. **Uses the same migration** from Feature 1 (the `effective_from`/`effective_to` columns)

2. **Update TariffEditDialog** -- Add `effective_from` and `effective_to` date input fields to the tariff edit form

3. **Update AI extraction prompt** -- Modify the `process-tariff-file` edge function's extraction prompt to also extract effective dates when present in the document. Map to the new columns on insert.

4. **Update TariffList display** -- When a municipality has multiple tariffs with the same name, show a period badge (e.g., "Jul 2024 - Jun 2025") next to the tariff name. Group them visually.

5. **Update TariffBuilder** -- Add optional effective date fields to the manual tariff creation form.

---

### Feature 3: Extraction Progress Stepper

**What it does:** A visual stepper bar at the top of the extraction workflow showing progress through 4 stages: Upload > AI Extraction > Review > Save.

**Implementation:**

1. **New component** -- `src/components/tariffs/ExtractionSteps.tsx`
   - Adapted directly from WM-tariffs
   - Steps: "Upload File", "AI Extraction", "Review Data", "Save to Database"
   - Uses `CheckCircle2` (complete), `Loader2` (active/spinning), `Circle` (upcoming) icons
   - Connected horizontal progress lines between steps (filled = complete, muted = pending)

2. **Integration into FileUploadImport.tsx** -- Map the existing `phase` state (1/2/3) and sub-states to stepper steps:
   - Phase 1 (file selection/upload) = "upload" step active
   - Phase 2 (analysing/extracting municipalities) = "extract" step active
   - Phase 3 (reviewing extracted tariffs) = "review" step active
   - After successful save = "save"/"complete" step
   - Render `<ExtractionSteps>` at the top of the dialog content, above the current phase content

---

### Technical Details

#### Database Migration

```text
ALTER TABLE tariff_plans
  ADD COLUMN effective_from DATE,
  ADD COLUMN effective_to DATE;
```

#### Files to Create

| File | Description |
|---|---|
| `src/components/tariffs/ExtractionSteps.tsx` | Visual stepper component (4 steps with icons and connecting lines) |
| `src/components/tariffs/TariffPeriodComparisonDialog.tsx` | Bar chart dialog for comparing charge amounts across periods |

#### Files to Modify

| File | Change |
|---|---|
| `src/components/tariffs/TariffList.tsx` | Add "Compare Periods" button; show period badges for multi-period tariffs |
| `src/components/tariffs/TariffEditDialog.tsx` | Add effective_from/effective_to date inputs |
| `src/components/tariffs/FileUploadImport.tsx` | Integrate ExtractionSteps at top of dialog; map phase state to step names |
| `supabase/functions/process-tariff-file/index.ts` | Update AI extraction prompt to extract effective dates; include in insert payload |

#### Sequencing

1. Database migration (add columns) -- required first
2. ExtractionSteps component -- standalone, no dependencies
3. TariffPeriodComparisonDialog -- depends on migration
4. UI integrations (TariffList, TariffEditDialog, FileUploadImport, edge function) -- depends on all above
