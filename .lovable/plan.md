

## Defer All Uploads to the Preview Tab

### Problem
Currently, clicking "Upload All" in the **Upload Files** tab immediately uploads files to the storage bucket (`scada-csvs`). While the database insert only happens on "Complete Import" in the Preview tab, the user expects **nothing** to leave the browser until they are satisfied with the parsed preview and explicitly confirm.

### Solution
Restructure the wizard so that:
- **Tab 1 ("Select Files")**: Only selects files from disk and reads their content locally in the browser. No network calls. The "Upload All" button becomes "Read All" or simply auto-reads on selection. Tenant assignment stays here.
- **Tab 2 ("Parse & Configure")**: Same as today -- configure separator, header row, column interpretation.
- **Tab 3 ("Preview & Import")**: Shows the parsed preview. The "Complete Import" button now does **both** the storage upload and the database insert in one go.

### Changes in `src/components/projects/ScadaImportWizard.tsx`

1. **Rename Tab 1** from "Upload Files" to "Select Files" and update the description to clarify no upload happens yet.

2. **Refactor `handleUploadAll`** to only read file content locally (no `supabase.storage.upload` call). Rename it to `handleReadAll`. It will:
   - Call `readFileAsText()` for each file (already done today)
   - Set status to `"uploaded"` (rename to `"ready"` for clarity)
   - Auto-detect separator and load preview
   - Advance to Tab 2
   - **Remove** the `supabase.storage.from("scada-csvs").upload(...)` call entirely from this function

3. **Move storage upload into `handleComplete`**: Before the `onComplete(results)` call, loop through files and upload each to `scada-csvs` storage. This means the storage upload and database insert (done by the parent `TenantManager.tsx`) both happen at the same moment -- when the user clicks "Complete Import".

4. **Update button labels and toasts**:
   - "Upload All" becomes "Continue" or "Read Files" (since it just reads locally)
   - Success toast changes from "Files uploaded successfully" to "Files loaded successfully"
   - Tab 3 button "Complete Import" stays the same but now also handles the storage upload

### File Modified
- `src/components/projects/ScadaImportWizard.tsx`

### What Stays the Same
- Tab 2 (Parse & Configure) -- no changes
- Tab 3 preview table -- no changes
- `TenantManager.tsx` `handleWizardComplete` -- no changes (it already handles the DB insert on complete)
- The upsert dedup logic added previously -- no changes

