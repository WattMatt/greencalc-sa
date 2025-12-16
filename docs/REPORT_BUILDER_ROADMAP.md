# Report Builder Development Roadmap

## Overview
Visual-first reporting system integrated into Proposal Builder workflow, featuring DC/AC ratio analysis, infographics, and engineering KPIs with Google Docs-style formatting.

**Design Philosophy**: Visual over written content - let graphs, charts, and infographics tell the story.

---

## Phase 1: Report Data Foundation
**Goal**: Establish data structures and calculation engine for report segments

### Deliverables
- [ ] Report segment types definition (TypeScript interfaces)
- [ ] DC/AC ratio comparison calculations (1:1 vs oversized)
- [ ] KPI calculation utilities (yield, performance ratio, capacity factor, LCOE)
- [ ] Report configuration schema (what segments to include)

### Files to Create
- `src/components/reports/types.ts` - Report data types
- `src/components/reports/calculations/dcAcComparison.ts` - Oversizing analysis
- `src/components/reports/calculations/kpiCalculations.ts` - Engineering KPIs
- `src/components/reports/ReportConfig.ts` - Report configuration

### Review Gate
- [ ] Unit tests pass for calculation functions
- [ ] Sample data produces expected KPI values
- [ ] Types are comprehensive for all report segments

---

## Phase 2: Core Chart Components
**Goal**: Build reusable, export-ready chart components

### Deliverables
- [ ] DC/AC Ratio Comparison Chart (bar/area showing clipping vs gain)
- [ ] Energy Flow Sankey Diagram (generation → consumption → grid)
- [ ] Monthly Yield Comparison Chart (1:1 vs oversized)
- [ ] Financial Payback Timeline Chart
- [ ] Chart export utilities (PNG, SVG for reports)

### Files to Create
- `src/components/reports/charts/DcAcComparisonChart.tsx`
- `src/components/reports/charts/EnergyFlowSankey.tsx`
- `src/components/reports/charts/MonthlyYieldChart.tsx`
- `src/components/reports/charts/PaybackTimelineChart.tsx`
- `src/components/reports/charts/chartExportUtils.ts`

### Review Gate
- [ ] Charts render correctly with sample data
- [ ] Charts export cleanly to PNG/SVG
- [ ] Responsive and print-friendly styling

---

## Phase 3: Infographic Components
**Goal**: Create visual summary cards and infographic elements

### Deliverables
- [ ] Executive Summary Card (key metrics at a glance)
- [ ] System Overview Infographic (PV size, battery, connection)
- [ ] Savings Breakdown Visual (pie/donut with categories)
- [ ] Environmental Impact Card (CO2, trees equivalent)
- [ ] Engineering Specs Card (technical parameters)
- [ ] AI-generated insight summaries

### Files to Create
- `src/components/reports/infographics/ExecutiveSummaryCard.tsx`
- `src/components/reports/infographics/SystemOverviewGraphic.tsx`
- `src/components/reports/infographics/SavingsBreakdown.tsx`
- `src/components/reports/infographics/EnvironmentalImpact.tsx`
- `src/components/reports/infographics/EngineeringSpecs.tsx`

### Review Gate
- [ ] Infographics are visually polished and professional
- [ ] Data displays correctly with real project data
- [ ] Print-ready sizing and layout

---

## Phase 4: Report Builder UI
**Goal**: Build the report composition interface in Proposal workflow

### Deliverables
- [ ] Report segment selector (drag-drop or checkbox)
- [ ] Report preview panel (live preview as you build)
- [ ] Segment ordering/arrangement
- [ ] Report template presets (Executive, Technical, Financial)
- [ ] Custom branding integration (logo, colors)

### Files to Create
- `src/components/reports/ReportBuilder.tsx` - Main builder UI
- `src/components/reports/SegmentSelector.tsx` - Choose segments
- `src/components/reports/ReportPreview.tsx` - Live preview
- `src/components/reports/ReportTemplates.tsx` - Preset templates

### Integration Points
- Integrate into `src/pages/ProposalWorkspace.tsx` as new tab/section
- Connect to existing proposal data and simulation results

### Review Gate
- [ ] Can compose report from available segments
- [ ] Preview matches expected output
- [ ] Templates produce professional layouts

---

## Phase 5: Native Export (PDF/Excel)
**Goal**: Generate downloadable reports in standard formats

### Deliverables
- [ ] PDF export with professional formatting
  - Cover page with branding
  - Table of contents
  - Charts embedded as images
  - Page numbers and headers
- [ ] Excel export for data tables
  - Summary sheet with KPIs
  - Detailed data sheets
  - Charts as Excel charts where possible
- [ ] Export progress indicator

### Files to Create
- `src/components/reports/export/pdfExport.ts`
- `src/components/reports/export/excelExport.ts`
- `src/components/reports/export/ExportDialog.tsx`

### Review Gate
- [ ] PDF opens correctly in all viewers
- [ ] Excel formulas work correctly
- [ ] Charts are crisp and readable in exports

---

## Phase 6: Google Workspace Integration
**Goal**: Export directly to Google Docs, Slides, Sheets

### Deliverables
- [ ] Google OAuth setup and authentication
- [ ] Google Docs export (formatted report document)
- [ ] Google Slides export (presentation with infographics)
- [ ] Google Sheets export (data and charts)
- [ ] "Open in Google" buttons

### Files to Create
- `supabase/functions/google-docs-export/index.ts`
- `supabase/functions/google-slides-export/index.ts`
- `supabase/functions/google-sheets-export/index.ts`
- `src/components/reports/export/GoogleExportButton.tsx`

### Secrets Required
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

### Review Gate
- [ ] OAuth flow works end-to-end
- [ ] Documents created in user's Google Drive
- [ ] Formatting preserved in Google formats

---

## Phase 7: Polish & Analytics
**Goal**: Final refinements and usage tracking

### Deliverables
- [ ] Report generation analytics (track what's used)
- [ ] Performance optimization (lazy load charts)
- [ ] Error handling and retry logic
- [ ] User feedback collection
- [ ] Documentation and help content

### Files to Create
- `src/components/reports/ReportAnalytics.ts`
- Update onboarding tours for Report Builder

### Review Gate
- [ ] Full end-to-end test with real project
- [ ] Performance benchmarks met
- [ ] User acceptance testing complete

---

## DC/AC Ratio Analysis - Key Visuals

### 1:1 vs Oversizing Comparison
The core visual shows:
- **Baseline (1:1)**: DC array = AC inverter capacity
- **Oversized (1.3:1)**: DC array 30% larger than inverter
- **Clipping losses**: Energy lost when DC > AC limit
- **Net gain**: Additional energy captured in morning/evening

```
┌─────────────────────────────────────────────┐
│  Daily Energy Production Comparison         │
│                                             │
│  ████████████████████  1.3:1 (Net Output)  │
│  ░░░░░░░░░░░░░░░░░░░░  Clipping Losses     │
│  ████████████████      1:1 Baseline        │
│                                             │
│  Key Metrics:                               │
│  • Additional yield: +8-12%                 │
│  • Clipping losses: 2-4%                    │
│  • ROI improvement: +6-10%                  │
└─────────────────────────────────────────────┘
```

### Engineering KPIs to Display
1. **Specific Yield** (kWh/kWp) - Energy per installed capacity
2. **Performance Ratio** (%) - Actual vs theoretical output
3. **Capacity Factor** (%) - Average output vs peak
4. **LCOE** (R/kWh) - Levelized cost of energy
5. **Grid Independence** (%) - Self-consumption rate
6. **Peak Shaving** (kW) - Demand reduction achieved

---

## Development Process

### Per-Phase Workflow
1. **Plan**: Review deliverables, create tasks
2. **Build**: Implement features
3. **Test**: Run tests, manual QA
4. **Review**: Demonstrate to stakeholders
5. **Gate**: Checklist must be complete before next phase

### Testing Strategy
- Unit tests for calculations
- Component tests for UI elements
- Integration tests for export flows
- Visual regression for charts/infographics
- End-to-end for full report generation

### Progress Tracking
Use task tracking in each session:
- Create tasks for current phase deliverables
- Mark complete as each is done
- Note blockers and decisions
- Don't proceed to next phase until gate passed

---

## Timeline Estimate

| Phase | Scope | Est. Sessions |
|-------|-------|---------------|
| 1 | Data Foundation | 1-2 |
| 2 | Chart Components | 2-3 |
| 3 | Infographics | 2-3 |
| 4 | Builder UI | 2-3 |
| 5 | PDF/Excel Export | 2-3 |
| 6 | Google Integration | 3-4 |
| 7 | Polish | 1-2 |

**Total**: ~13-20 sessions depending on complexity

---

## Ready to Start?
Begin with **Phase 1** by saying:
> "Let's start Phase 1: Report Data Foundation"
