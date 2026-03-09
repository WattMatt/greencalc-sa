

# Plan: Add PDB prefix column to Import from Library dialog

## What changes

1. **`src/utils/meterLabelParser.ts`** — Add a `prefix` field to `ParsedMeterLabel` that captures the first segment before the underscore (e.g. `"PDB"`) when the label follows the `PDB_<number>_...` pattern. Returns `null` for non-PDB labels.

2. **`src/components/projects/MeterLibraryImportDialog.tsx`**:
   - Add `prefix: string | null` to the `ParsedRow` interface, populated from the parser.
   - Add a narrow "Prefix" column to the table between the checkbox and Meter Label columns, displaying a `Badge` (e.g. `PDB`) when present, empty otherwise.
   - No changes to the creation logic — just a visual addition.

## No database changes needed
The prefix is derived from the meter label at display time only.

