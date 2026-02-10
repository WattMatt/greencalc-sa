

# Handover Documentation Folder with Required Documents Checklist

## Overview

Each project will automatically get two default folders: "Uncategorized" and "Handover Documentation". The "Handover Documentation" folder will have a predefined checklist of required documents. Uploaded files within that folder can be mapped to checklist items, giving a clear view of which required documents are present and which are still missing.

## What Changes

### 1. Database: New table `handover_checklist_items`

A new table to store the predefined list of required handover documents per project, and track which uploaded document(s) satisfy each requirement.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID, PK | |
| `project_id` | UUID, FK | Link to project |
| `label` | text | Name of the required document (e.g. "COC Certificate") |
| `sort_order` | integer | Display ordering |
| `document_id` | UUID, nullable, FK | Link to a `project_documents` row that fulfills this requirement |
| `created_at` | timestamp | |

RLS: same open-access pattern as other project tables.

### 2. Auto-creation of default folders and checklist

When `ProjectDocuments` mounts and finds zero folders for the project, it will automatically create:
- "Uncategorized" folder (sort_order 0)
- "Handover Documentation" folder (sort_order 1)

And seed the `handover_checklist_items` table with the predefined list of required documents (approximately 15-20 items such as "COC Certificate", "As-Built Drawings", "Commissioning Report", "O&M Manual", etc.).

### 3. UI changes to `ProjectDocuments.tsx`

**Handover Documentation folder gets a special rendering:**

Instead of just listing uploaded files, the Handover Documentation folder will show:
- A **checklist table** with two columns: "Required Document" and "Uploaded File"
- Each row shows the required document label on the left
- On the right, either a linked document name (with download action) or an "Assign" button
- A status summary at the top (e.g. "5 of 18 documents provided")
- A progress bar showing completion percentage

**Assigning documents to checklist items:**
- Users upload files into the Handover Documentation folder as normal
- Each checklist row has an "Assign" dropdown that lists all documents currently in the Handover Documentation folder
- Selecting a document links it to that checklist requirement
- Multiple checklist items can reference the same document (if one file covers multiple requirements)
- Documents can also be unassigned

**The rest of the folders** (Uncategorized + any user-created folders) continue to work exactly as they do today.

### 4. Predefined required documents list

The initial checklist will include items like:
- COC Certificate
- As-Built Drawings
- Commissioning Report
- O&M Manual
- Warranty Documentation
- Grid Connection Agreement
- Meter Installation Certificate
- Performance Test Report
- Structural Engineering Certificate
- Electrical Single Line Diagram
- Site Handover Certificate
- Training Completion Certificate
- Insurance Documentation
- Environmental Compliance Certificate
- Safety File

This list is seeded once per project. Users will be able to add/remove items from the checklist.

## Files to Create/Modify

1. **SQL Migration** -- create `handover_checklist_items` table with RLS
2. **`src/components/projects/ProjectDocuments.tsx`** -- add auto-seeding logic, special Handover folder rendering with checklist UI
3. Possibly extract a sub-component `HandoverChecklist.tsx` for clarity

## Technical Details

### Auto-seeding logic (in `fetchData`)
```
After fetching folders:
  if (folders.length === 0) {
    - Insert "Uncategorized" folder (sort_order 0)
    - Insert "Handover Documentation" folder (sort_order 1)
    - Insert default checklist items for the project
    - Re-fetch data
  }
```

### Handover folder detection
The component identifies the Handover Documentation folder by name match. When rendering that folder section, it switches to the checklist view instead of the plain file list.

### Checklist item assignment
```sql
UPDATE handover_checklist_items SET document_id = '<doc_id>' WHERE id = '<item_id>';
```

### Adding/removing checklist items
- An "Add Requirement" button at the bottom of the checklist
- Each row has a delete action to remove custom requirements
