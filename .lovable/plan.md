

## Allow Creating Clean (Blank Canvas) Schematics

### What Changes

The "Upload Schematic" button and dialog will be updated so that file upload is optional. When no file is attached, the schematic is created as a blank canvas.

### UI Changes

1. **Top-right button**: Stays as "+ Upload Schematic" (this opens the dialog).
2. **Empty state button**: Same -- opens the dialog.
3. **Dialog title**: Changes from "Upload Schematic Diagram" to "Create Schematic Diagram" with updated subtitle "Create a blank canvas or upload a diagram (PDF, PNG, JPG, SVG)".
4. **Submit button text** (bottom of dialog):
   - No file selected: **"Clean Schematic"**
   - File selected: **"Upload Schematic"**
5. **File upload area**: Remains as-is but is no longer required. The `disabled={!selectedFile}` guard on the submit button is removed.

### Database Change

A migration to make `file_path` and `file_type` nullable on `project_schematics`, since clean schematics have no uploaded file:

```sql
ALTER TABLE public.project_schematics
  ALTER COLUMN file_path DROP NOT NULL,
  ALTER COLUMN file_type DROP NOT NULL;
```

### Logic Changes (SchematicsTab.tsx)

1. **`handleSubmit`**: If `selectedFile` is null, insert a record with `file_path: null` and `file_type: 'canvas'` (or null). Skip the storage upload and PDF conversion steps.
2. **Delete logic**: Guard the storage delete calls -- only attempt to remove files from storage when `file_path` is not null.
3. **Table display**: For clean schematics, show a canvas icon (e.g. `PenTool` from lucide) instead of calling `getFileTypeIcon`. The Status column shows "Canvas" instead of conversion status.

### Technical Details

**File: `src/components/projects/SchematicsTab.tsx`**
- Remove `disabled={isLoading || !selectedFile}` from submit button; replace with `disabled={isLoading}`.
- Change button text: `{isLoading ? "Creating..." : selectedFile ? "Upload Schematic" : "Clean Schematic"}`.
- In `handleSubmit`: wrap the storage upload + PDF conversion in `if (selectedFile) { ... }` and set `file_path`/`file_type` to `null`/`'canvas'` when no file.
- In `handleConfirmDelete` and `handleBulkDelete`: wrap `supabase.storage.from(...).remove(...)` in `if (schematic.file_path) { ... }`.
- In the table row rendering: handle `file_type === 'canvas'` or `!file_path` for the icon and status columns.

**File: `src/types/schematic.ts`**
- Update `file_path` and `file_type` to allow `null`: `file_path: string | null`.

**File: `src/integrations/supabase/types.ts`**
- This will auto-update after the migration.

