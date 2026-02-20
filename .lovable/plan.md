

## Add Step 4: Upload Pane with Per-File Progress Tracking

### What Changes

The wizard gets a 4th tab called **"4. Upload"**. The "Complete Import" button on step 3 (Preview) navigates to this new tab instead of immediately uploading. The Upload pane shows every file with live status indicators, and a "Complete Import" button at the bottom right kicks off the actual upload + parse process one file at a time.

### User Flow

1. Steps 1-3 remain the same (Select Files, Parse & Ingest, Preview).
2. Clicking "Complete Import" on step 3 now navigates to step 4 instead of uploading.
3. **Step 4 (Upload)** displays all files in a list with their status. A "Complete Import" button at the bottom right starts the sequential upload process.
4. Each file progresses through: Pending -> Uploading -> Parsing -> Done / Error.
5. Files that fail show an inline error message so you can see exactly which ones had problems.
6. Successful files still get imported; failed files are skipped (no "abort everything" behaviour).
7. After all files are processed, a summary shows "X of Y files imported successfully" and the button changes to "Close".

### UI for Step 4

- Summary bar at top: "X of Y files uploaded successfully" (updates in real time).
- Each file as a card row showing:
  - File name and assigned tenant
  - Status icon: clock (pending), spinner (uploading/parsing), green tick (done), red cross (error)
  - Error message shown in red text below the file name if it failed
- Bottom right: "Complete Import" button. While running: "Importing... (3/10)". When done: "Close".

### Technical Details

**File: `src/components/projects/ScadaImportWizard.tsx`**

1. **New state**:
   - `uploadStatuses: Record<number, { status: 'pending' | 'uploading' | 'parsing' | 'done' | 'error'; error?: string }>` -- per-file index status map.
   - `isImporting: boolean` -- whether the import loop is running.
   - `importComplete: boolean` -- all files have been processed.

2. **Tab grid**: Change `grid-cols-3` to `grid-cols-4`. Add a 4th `TabsTrigger` for "4. Upload", disabled until on the preview step.

3. **Step 3 button change**: The "Complete Import" button on the Preview tab now calls `setActiveTab("import")` and initialises all `uploadStatuses` to "pending".

4. **Step 4 `handleStartImport` function**: Replaces the old `handleComplete`. Loops through files sequentially:
   - Set file status to "uploading" -> upload to storage.
   - Set file status to "parsing" -> call `onComplete` callback with that single file's result.
   - Set file status to "done" or "error" with message.
   - Continue to next file regardless of failure.
   - After all files, set `importComplete = true`.

5. **Old `handleComplete`**: Removed / replaced by the new per-file logic in step 4.

6. **New icons imported**: `Clock`, `CheckCircle2`, `XCircle` from lucide-react for the status indicators.

### Files Modified
- `src/components/projects/ScadaImportWizard.tsx` -- add 4th tab, per-file progress state, sequential upload with error isolation.

