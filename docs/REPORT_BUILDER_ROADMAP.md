# Report Builder Development Roadmap

## Overview
Visual-first reporting system integrated into **Proposal Builder workflow**, featuring DC/AC ratio analysis, AI-generated infographics, and engineering KPIs with Google Docs-style formatting.

**Design Philosophy**: Visual over written content - let graphs, illustrations, and infographics tell the story.

---

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Data Storage** | Database from start | Persistent report configs enable versioning |
| **Chart Priority** | All 4 core charts | Complete visual story for DC/AC analysis |
| **Infographic Style** | AI-generated illustrations | Professional, unique visuals per report |
| **Versioning** | Included | Track changes between report iterations |
| **Integration Point** | Proposal Builder | Reports are the output of proposal workflow |

---

## Phase 0: Wireframes & Design Validation
**Goal**: Sketch UI mockups to validate design approach before building

### Deliverables
- [ ] **Report Builder Layout Wireframe** - Overall page structure:
  - Segment selector panel (left)
  - Live preview panel (right)
  - Toolbar with template/export actions
- [ ] **Segment Selector Mockup** - How users choose content:
  - Grouped by category (Executive, Technical, Financial)
  - Drag handles for reordering
  - Preview thumbnails
- [ ] **Chart Layout Options** - How charts appear in report:
  - Full-page vs half-page
  - Side-by-side comparison layouts
  - Caption and annotation placement
- [ ] **Infographic Card Designs** - Visual style for KPI cards:
  - Executive Summary card layout
  - Environmental Impact card
  - Engineering Specs panel
- [ ] **Export Flow Mockup** - Export dialog and options:
  - Format selection (PDF, Excel, Google)
  - Quality/size options
  - Progress indicator
- [ ] **Version History UI** - How versioning appears:
  - Version list sidebar
  - Compare view layout
  - Restore confirmation

### Wireframe Format
Simple ASCII/text wireframes in this document, or quick component sketches using existing UI primitives.

### Example: Report Builder Layout
```
┌─────────────────────────────────────────────────────────────────┐
│  Report Builder                    [Templates ▼] [Export ▼]     │
├──────────────────┬──────────────────────────────────────────────┤
│  SEGMENTS        │  PREVIEW                                     │
│  ─────────────   │  ┌────────────────────────────────────────┐  │
│  ☑ Executive     │  │                                        │  │
│    Summary       │  │     [Executive Summary Card]           │  │
│  ☑ DC/AC Chart   │  │                                        │  │
│  ☑ Energy Flow   │  │     ┌──────────┐  ┌──────────┐        │  │
│  ☐ Monthly Yield │  │     │ DC/AC    │  │ Sankey   │        │  │
│  ☑ Payback       │  │     │ Chart    │  │ Diagram  │        │  │
│  ☐ Env. Impact   │  │     └──────────┘  └──────────┘        │  │
│  ☑ Tech Specs    │  │                                        │  │
│                  │  │     [Financial Summary]                │  │
│  [+ Add Custom]  │  │                                        │  │
│                  │  └────────────────────────────────────────┘  │
│  ─────────────   │                                              │
│  VERSIONS        │  Page 1 of 4    [◀] [▶]    [Zoom: 100%]     │
│  v3 (current)    │                                              │
│  v2 - Jun 10     │                                              │
│  v1 - Jun 8      │                                              │
└──────────────────┴──────────────────────────────────────────────┘
```

### Example: Executive Summary Card
```
┌─────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  [AI Illustration: Solar panels on building]            │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  PROJECT NAME                           Prepared: 15 Jun 2025   │
│  ═══════════════════════════════════════════════════════════   │
│                                                                 │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐   │
│  │  R 2.4M   │  │   5.2     │  │   18%     │  │  1,240    │   │
│  │  Annual   │  │  Years    │  │   ROI     │  │  Tons CO2 │   │
│  │  Savings  │  │  Payback  │  │           │  │  Avoided  │   │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘   │
│                                                                 │
│  System: 500 kWp DC │ 385 kVA AC │ 200 kWh Battery            │
└─────────────────────────────────────────────────────────────────┘
```

### Example: DC/AC Comparison Chart Layout
```
┌─────────────────────────────────────────────────────────────────┐
│  DC/AC Ratio Analysis: 1:1 vs 1.3:1 Oversizing                 │
│  ───────────────────────────────────────────────────────────── │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │              [Hourly Production Chart]                  │   │
│  │         Showing baseline, oversized, clipping           │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  KEY FINDINGS                                                   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐              │
│  │   +12.4%    │ │   -2.1%     │ │   +10.3%    │              │
│  │  Additional │ │  Clipping   │ │    NET      │              │
│  │  DC Capture │ │   Losses    │ │    GAIN     │              │
│  └─────────────┘ └─────────────┘ └─────────────┘              │
│                                                                 │
│  💡 Recommendation: 1.3:1 oversizing delivers 10.3% more       │
│     energy annually with minimal clipping impact.              │
└─────────────────────────────────────────────────────────────────┘
```

### Example: Export Dialog
```
┌─────────────────────────────────────────────┐
│  Export Report                          [X] │
├─────────────────────────────────────────────┤
│                                             │
│  FORMAT                                     │
│  ○ PDF Document                             │
│  ○ Excel Workbook                           │
│  ○ Google Docs                              │
│  ○ Google Slides                            │
│  ○ Google Sheets                            │
│                                             │
│  OPTIONS                                    │
│  ☑ Include cover page                       │
│  ☑ Include table of contents                │
│  ☐ High resolution charts (larger file)     │
│                                             │
│  ─────────────────────────────────────────  │
│  Estimated size: ~4.2 MB                    │
│                                             │
│        [Cancel]        [Export]             │
└─────────────────────────────────────────────┘
```

### Review Gate
- [ ] Layout approved for Report Builder page
- [ ] Segment selection UX validated
- [ ] Chart placement approach confirmed
- [ ] Infographic card style approved
- [ ] Export flow makes sense
- [ ] Version history interaction clear

---

## Phase 1: Database Schema & Types
**Goal**: Establish database tables and TypeScript interfaces for reports

### Deliverables
- [ ] `report_configs` table - stores report segment selections
- [ ] `report_versions` table - tracks version history
- [ ] `report_segments` table - defines available segment types
- [ ] TypeScript interfaces for all report data structures
- [ ] KPI calculation types and utilities

### Database Schema
```sql
-- Report configurations per proposal
CREATE TABLE report_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID REFERENCES proposals(id),
  name TEXT NOT NULL,
  template TEXT DEFAULT 'executive', -- executive, technical, financial
  segments JSONB NOT NULL DEFAULT '[]',
  branding JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Version history for reports
CREATE TABLE report_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_config_id UUID REFERENCES report_configs(id),
  version INTEGER NOT NULL DEFAULT 1,
  snapshot JSONB NOT NULL, -- full report data at this version
  generated_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Files to Create
- `src/components/reports/types.ts`
- `src/components/reports/calculations/dcAcComparison.ts`
- `src/components/reports/calculations/kpiCalculations.ts`

### Review Gate
- [ ] Migration applied successfully
- [ ] Types compile without errors
- [ ] Calculation utilities have test coverage

---

## Phase 2: Core Chart Components
**Goal**: Build all 4 priority chart components with export capability

### Deliverables
- [ ] **DC/AC Ratio Comparison Chart** - Bar/area showing:
  - 1:1 baseline output
  - Oversized (1.3:1) output
  - Clipping losses (highlighted)
  - Net gain visualization
- [ ] **Energy Flow Sankey Diagram** - Visual flow:
  - PV Generation → Self-consumption
  - PV Generation → Grid Export
  - Grid Import → Consumption
  - Battery charge/discharge flows
- [ ] **Monthly Yield Chart** - 12-month comparison:
  - 1:1 vs oversized monthly production
  - Seasonal variation
  - Cumulative difference
- [ ] **Payback Timeline Chart** - Financial projection:
  - Investment cost line
  - Cumulative savings curve
  - Breakeven point marker
  - Year-by-year ROI markers

### Files to Create
- `src/components/reports/charts/DcAcComparisonChart.tsx`
- `src/components/reports/charts/EnergyFlowSankey.tsx`
- `src/components/reports/charts/MonthlyYieldChart.tsx`
- `src/components/reports/charts/PaybackTimelineChart.tsx`
- `src/components/reports/charts/index.ts`
- `src/components/reports/charts/chartExportUtils.ts`

### Review Gate
- [ ] All charts render with sample data
- [ ] Charts export to PNG/SVG cleanly
- [ ] Responsive and print-optimized
- [ ] Consistent styling across all charts

---

## Phase 3: AI-Generated Infographics
**Goal**: Create illustrated visual summaries using Lovable AI image generation

### Deliverables
- [ ] **Executive Summary Illustration** - Visual overview card with:
  - System size icon/illustration
  - Key savings number (large, prominent)
  - Payback period visual
  - ROI percentage badge
- [ ] **System Overview Graphic** - Illustrated diagram showing:
  - PV array representation
  - Battery storage icon
  - Grid connection
  - Load/building
- [ ] **Savings Breakdown Visual** - Illustrated pie/donut:
  - TOU period savings allocation
  - Self-consumption vs export
  - Battery contribution
- [ ] **Environmental Impact Card** - Illustrated with:
  - CO2 offset visualization
  - Tree equivalent graphic
  - Car miles avoided
- [ ] **Engineering Specs Panel** - Clean technical card:
  - DC/AC configuration
  - String layout
  - Efficiency metrics

### AI Generation Strategy
```typescript
// Use Lovable AI (Gemini) with image generation
const generateInfographic = async (type: string, data: ReportData) => {
  const prompt = buildInfographicPrompt(type, data);
  // Generate using google/gemini-2.5-flash-image-preview
  // Cache result in tour-assets bucket
};
```

### Files to Create
- `src/components/reports/infographics/ExecutiveSummaryGraphic.tsx`
- `src/components/reports/infographics/SystemOverviewGraphic.tsx`
- `src/components/reports/infographics/SavingsBreakdownGraphic.tsx`
- `src/components/reports/infographics/EnvironmentalImpactGraphic.tsx`
- `src/components/reports/infographics/EngineeringSpecsPanel.tsx`
- `src/components/reports/infographics/generateInfographic.ts`

### Review Gate
- [ ] AI generates relevant illustrations
- [ ] Images cache correctly
- [ ] Fallback to static icons if generation fails
- [ ] Professional appearance

---

## Phase 4: Report Builder UI
**Goal**: Build the report composition interface within Proposal workflow

### Deliverables
- [ ] **Segment Selector Panel** - Choose which segments to include:
  - Checkbox list with previews
  - Drag-drop reordering
  - Category grouping (Executive, Technical, Financial)
- [ ] **Template Presets** - One-click configurations:
  - Executive Summary (high-level, visual-heavy)
  - Technical Report (detailed specs, all charts)
  - Financial Analysis (ROI focus, projections)
  - Custom (user-defined)
- [ ] **Live Preview Panel** - Real-time report preview:
  - Page-by-page navigation
  - Zoom controls
  - Mobile/desktop toggle
- [ ] **Version History** - Track iterations:
  - Version list with timestamps
  - Compare versions side-by-side
  - Restore previous version

### Integration with Proposal Workflow
```
Proposal Builder Flow:
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Verify     │ → │  Configure  │ → │  Generate   │
│  Checklist  │    │  Report     │    │  & Export   │
└─────────────┘    └─────────────┘    └─────────────┘
                        ↑
                   NEW: Report Builder UI
```

### Files to Create
- `src/components/reports/ReportBuilder.tsx` - Main container
- `src/components/reports/SegmentSelector.tsx`
- `src/components/reports/ReportPreview.tsx`
- `src/components/reports/TemplateSelector.tsx`
- `src/components/reports/VersionHistory.tsx`

### Files to Modify
- `src/pages/ProposalWorkspace.tsx` - Add Report Builder tab/section

### Review Gate
- [ ] Can compose report from segments
- [ ] Preview updates in real-time
- [ ] Templates apply correctly
- [ ] Version history saves and restores

---

## Phase 5: Native Export (PDF/Excel)
**Goal**: Generate professional downloadable reports

### PDF Export Features
- [ ] **Cover Page** - Branded with:
  - Company logo
  - Project name
  - Date and version
  - Prepared by / for
- [ ] **Table of Contents** - Auto-generated from segments
- [ ] **Executive Summary Page** - AI illustration + KPIs
- [ ] **Chart Pages** - Full-page or half-page charts
- [ ] **Technical Appendix** - Detailed data tables
- [ ] **Page Headers/Footers** - Branding, page numbers, date

### Excel Export Features
- [ ] **Summary Sheet** - Key metrics dashboard
- [ ] **Hourly Data Sheet** - Detailed simulation data
- [ ] **Monthly Comparison Sheet** - 1:1 vs oversized
- [ ] **Financial Projections Sheet** - Year-by-year cashflows
- [ ] **Charts** - Embedded Excel charts where possible

### Files to Create
- `src/components/reports/export/pdfGenerator.ts`
- `src/components/reports/export/excelGenerator.ts`
- `src/components/reports/export/ExportDialog.tsx`
- `src/components/reports/export/CoverPage.tsx`
- `src/components/reports/export/TableOfContents.tsx`

### Review Gate
- [ ] PDF renders correctly in all viewers
- [ ] Excel formulas work
- [ ] Charts are crisp at print resolution
- [ ] File sizes reasonable (<10MB)

---

## Phase 6: Google Workspace Integration
**Goal**: Export directly to Google Docs, Slides, Sheets

### Deliverables
- [ ] **OAuth Flow** - Google sign-in for export
- [ ] **Google Docs Export** - Formatted report document:
  - Styled headings and sections
  - Embedded images (charts, infographics)
  - Table formatting
- [ ] **Google Slides Export** - Presentation deck:
  - Executive summary slide
  - One slide per major section
  - Chart slides with annotations
  - Conclusion/next steps slide
- [ ] **Google Sheets Export** - Data workbook:
  - Same structure as Excel export
  - Google Sheets-native charts

### Files to Create
- `supabase/functions/google-export/index.ts` - Unified export function
- `src/components/reports/export/GoogleExportButton.tsx`
- `src/hooks/useGoogleAuth.ts`

### Secrets Required
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

### Review Gate
- [ ] OAuth works end-to-end
- [ ] Documents created in user's Drive
- [ ] Formatting matches native exports
- [ ] Error handling for API failures

---

## Phase 7: Polish, Analytics & Documentation
**Goal**: Final refinements and usage tracking

### Deliverables
- [ ] **Performance Optimization**
  - Lazy load chart components
  - Cache AI-generated graphics
  - Progressive PDF generation
- [ ] **Analytics Integration**
  - Track which segments are most used
  - Export format preferences
  - Generation time metrics
- [ ] **Error Handling**
  - Retry logic for AI generation
  - Fallback graphics
  - Clear error messages
- [ ] **User Onboarding**
  - Report Builder tour
  - Help tooltips
  - Example templates
- [ ] **Documentation**
  - Update help content
  - Add to onboarding tours

### Review Gate
- [ ] Full end-to-end test with real project
- [ ] Performance benchmarks met (<5s generation)
- [ ] User acceptance testing complete
- [ ] Documentation reviewed

---

## DC/AC Ratio Analysis - Visual Specification

### Primary Comparison Visual
```
┌─────────────────────────────────────────────────────────┐
│  Daily Energy Production: 1:1 vs 1.3:1 Oversizing       │
│                                                         │
│  kWh                                                    │
│   ▲                                                     │
│ 50│        ┌─────┐ ← Theoretical DC (clipped)          │
│   │       ╱│░░░░░│╲                                    │
│ 40│      ╱ │░░░░░│ ╲  ░ = Clipping losses             │
│   │     ╱  │█████│  ╲                                  │
│ 30│    ╱   │█████│   ╲ █ = Actual AC output           │
│   │   ╱    │█████│    ╲                                │
│ 20│  ╱     │█████│     ╲                               │
│   │ ╱      │█████│      ╲ ── = 1:1 baseline           │
│ 10│╱───────│█████│───────╲                             │
│   │        │█████│                                     │
│  0└────────┴─────┴─────────▶                           │
│    6am     12pm     6pm       Hour                     │
│                                                         │
│  Key Metrics:                                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ +12.4%   │ │ -2.1%    │ │ +10.3%   │ │ +8.5%    │  │
│  │ DC Gain  │ │ Clipping │ │ Net Gain │ │ ROI Boost│  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Engineering KPIs (Always Displayed)
| KPI | Unit | Description |
|-----|------|-------------|
| Specific Yield | kWh/kWp | Energy per installed DC capacity |
| Performance Ratio | % | Actual vs theoretical output |
| Capacity Factor | % | Average output vs peak |
| LCOE | R/kWh | Levelized cost of energy |
| Self-Consumption | % | PV used on-site vs exported |
| Grid Independence | % | Load met by PV vs grid |

---

## Development Process

### Per-Phase Workflow
```
┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
│  PLAN   │ → │  BUILD  │ → │  TEST   │ → │ REVIEW  │ → │  GATE   │
│         │   │         │   │         │   │         │   │         │
│ - Tasks │   │ - Code  │   │ - Unit  │   │ - Demo  │   │ - Pass  │
│ - Scope │   │ - Tests │   │ - E2E   │   │ - Adjust│   │ - Next  │
└─────────┘   └─────────┘   └─────────┘   └─────────┘   └─────────┘
```

### Testing Checklist (Per Phase)
- [ ] Unit tests for new utilities
- [ ] Component renders without errors
- [ ] Integration with existing data
- [ ] Visual review (no layout breaks)
- [ ] Export outputs valid files

### How to Start Each Phase
Say: **"Let's start Phase [N]: [Phase Name]"**

I will:
1. Create tasks for deliverables
2. Build incrementally
3. Test each component
4. Await your review before proceeding

---

## Timeline Estimate

| Phase | Focus | Est. Sessions | Dependencies |
|-------|-------|---------------|--------------|
| 0 | Wireframes & Validation | 1 | None |
| 1 | Database & Types | 1-2 | Phase 0 approved |
| 2 | Chart Components | 2-3 | Phase 1 |
| 3 | AI Infographics | 2-3 | Phase 1 |
| 4 | Builder UI | 2-3 | Phases 2, 3 |
| 5 | PDF/Excel Export | 2-3 | Phase 4 |
| 6 | Google Integration | 3-4 | Phase 5 |
| 7 | Polish | 1-2 | Phase 6 |

**Total**: ~14-21 sessions

**Phases 2 & 3 can run in parallel** after Phase 1 completes.

---

## Ready to Start?

When ready, say:
> **"Let's start Phase 0: Wireframes & Design Validation"**

We'll review each wireframe together before moving to implementation.
