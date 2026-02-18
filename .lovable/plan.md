

## Separate Proposals and Monthly Reports Data

### Problem
Both the Proposals tab and Monthly Report tab currently query the same `proposals` table without any filter to distinguish between them, so all records appear in both tabs.

### Solution
Add a `document_type` column to the `proposals` table to distinguish between `'proposal'` and `'monthly_report'` records. Then filter by this column in each tab's queries and set it appropriately when creating new records.

### Database Migration
Add a `document_type` text column to the `proposals` table with a default of `'proposal'` (so all existing records are automatically classified as proposals):

```sql
ALTER TABLE proposals ADD COLUMN document_type text NOT NULL DEFAULT 'proposal';
```

### Code Changes

**1. `src/components/projects/ProposalManager.tsx`**
- Add `.eq("document_type", "proposal")` to the query filter

**2. `src/components/projects/MonthlyReportManager.tsx`**
- Add `.eq("document_type", "monthly_report")` to the query filter
- Pass a `documentType="monthly_report"` prop to `ProposalWorkspaceInline`

**3. `src/components/proposals/ProposalWorkspaceInline.tsx`**
- Accept a new optional `documentType` prop (default: `'proposal'`)
- Add `.eq("document_type", documentType)` to the version list query
- Include `document_type: documentType` in the insert call when creating new records
- Update toast messages to reflect the document type ("Monthly report saved" vs "Proposal saved")
- Update the `queryClient.invalidateQueries` calls to also invalidate `project-monthly-reports` when appropriate

**4. `src/pages/ProjectDetail.tsx`**
- Update the proposal count query (used for tab status) to filter by `document_type = 'proposal'` so monthly reports don't inflate the proposals count

### Summary of Flow
- Proposals tab queries with `document_type = 'proposal'`, creates with `document_type = 'proposal'`
- Monthly Report tab queries with `document_type = 'monthly_report'`, creates with `document_type = 'monthly_report'`
- Existing records default to `'proposal'` so nothing breaks

