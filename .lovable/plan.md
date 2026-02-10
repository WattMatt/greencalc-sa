

# Project Documents - File Manager with Folders

## Overview

Replace the placeholder "Project Documents" card with a full document management system. Users will be able to create folders, upload files, rename/delete/move files between folders, and download files. The UI pattern will mirror the existing PV Layout Browser's folder system.

## What Gets Built

### Database

**New table: `project_documents`**
- `id` (UUID, PK)
- `project_id` (UUID, FK to projects)
- `folder_id` (UUID, nullable, FK to project_document_folders)
- `name` (text) -- display name
- `file_path` (text) -- storage path in bucket
- `file_size` (bigint, nullable)
- `mime_type` (text, nullable)
- `uploaded_by` (UUID, nullable)
- `created_at`, `updated_at` (timestamps)

**New table: `project_document_folders`**
- `id` (UUID, PK)
- `project_id` (UUID, FK to projects)
- `name` (text)
- `color` (text, nullable)
- `sort_order` (integer, default 0)
- `created_at`, `updated_at` (timestamps)

Both tables get RLS policies matching the existing `pv_layout_folders` pattern (open access).

### Storage

**New bucket: `project-documents`** (private) for actual file storage. Files stored under path `{project_id}/{document_id}/{filename}`.

### New Component: `ProjectDocuments.tsx`

A new component at `src/components/projects/ProjectDocuments.tsx` that provides:

- **Toolbar** with buttons: "Upload Files", "New Folder", "Manage Folders"
- **Folder sections** as collapsible accordions (same pattern as LayoutBrowser), each showing its documents
- **Uncategorized section** for documents not in any folder
- **Document rows** showing file name, size, upload date, with action menu (Rename, Move to Folder, Download, Delete)
- **Drag and drop** between folders (reusing the same drag pattern from LayoutBrowser)
- **File upload** via a hidden input triggered by the Upload button; files go to the `project-documents` storage bucket and metadata is saved to `project_documents` table
- **Download** generates a signed URL from storage and opens it

### Integration

In `src/pages/ProjectDetail.tsx`, the Documents `TabsContent` will import and render `<ProjectDocuments projectId={id} />` instead of the placeholder card.

## Files to Create/Modify

1. **SQL Migration** -- create `project_document_folders` and `project_documents` tables, RLS policies, storage bucket
2. **`src/components/projects/ProjectDocuments.tsx`** (new) -- the full document manager component
3. **`src/pages/ProjectDetail.tsx`** -- replace placeholder with the new component

## Technical Details

### Storage bucket creation (in migration)
```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('project-documents', 'project-documents', false);
```

Storage RLS policies will allow authenticated users to upload, read, and delete files.

### File upload flow
1. User clicks "Upload Files" -> hidden `<input type="file" multiple>` opens
2. For each selected file, insert a row into `project_documents` to get the document ID
3. Upload the file to storage at path `{project_id}/{document_id}/{filename}`
4. Update the document row with `file_path`, `file_size`, `mime_type`

### File download flow
1. Call `supabase.storage.from('project-documents').createSignedUrl(path, 60)` for a 60-second signed URL
2. Open the URL in a new tab

### Move to folder
Same pattern as LayoutBrowser: dropdown submenu listing all folders plus "Uncategorized", updating `folder_id` on the document row.

### Component structure
The component will be self-contained with its own state management (useState for folders, documents, dialogs) and CRUD operations, following the exact same patterns used in `LayoutBrowser.tsx`.

