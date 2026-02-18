

## Remove Reports Tab and Migrate AI Narratives to Proposals

### Overview
Remove the Reports tab entirely from the project detail page and migrate its AI-generated narrative capability into the Proposals sidebar. The edge function `generate-proposal-narrative` already supports generating narratives for various section types -- we just need to wire it into the Proposal workspace so each content block can have an AI-generated narrative.

### What Gets Removed
1. **Reports tab** from `ProjectDetail.tsx` (the tab trigger and its `TabsContent`)
2. **Reports workflow step** from `ProjectOverview.tsx` (the workflow node referencing "reports")
3. **Reports tab status** entry from `ProjectDetail.tsx`
4. **The entire `src/components/reports/` directory** (ReportBuilder, SegmentSelector, ReportPreview, VersionHistory, ReportExport, types, charts, calculations, infographics, analytics, ReportToggle)
5. **`src/hooks/useReportSelection.ts`** (only used by ReportToggle)
6. **ReportToggle references** in `SimulationPanel.tsx` and `PVSystemConfig.tsx`
7. **`src/lib/pdfshift/templates/report.ts`** (the report-specific HTML template; keep proposal/sandbox/base templates)

### What Gets Added / Changed

**1. New: AI Narrative state and generation in `ProposalWorkspaceInline.tsx`**
- Add state: `aiNarratives` (record of content block ID to narrative text), `isGeneratingNarrative` (boolean)
- Add a `generateAINarrative` function that calls the existing `generate-proposal-narrative` edge function
- Map Proposal `ContentBlockId` values to the edge function's `sectionType` parameter:
  - `introduction` maps to `executive_summary`
  - `backgroundMethodology` maps to `tariff_details`
  - `tenderReturnData` maps to `engineering_specs`
  - `financialEstimates` maps to `payback_timeline`
  - `financialConclusion` maps to `investment_recommendation`
- Pass `aiNarratives` and the generator function down to `ProposalSidebar`

**2. Updated: `ProposalSidebar.tsx`**
- Accept new props: `aiNarratives`, `onGenerateNarrative`, `isGeneratingNarrative`
- Add a "Generate AI Narrative" button in the header area (similar to the Reports tab's button)
- Show a small sparkle/wand icon on each content block that has an AI narrative generated

**3. Updated: `ContentBlockToggle.tsx`**
- Accept optional `hasNarrative` prop
- Show a small indicator (Wand2 icon) when a narrative exists for that block
- Optionally accept `onGenerateNarrative` to allow per-block regeneration via a small button

**4. Updated: LaTeX template integration**
- Pass the `aiNarratives` into the `TemplateData` so the LaTeX generator can embed AI-written text into the relevant sections
- Update the proposal template generator to insert narrative text into the appropriate section delimiters when available

**5. Persistence**
- Store `aiNarratives` alongside the existing `section_overrides` in the proposal save/load logic (as a new field in the proposals table JSON or within the existing `section_overrides` structure)

### Files to Delete
- `src/components/reports/` (entire directory)
- `src/hooks/useReportSelection.ts`

### Files to Edit
- `src/pages/ProjectDetail.tsx` -- remove Reports tab, import, and status
- `src/components/projects/ProjectOverview.tsx` -- remove reports workflow step
- `src/components/projects/SimulationPanel.tsx` -- remove ReportToggle import/usage
- `src/components/projects/PVSystemConfig.tsx` -- remove ReportToggle import/usage
- `src/components/proposals/ProposalWorkspaceInline.tsx` -- add AI narrative generation logic
- `src/components/proposals/ProposalSidebar.tsx` -- add AI narrative button and indicators
- `src/components/proposals/ContentBlockToggle.tsx` -- add narrative indicator
- `src/components/proposals/types.ts` -- add narrative-related type (optional, can use inline Record type)
- `src/components/code-review/ProjectFileBrowser.tsx` -- remove reference to reports in the file tree (cosmetic)

### Technical Notes
- The `generate-proposal-narrative` edge function remains unchanged -- it already supports all the section types we need
- The `src/lib/pdfshift/` directory is kept (minus the report template) as it's still used by proposals and sandbox exports
- The `report_analytics` database table is left in place (no destructive schema change needed; it simply won't receive new entries)
