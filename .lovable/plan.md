

# Content Block Categorisation for Proposals and Monthly Reports

## Overview
Add a `category` field to content blocks so the sidebar can filter them by document type. General blocks (Cover, TOC, Signature) appear for all documents. Existing proposal-specific blocks stay under "proposal". New monthly report blocks are added under "monthly_report".

## New Monthly Report Content Blocks
Based on the LaTeX template you provided, these new blocks will be created:

| Block ID | Label | Description |
|---|---|---|
| `executiveSummary` | Executive Summary | Installed equipment specs, monthly and yearly energy generation tables |
| `dailyLog` | Daily Performance Log | Day-by-day yield, metered, downtime, theoretical, and surplus/deficit |
| `operationalDowntime` | Operational Downtime | Downtime details with tie-in breakdowns and comments |
| `financialYield` | Financial Yield Report | Daily financial yield with guarantee vs actual in Rands |

## Technical Changes

### 1. `src/components/proposals/types.ts`
- Add `category` field to `ContentBlock` interface: `category?: 'general' | 'proposal' | 'monthly_report'`
- Expand `ContentBlockId` union type with the 4 new monthly report IDs: `executiveSummary`, `dailyLog`, `operationalDowntime`, `financialYield`
- Tag existing blocks in `DEFAULT_CONTENT_BLOCKS`:
  - `cover`, `tableOfContents`, `signature` get `category: 'general'`
  - `adminDetails`, `introduction`, `backgroundMethodology`, `tenderReturnData`, `loadAnalysis`, `financialEstimates`, `financialConclusion`, `cashflowTable`, `terms` get `category: 'proposal'`
- Add the 4 new monthly report blocks with `category: 'monthly_report'` to `DEFAULT_CONTENT_BLOCKS`
- Add a helper: `getBlocksForDocumentType(documentType)` that returns general blocks + blocks matching the document type

### 2. `src/components/proposals/ProposalWorkspaceInline.tsx`
- Import `getBlocksForDocumentType` instead of using `DEFAULT_CONTENT_BLOCKS` directly
- Initialise `contentBlocks` state using `getBlocksForDocumentType(documentType)` so only relevant blocks appear
- When loading a saved proposal, merge persisted block states with the correct set for that document type

### 3. `src/components/proposals/ProposalSidebar.tsx`
- Accept the `documentType` prop (already partially wired)
- Filter `sortedBlocks` to only show blocks where `category === 'general'` or `category === documentType`
- This means proposal editing shows General + Proposal blocks; monthly report editing shows General + Monthly Report blocks
- Update `NARRATIVE_SECTION_MAP` to exclude monthly report blocks from AI narrative generation (for now)

### 4. `src/components/proposals/ContentBlockToggle.tsx`
- No changes needed -- it already renders whatever blocks are passed to it

## How It Works

When editing a **Proposal**, the sidebar shows:
- Cover Page (general)
- Table of Contents (general)
- Administrative Details (proposal)
- Introduction (proposal)
- Background and Methodology (proposal)
- Tender Return Data (proposal)
- Load Analysis (proposal)
- Financial Estimates (proposal)
- Financial Conclusion (proposal)
- Project Cash Flows (proposal)
- Terms and Conditions (proposal)
- Signature Block (general)

When editing a **Monthly Report**, the sidebar shows:
- Cover Page (general)
- Table of Contents (general)
- Executive Summary (monthly_report)
- Daily Performance Log (monthly_report)
- Operational Downtime (monthly_report)
- Financial Yield Report (monthly_report)
- Signature Block (general)

All blocks remain toggleable. The LaTeX template generation for the new monthly report sections will be a follow-up step -- this change focuses on the data model and sidebar filtering.

