

## Improve File Management: Delete, Download, and Discoverability

### Problem
The Provinces and Tariff Files table shows an "X files" button per province, but the delete and download actions are buried inside a nested dialog. This makes it hard to manage files — you can't easily delete or download them from the main view.

### What We Will Do

**1. Enhance the file list dialog with a Download button**
Currently, each file row in the dialog only has Preview (eye icon) and Delete (trash icon). We will add a dedicated Download button (download icon) so you can download a file directly without opening the preview first.

**2. Add a confirmation prompt before deleting files**
Currently, clicking the trash icon deletes immediately with no confirmation. We will add a simple `confirm()` dialog to prevent accidental deletions.

**3. Make the "Files" column more interactive**
The existing "X files" button already opens a dialog with all the actions. We will make sure the dialog is clearly labelled and the buttons are more prominent so it is obvious that you can manage files from there.

### Technical Details

| Change | File |
|---|---|
| Add Download button to file rows in the dialog | `src/components/tariffs/ProvinceFilesManager.tsx` (lines 1146-1165) |
| Add delete confirmation prompt | `src/components/tariffs/ProvinceFilesManager.tsx` (handleDeleteFile function, line 377) |
| Import `Download` icon from lucide-react | `src/components/tariffs/ProvinceFilesManager.tsx` (line 16) |

### How It Will Work
- Click **"X files"** on any province row to open the file management dialog
- Each file shows: **Preview** (eye), **Download** (arrow-down), and **Delete** (trash with confirmation)
- Download triggers a direct browser download of the file from the storage bucket
- Delete now asks "Are you sure you want to delete this file?" before proceeding

