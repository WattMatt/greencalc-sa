

## Project-Level Tariff Overrides

**Goal**: Allow editing tariff rate values within a project without modifying the source tariff records in the `tariff_plans`/`tariff_rates` tables.

### Approach: Local override stored in a new `project_tariff_overrides` table

**Database**:
- Create a `project_tariff_overrides` table with columns:
  - `id` (uuid, PK)
  - `project_id` (uuid, FK to projects)
  - `source_tariff_plan_id` (uuid, FK to tariff_plans — the original tariff)
  - `overridden_rates` (jsonb — array of rate objects with `charge`, `season`, `tou`, `amount`, etc.)
  - `overridden_plan_fields` (jsonb — optional overrides for plan-level fields like fixed charge, demand charge)
  - `created_at`, `updated_at`
  - Unique constraint on `(project_id, source_tariff_plan_id)`
- RLS: authenticated users can CRUD

**UI Changes** (in `TariffSelector.tsx` or a new `ProjectTariffEditor` component):
- Add an "Edit Rates" button on the selected tariff card within the project view
- Opens an inline editor or modal showing all the tariff's rates (energy rates by season/TOU, basic charge, demand charge) as editable inputs
- "Save Override" persists to `project_tariff_overrides`; "Reset to Original" deletes the override row
- Visual indicator (badge/icon) when overrides are active

**Data Flow Changes** (in `useSimulationEngine.ts` and `TariffSelector.tsx`):
- After fetching the tariff and its rates from `tariff_plans`/`tariff_rates`, check `project_tariff_overrides` for the current project
- If overrides exist, merge them on top of the DB rates before passing to the simulation engine and blended rate calculations
- This keeps all downstream logic (8760 engine, financial analysis, blended rates) working with the overridden values without any additional changes

### Files to create/modify

1. **New DB migration** — Create `project_tariff_overrides` table with RLS
2. **New component**: `src/components/projects/ProjectTariffEditor.tsx` — Editable rate table with save/reset
3. **Modify**: `src/components/projects/simulation/useSimulationEngine.ts` — Query overrides, merge with base rates
4. **Modify**: `src/components/projects/TariffSelector.tsx` — Show "Edit Rates" button, override indicator badge
5. **Modify**: `src/pages/ProjectDetail.tsx` — Wire up override state if needed

### Technical Details

The `overridden_rates` JSONB stores the full set of rate rows (same shape as `tariff_rates`). On load, if an override exists, the override rates replace the DB rates entirely — this avoids complex per-field merging and makes the editor straightforward (user sees and edits all rates).

The merge logic in `useSimulationEngine.ts` (~line 322-366):
```
const { data: overrides } = useQuery(["tariff-overrides", project.id, project.tariff_id], ...)
const effectiveRates = overrides?.overridden_rates ?? tariffRates
```

