

## Consolidate: Remove Dead `BulkMeterImport.tsx`

### What We Found

- **`BulkCsvDropzone.tsx`** is the active component, used in both `SitesTab.tsx` and `MeterLibrary.tsx`. It auto-detects columns, stores pre-processed `[{timestamp, value}]` data, and handles fuzzy meter matching.
- **`BulkMeterImport.tsx`** is **dead code** -- it is imported in `SitesTab.tsx` but never rendered. No component in the entire codebase actually uses `<BulkMeterImport />`.

There is no reason to have two files. The old one (`BulkMeterImport`) was superseded by the newer, smarter `BulkCsvDropzone` but was never cleaned up.

### Changes

| File | Change |
|------|--------|
| `src/components/loadprofiles/BulkMeterImport.tsx` | **Delete entirely** -- unused dead code |
| `src/components/loadprofiles/SitesTab.tsx` | Remove the unused `import { BulkMeterImport }` line |
| `src/components/code-review/ProjectFileBrowser.tsx` | Remove the `BulkMeterImport.tsx` entry from the file tree listing |

### What Stays

`BulkCsvDropzone.tsx` remains as the single bulk import component. It already:
- Auto-detects delimiters, PnP SCADA format, and column types
- Stores pre-processed `[{timestamp, value}]` arrays (your column selections are baked in)
- Matches files to existing meters using fuzzy matching
- Supports drag-and-drop for multiple files

No parsing logic changes needed -- this is purely removing 814 lines of dead code.

