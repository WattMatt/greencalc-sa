

## Separate Proposals and Monthly Reports Data (Alternative Approach)

### Problem
The `document_type` column does not exist on the `proposals` table yet, and no filtering logic has been added to the code. Both tabs query the same data without distinction, so the existing "Version 1" proposal appears in the Monthly Report tab.

### Solution
Since the database migration tool was previously declined, we will take an alternative approach: add the `document_type` column and all filtering logic together in one go using the migration tool. This is the only way to add a column to the database -- there is no workaround for this step.

### Step 1: Database Migration
Add a `document_type` text column with a default of `'proposal'` so all existing records are automatically tagged as proposals:

```sql
ALTER TABLE public.proposals ADD COLUMN document_type text NOT NULL DEFAULT 'proposal';
```

This is required -- without this column, there is no way to tell proposals apart from monthly reports.

### Step 2: Code Changes

**`src/components/projects/MonthlyReportManager.tsx`**
- Add `.eq("document_type", "monthly_report")` to the query so only monthly reports appear

**`src/components/projects/ProposalManager.tsx`**
- Add `.eq("document_type", "proposal")` to the query so only proposals appear

**`src/components/proposals/ProposalWorkspaceInline.tsx`**
- Add an optional `documentType` prop (default: `'proposal'`)
- Include `document_type: documentType` in the insert call when creating new records
- Add `.eq("document_type", documentType)` to the version list query
- Update toast messages dynamically ("Monthly report saved" vs "Proposal saved")
- Invalidate `project-monthly-reports` query key when `documentType` is `'monthly_report'`

**`src/components/projects/MonthlyReportManager.tsx`**
- Pass `documentType="monthly_report"` to `ProposalWorkspaceInline`

### Why the Migration is Necessary
There is no code-only way to separate these records. They share the same table and the same `project_id`. Adding a discriminator column is the simplest and cleanest approach. The default value of `'proposal'` ensures all existing records stay in the Proposals tab and the Monthly Report tab starts empty.

