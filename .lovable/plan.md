

## Add "Monthly Report" Tab After Generation

### Overview
Add a new tab called "Monthly Report" positioned after the "Generation" tab. It will be a complete duplicate of the existing "Proposals" tab, reusing the same `ProposalManager` component (which provides the list view and inline editing workspace).

### Changes

**File: `src/components/projects/MonthlyReportManager.tsx`** (new file)
- A thin wrapper around the same pattern used in `ProposalManager.tsx`
- Identical logic: lists proposals, allows create/edit inline via `ProposalWorkspaceInline`
- The heading text will say "Monthly Reports" instead of "Proposals"
- Uses the same `proposals` table filtered by `project_id` (same data source, or we can add a `type` filter later if needed to distinguish proposal types)

**File: `src/pages/ProjectDetail.tsx`**
- Import `MonthlyReportManager`
- Add a new `TabWithStatus` entry for `"monthly-report"` after the `"generation"` tab trigger (around line 1163), using the `FileText` icon and label "Monthly Report"
- Add a corresponding `TabsContent` for `"monthly-report"` after the generation `TabsContent` (around line 1276), rendering `<MonthlyReportManager projectId={id!} />`
- Add a `"monthly-report"` entry to the `tabStatuses` record (around line 1076) with a sensible default status and tooltip

### Technical Notes
- The `MonthlyReportManager` component is a direct copy of `ProposalManager` with only the display text changed ("Monthly Reports" instead of "Proposals", "Create Monthly Report" instead of "Create Proposal")
- Both tabs share the same underlying `proposals` table and `ProposalWorkspaceInline` editor -- if you later want them to show different data, a `type` column can be added to the `proposals` table to filter by `"proposal"` vs `"monthly_report"`
