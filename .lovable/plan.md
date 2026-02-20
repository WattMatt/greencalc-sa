

## Add CSV Import Button to Add Tenant Dialog

### What Changes
Add an "Import CSV" button inside the "Add Tenant" dialog header, next to the title. When clicked, it opens a file picker for `.csv` files. Once a file is selected, the dialog closes and the existing `TenantColumnMapper` opens for column assignment (Shop Number, Shop Name, Area) and bulk import.

### File: `src/components/projects/TenantManager.tsx`

1. **Add a `useRef<HTMLInputElement>`** for a hidden file input element.

2. **Add a hidden `<input type="file" accept=".csv">`** in the component body, wired to the ref.

3. **Update the `DialogHeader`** to use a flex layout with the "Add Tenant" title on the left and a small "Import CSV" button (with Upload icon) on the right.

4. **CSV file handler**: When a file is selected:
   - Read the file text content via `FileReader`
   - Split into lines, then split each line by comma
   - Extract headers from row 0, data rows from row 1+
   - Close the Add Tenant dialog (`setDialogOpen(false)`)
   - Set `columnMapperData` with parsed headers/rows
   - Open `columnMapperOpen` to show the existing `TenantColumnMapper`
   - Reset the file input value so the same file can be re-selected

No new files. No new dependencies. No database changes. The existing `TenantColumnMapper` and `handleMappedImport` handle everything from there.

