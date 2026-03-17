
# Plan: Project-Level Tariff Overrides

## Status: ✅ Implemented

### What was done

1. **Database**: Created `project_tariff_overrides` table with RLS policies for authenticated users
2. **ProjectTariffEditor.tsx**: New modal component with editable rate inputs, save/reset functionality
3. **TariffSelector.tsx**: Added "Edit Rates" button and "Overridden" badge on selected tariff card
4. **useSimulationEngine.ts**: Queries `project_tariff_overrides` and merges overridden rates/charges into simulation pipeline
