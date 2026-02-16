

## Update Content Blocks to Match PDF Report Layout (Keeping Load Analysis)

### Overview
Replace the current content block definitions and their LaTeX snippets to match the structure from the provided Financial Analysis PDF. The Load Analysis section is kept and repositioned.

### New Content Block Order

| # | Block ID | Label | Description | Enabled | Required |
|---|----------|-------|-------------|---------|----------|
| 0 | `cover` | Cover Page | Title page with company details, revision, and document number | true | true |
| 1 | `tableOfContents` | Table of Contents | Section listing with page numbers | true | false |
| 2 | `adminDetails` | Administrative Details | Project location and admin info | true | false |
| 3 | `introduction` | Introduction | System description and scope | true | false |
| 4 | `backgroundMethodology` | Background & Methodology | Assumptions, tariff tables, financial return inputs | true | false |
| 5 | `tenderReturnData` | Tender Return Data | Capital costs, yield data, panel specs, load shedding impact | true | false |
| 6 | `loadAnalysis` | Load Analysis | Tenant consumption breakdown | true | false |
| 7 | `financialEstimates` | Financial Estimates | Financial return outputs per load shedding stage | true | false |
| 8 | `financialConclusion` | Financial Conclusion | Recommended baseline stage and key metrics | true | false |
| 9 | `cashflowTable` | Project Cash Flows | Landscape 20-year DCF tables per load shedding stage | true | false |
| 10 | `terms` | Terms & Conditions | Assumptions and disclaimers | true | false |
| 11 | `signature` | Signature Block | Authorization signatures | true | true |

### Blocks Removed
- `executiveSummary` -- replaced by Introduction
- `siteOverview` -- replaced by Administrative Details
- `systemDesign` -- removed
- `equipmentSpecs` -- equipment info now captured in Tender Return Data
- `energyFlow` -- removed
- `financialSummary` -- replaced by Financial Estimates + Financial Conclusion
- `sensitivityAnalysis` -- replaced by load shedding stage analysis

### Files to Change

| File | Action | What Changes |
|------|--------|-------------|
| `src/components/proposals/types.ts` | Modify | Update `ContentBlockId` union type and `DEFAULT_CONTENT_BLOCKS` array |
| `src/lib/latex/templates/snippets.ts` | Modify | Add new snippet functions: `tableOfContents`, `administrativeDetails`, `introduction`, `backgroundMethodology`, `tenderReturnData`, `financialEstimates`, `financialConclusion`. Update `coverPage` to match PDF format. Keep `loadAnalysis`, `termsAndConditions`, `signatureBlock`. Update `cashflowTable` for landscape per-stage DCF tables |
| `src/lib/latex/templates/proposalTemplate.ts` | Modify | Update preamble (8pt, new geometry, new packages: `pdflscape`, `longtable`, `multirow`, `siunitx`, `colortbl`, `array`), add `\negnum` command, update header/footer format, update switch-case mapping for new block IDs |

### Implementation Details

**1. `types.ts`**

New `ContentBlockId` union:
```
'cover' | 'tableOfContents' | 'adminDetails' | 'introduction' |
'backgroundMethodology' | 'tenderReturnData' | 'loadAnalysis' |
'financialEstimates' | 'financialConclusion' | 'cashflowTable' |
'terms' | 'signature'
```

**2. New snippet functions (`snippets.ts`)**

- `tableOfContents()`: Manual tabular TOC matching PDF style
- `administrativeDetails(project, simulation)`: Location field in simple format
- `introduction(simulation, project)`: Paragraph describing the kWp AC system scope
- `backgroundMethodology(simulation, project)`: Two tables -- TOU tariff breakdown (High/Low demand, blended) and Financial Return Inputs (Cost of Capital, CPI, Electricity Inflation, discount rate, MIRR rates, insurance, replacement costs)
- `tenderReturnData(simulation, project)`: Capital cost breakdown table + load shedding impact table (Stages 0-8 with kWh/annum) + system specs (kWp DC/AC, panel count, area, efficiency, degradation)
- `financialEstimates(simulation)`: Two tables showing financial outputs (ZAR/kWh, ZAR/Wp DC/AC, LCOE, Initial Yield, IRR, MIRR, Payback, NPV) for Stages 0-4 and Stages 5-8
- `financialConclusion(simulation)`: Recommended baseline stage with key metrics table
- Updated `cashflowTable(simulation)`: Landscape DCF tables using `longtable` with columns: Year, Energy Yield, Tariff, Income(kWh), Demand Saving(kVA), Tariff(R/kVA), Income(kVA), Total Income, Project Cost, O&M, Insurance, Replacement, Net Cash Flow, PV Factor. One table per load shedding stage

**3. `proposalTemplate.ts` preamble updates**

- Document class: `[8pt, a4paper]{article}`
- Geometry: `top=3cm, bottom=3.5cm, left=1.5cm, right=1.5cm, headheight=40pt`
- New packages: `pdflscape`, `longtable`, `multirow`, `siunitx`, `colortbl`, `array`, `helvet`
- Sans-serif font default: `\renewcommand{\familydefault}{\sfdefault}`
- Add `\newcommand{\negnum}[1]{(#1)}`
- Header: project name (left), "Financial Analysis" + date + revision (right)
- Footer: document number (left), page number (right)

### Data Sources

All data comes from existing `SimulationData` and project fields:
- `yearlyProjections[]` feeds the cashflow tables
- `solarCapacity`, `systemCost`, `npv`, `irr`, `paybackYears`, `lcoe` feed the financial tables
- `equipmentSpecs` feeds tender return data
- `demandSavingKva` feeds the demand columns
- Load shedding stage reductions are calculated by applying percentage factors to Stage 0 yield
- Tenant data continues to feed Load Analysis as before

