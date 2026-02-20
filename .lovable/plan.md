

## Show Existing Uploads in the Bulk Upload Wizard

### Problem
When opening the Bulk Upload dialog, there is no indication of what CSV data has already been imported for this project. The user has no way of confirming that previous imports exist without checking the database directly.

### Solution
Add an "Existing Imports" section at the top of **Tab 1 (Select Files)** that queries the `scada_imports` table for all records matching the current `project_id` and displays them in a compact list/table. This gives the user immediate visibility into what has already been uploaded.

### What Changes

**File: `src/components/projects/ScadaImportWizard.tsx`**

1. **Add a new query** using TanStack Query to fetch existing `scada_imports` for this project:
   - Fields: `id`, `file_name`, `site_name`, `shop_name`, `data_points`, `date_range_start`, `date_range_end`, `created_at`
   - Filtered by `project_id`, enabled when the dialog is `open`

2. **Render an "Existing Imports" card** above the "Select CSV Files" section in Tab 1:
   - If no existing imports: show a subtle message like "No files have been imported yet."
   - If imports exist: show a compact table with columns for file name, site/shop name, data points, date range, and import date
   - Each row will have a small delete button (Trash2 icon) to allow removing individual existing imports from the database and storage
   - The section will have a clear heading like "Previously Imported Files" with a count badge

3. **Delete handler** for existing imports:
   - Removes the record from `scada_imports` table
   - Invalidates the query to refresh the list
   - Shows a success/error toast

### Technical Detail

```text
New query:
  SELECT id, file_name, site_name, shop_name, data_points, 
         date_range_start, date_range_end, created_at
  FROM scada_imports
  WHERE project_id = <projectId>
  ORDER BY created_at DESC

UI structure in Tab 1:
  [Previously Imported Files (3)]        <-- collapsible card
    file_name | site_name | points | date range | imported | [delete]
    ...
  ──────────────────────────────────
  [Select CSV Files]                     <-- existing UI unchanged
    Choose Files ...
```

### Files Modified
- `src/components/projects/ScadaImportWizard.tsx` -- add existing imports query and display section in Tab 1
