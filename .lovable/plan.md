
## Fix: Sidebar Filter Should Show Only Category-Specific Blocks

### Problem
When selecting "Proposal" or "Monthly Report" as the filter, general blocks (Cover Page, Table of Contents, Signature Block) still appear because the filter logic includes `category === 'general'` for all non-"all" filters.

### Expected Behaviour
- **All Sections**: Shows everything (general + proposal + monthly report)
- **General**: Shows only general blocks (Cover Page, Table of Contents, Signature Block)
- **Proposal**: Shows only proposal-specific blocks (Admin Details, Introduction, Background, etc.)
- **Monthly Report**: Shows only monthly report blocks (Executive Summary, Daily Log, etc.)

### Change

**File: `src/components/proposals/ProposalSidebar.tsx`** (line 82)

Update the filter logic to do a strict category match for proposal and monthly_report filters:

```typescript
// Before (incorrect — includes general in proposal/monthly_report)
return b.category === 'general' || b.category === blockFilter;

// After (strict match — each filter shows only its own category)
return b.category === blockFilter;
```

This is a one-line change. The full filter becomes:
- `'all'` → show all blocks
- `'general'` → show only `category === 'general'`
- `'proposal'` → show only `category === 'proposal'`
- `'monthly_report'` → show only `category === 'monthly_report'`
