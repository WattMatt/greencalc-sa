
## Dynamic Header Title Based on Document Type

### Change
In `src/components/proposals/ProposalWorkspaceInline.tsx`, line 542, replace the hardcoded "Proposal Builder" with a dynamic label derived from the `documentType` prop:

- When `documentType === 'proposal'`: show **"Proposal Builder"**
- When `documentType === 'monthly_report'`: show **"Monthly Report"**

### Implementation
A single line change at line 542:

```tsx
// Before
<h1 className="text-xl font-semibold">Proposal Builder</h1>

// After
<h1 className="text-xl font-semibold">
  {documentType === 'monthly_report' ? 'Monthly Report' : 'Proposal Builder'}
</h1>
```

No other files need changes -- the `documentType` prop is already passed through from the Monthly Report tab.
