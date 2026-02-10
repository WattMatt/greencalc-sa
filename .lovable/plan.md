

# Global Checklist Templates + Split View + Multi-File Assignment

## Overview

Three major changes to the Handover Documentation system:

1. **Global checklist templates** -- a master list of required documents stored once, shared across all projects. Editing the template updates every project.
2. **Multiple files per requirement** -- each checklist item can have multiple documents assigned to it (a junction table replaces the single `document_id` column).
3. **Split-view layout** -- the Handover Documentation folder shows a left panel (checklist requirements) and a right panel (uploaded files), with drag-and-drop from right to left to assign files.

---

## 1. Database Changes

### New table: `checklist_templates`

A global list of required document labels (not per-project). One row per required document.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID, PK | |
| label | text | e.g. "COC Certificate" |
| category | text | e.g. "Solar PV" (for future grouping) |
| sort_order | integer | Display ordering |
| created_at | timestamp | |

Seeded with the standard Solar PV list:
- COC Certificate
- As-Built Drawings
- Commissioning Report
- O&M Manual
- Warranty Documentation
- Grid Connection Agreement
- Grid Tie Certificate
- Meter Installation Certificate
- Performance Test Report
- Structural Engineering Certificate
- Electrical Single Line Diagram
- Site Handover Certificate
- Training Completion Certificate
- Insurance Documentation
- Environmental Compliance Certificate
- Safety File

### New table: `checklist_document_links` (junction table)

Replaces the single `document_id` column on `handover_checklist_items`. Allows many files per requirement.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID, PK | |
| checklist_item_id | UUID, FK | References handover_checklist_items |
| document_id | UUID, FK | References project_documents |
| created_at | timestamp | |
| UNIQUE | | (checklist_item_id, document_id) -- no duplicates |

### Modify `handover_checklist_items`

- Remove the `document_id` column (replaced by junction table).
- Add a `template_id` column (UUID, nullable, FK to `checklist_templates`) so each project-level item knows which global template item it came from.
- When the global template changes, a sync mechanism (on component mount) will add any missing template items to each project's checklist.

### RLS

All new tables get the same open-access policies as existing project tables.

---

## 2. Seeding and Sync Logic

### Initial project setup (existing flow, modified)

When `ProjectDocuments` mounts and finds zero folders:
- Create "Uncategorized" and "Handover Documentation" folders (unchanged).
- Fetch all rows from `checklist_templates`.
- Insert one `handover_checklist_items` row per template, with `template_id` set.

### Global sync on mount

Every time the Handover folder is opened:
- Fetch `checklist_templates` and compare with the project's `handover_checklist_items` (by `template_id`).
- Any template items missing from the project get inserted automatically.
- This ensures that adding a new template item propagates to all projects on next visit.

### Managing the global template

A small admin section (accessible from the Handover folder header, e.g. a "Manage Template" button) that allows:
- Adding new required document labels to the global template.
- Removing template items (does NOT delete project-level items already created).
- Reordering items.

---

## 3. Split-View UI for Handover Documentation

When the Handover Documentation folder is expanded, instead of the current single-column checklist + file list, it renders a **two-panel layout** using `ResizablePanelGroup`:

```text
+-------------------------------+-------------------------------+
|  REQUIREMENTS (Left Panel)    |  FILES IN FOLDER (Right Panel)|
|                               |                               |
|  [x] COC Certificate         |  file1.pdf                    |
|      -> file1.pdf             |  file2.pdf                    |
|      -> file3.pdf             |  file3.pdf                    |
|  [ ] As-Built Drawings       |  file4.xlsx                   |
|      (drag files here)        |  file5.docx                   |
|  [x] Commissioning Report    |                               |
|      -> file2.pdf             |                               |
|  ...                          |                               |
+-------------------------------+-------------------------------+
```

**Left panel (Requirements):**
- Each requirement row shows its label and any assigned files below it.
- Each assigned file has an "unlink" button to remove the assignment.
- Rows act as drop targets -- dragging a file from the right panel onto a requirement creates a link.
- Progress bar at the top showing completion.
- "Add Requirement" and "Manage Template" buttons at the bottom.

**Right panel (Files):**
- Standard file list of all documents uploaded to the Handover Documentation folder.
- Each file row is draggable.
- Upload button at the top to add more files.
- Standard file actions (rename, delete, download).

### Drag-and-drop assignment

- Dragging a file from the right panel onto a requirement row in the left panel creates a `checklist_document_links` entry.
- Visual feedback: the requirement row highlights when a file is dragged over it.
- A file can be assigned to multiple requirements (since it's a junction table).

---

## 4. Files to Create/Modify

1. **SQL Migration** -- create `checklist_templates`, `checklist_document_links`, modify `handover_checklist_items` (add `template_id`, drop `document_id`), seed default template items, migrate any existing assignments.
2. **`src/components/projects/HandoverChecklist.tsx`** -- complete rewrite to implement split-view with resizable panels, multi-file assignments via junction table, drag-and-drop assignment, and template sync logic.
3. **`src/components/projects/ProjectDocuments.tsx`** -- update interfaces and data fetching to use the new junction table instead of single `document_id`, pass additional props to HandoverChecklist.

---

## Technical Details

### Migration SQL summary

```sql
-- 1. Create checklist_templates
CREATE TABLE checklist_templates ( ... );

-- 2. Seed default Solar PV items
INSERT INTO checklist_templates (label, category, sort_order) VALUES
  ('COC Certificate', 'Solar PV', 0),
  ('As-Built Drawings', 'Solar PV', 1),
  ...;

-- 3. Add template_id to handover_checklist_items
ALTER TABLE handover_checklist_items ADD COLUMN template_id UUID REFERENCES checklist_templates(id);

-- 4. Create junction table
CREATE TABLE checklist_document_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_item_id UUID NOT NULL REFERENCES handover_checklist_items(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES project_documents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(checklist_item_id, document_id)
);

-- 5. Migrate existing assignments from document_id to junction table
INSERT INTO checklist_document_links (checklist_item_id, document_id)
SELECT id, document_id FROM handover_checklist_items WHERE document_id IS NOT NULL;

-- 6. Drop old column
ALTER TABLE handover_checklist_items DROP COLUMN document_id;
```

### Template sync logic (in HandoverChecklist component)

```typescript
// On mount, compare templates vs project items
const templates = await supabase.from('checklist_templates').select('*').order('sort_order');
const existingItems = await supabase.from('handover_checklist_items').select('template_id').eq('project_id', projectId);
const existingTemplateIds = new Set(existingItems.map(i => i.template_id));
const missing = templates.filter(t => !existingTemplateIds.has(t.id));
if (missing.length > 0) {
  await supabase.from('handover_checklist_items').insert(
    missing.map(t => ({ project_id: projectId, label: t.label, template_id: t.id, sort_order: t.sort_order }))
  );
}
```

### Split view using existing ResizablePanel

```tsx
<ResizablePanelGroup direction="horizontal">
  <ResizablePanel defaultSize={55}>
    {/* Requirements checklist with assigned files */}
  </ResizablePanel>
  <ResizableHandle withHandle />
  <ResizablePanel defaultSize={45}>
    {/* File browser for this folder */}
  </ResizablePanel>
</ResizablePanelGroup>
```

