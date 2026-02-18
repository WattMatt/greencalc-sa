
## Move Export Buttons and Tidy Up Header

### Changes

**1. Remove Export buttons from sidebar** (`ProposalSidebar.tsx`)
- Remove the "Export PDF" and "Export Excel" buttons from the bottom of the sidebar (the `border-t` section at lines 250-275)
- Also remove the collapsed-state export button (line 152-154)

**2. Add Export buttons to the top-right header bar** (`ProposalWorkspaceInline.tsx`)
- Add "Export PDF" and "Export Excel" buttons alongside the existing Save and Share buttons in the header area (lines 554-580)
- Order: Export PDF, Export Excel, Share, Save

**3. Rename "Share with Client" to "Share"** (`ShareLinkButton.tsx`)
- Change the button label from "Share with Client" to "Share" (line 97)

**4. Match the horizontal divider lines** (`ProposalWorkspaceInline.tsx` + `ProposalSidebar.tsx`)
- Ensure the sidebar header border (`border-b` on line 162 of ProposalSidebar) and the Proposal Builder header border (`border-b` on line 532 of ProposalWorkspaceInline) use the same styling so they appear as one continuous horizontal line across the top of the workspace

### Technical Details

- **ProposalSidebar.tsx**: Remove the export actions `div` (lines 250-275) and the collapsed download button. The `onExportPDF`, `onExportExcel`, and `isExporting` props remain but will no longer be used in this component (can be cleaned up or kept for flexibility).
- **ProposalWorkspaceInline.tsx**: Add two new buttons in the `div.flex.items-center.gap-2` (line 554) before the ShareLinkButton:
  - Export PDF button with Download icon (uses existing `handleExportPDF` and `isExporting` state)
  - Export Excel button with FileText icon (uses existing `handleExportExcel`)
- **ShareLinkButton.tsx**: Simple text change on line 97.
- **Divider alignment**: Ensure both the sidebar header and the main header use matching `py-2` / `p-3` padding and `border-b border-border` so the bottom border aligns visually into a single continuous line.
