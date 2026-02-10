
# Add "Documents" Tab to Project Detail

## Overview

Add a new "Documents" tab to the project detail page, placed after "Schedule" in the tab bar. This tab will serve as a document management area for each project.

## Changes

### File: `src/pages/ProjectDetail.tsx`

1. **Import** the `FolderOpen` icon from lucide-react (for the tab icon).

2. **Add tab status entry** for `documents` in the `tabStatuses` object (initially set to "pending" with tooltip "Manage project documents").

3. **Add the tab trigger** after the Schedule tab:
   ```
   <TabWithStatus value="documents" ...>
     <FolderOpen /> Documents
   </TabWithStatus>
   ```

4. **Add the tab content** after the Schedule `TabsContent`:
   ```
   <TabsContent value="documents">
     -- Placeholder card with title "Project Documents" and a message like "Document management coming soon"
   </TabsContent>
   ```

This follows the exact same pattern as every other tab (TabWithStatus + TabsContent). The placeholder can later be replaced with a full document upload/list component.
