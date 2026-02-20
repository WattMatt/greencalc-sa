

## Fix: Sanitise Filenames Before Storage Upload

### Problem
The file "SM 4 [Kiosk ] Bulk meter .xlsx" fails to upload because square brackets (`[` and `]`) and spaces are invalid characters in storage keys. The upload code on line 537 of `ScadaImportWizard.tsx` uses the raw filename directly:

```
const path = `${projectId}/${Date.now()}_${f.name}`;
```

This causes an "Invalid key" error from storage for any filename containing special characters.

### Fix

**File: `src/components/projects/ScadaImportWizard.tsx` (line 537)**

Add a single line to sanitise the filename before building the storage path. Replace all characters that are not alphanumeric, hyphens, underscores, or dots with underscores:

```typescript
// Before:
const path = `${projectId}/${Date.now()}_${f.name}`;

// After:
const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g, '_');
const path = `${projectId}/${Date.now()}_${safeName}`;
```

This converts `SM 4 [Kiosk ] Bulk meter .xlsx` into `SM_4__Kiosk___Bulk_meter_.xlsx` for the storage key only. The original human-readable filename is still stored in the database record via `f.name` for display purposes.

### What This Does NOT Change
- The parsing logic -- the Excel file's date format (`08 Nov 2022 04:00`) is already supported by the existing text-based month name parser.
- The database record -- it still stores the original filename for display.
- Any other upload behaviour.

### Files Modified
- `src/components/projects/ScadaImportWizard.tsx` -- one line added to sanitise the filename before the storage upload call.

