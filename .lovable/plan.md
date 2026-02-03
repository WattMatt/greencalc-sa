
# Site-Isolated Meter Viewing and Preview Options

## Current State Analysis

When you select a site in the Sites Tab, you currently have:
- A meter table showing all meters assigned to the site
- Individual meter preview dialogs (triggered by the eye icon)
- Bulk actions like reprocess and delete

However, the more advanced analysis views (MeterAnalysis, MeterComparison, ProfileStacking) operate globally and are not scoped to the selected site.

---

## Options for Enhancing Site-Scoped Meter Views

### Option A: Add Analysis Tabs to Site Detail View
Add tabbed navigation within the selected site context:

```
Selected Site: "Segonyana Mall"
[Meters] [Analysis] [Comparison] [Stacking]
```

**Technical approach:**
- Extend SitesTab.tsx to include tabs when a site is selected
- Reuse existing components with `siteId` prop:
  - MeterAnalysis already supports `siteId` filtering
  - MeterLibrary already supports `siteId` filtering
- Add `siteId` support to MeterComparison and ProfileStacking

**Benefits:**
- All analysis tools scoped to site context
- Consistent UX - stay within site workflow
- Reuses existing components

---

### Option B: Create a Site Dashboard Component
A dedicated `SiteMeterDashboard` component that provides:

1. **Summary Stats Card**
   - Total meters, meters with data, total kWh, peak demand
   
2. **Aggregated Site Load Profile Chart**
   - Combines all site meters into one stacked view
   - Weekday/Weekend toggle
   - Date range selection

3. **Top Contributors Panel**
   - Ranked list of meters by consumption
   
4. **Quick Actions**
   - Jump to individual meter preview
   - Export site-wide report

**Technical approach:**
- New component: `SiteMeterDashboard.tsx`
- Fetch all meters for site with profiles
- Calculate aggregated profile from individual meter profiles

---

### Option C: Interactive Plotly-Style Graph (Based on Uploaded File)
Implement a similar visualization to the uploaded HTML file using Plotly.js:

1. **Multi-meter line chart**
   - Multiple series overlaid
   - Interactive zoom/pan
   - Hover tooltips with exact values

2. **Controls**
   - Meter selection checkboxes
   - Date range picker
   - Aggregation period (hourly/daily)

**Technical approach:**
- Install `plotly.js-dist` or `react-plotly.js`
- New component: `SiteLoadProfileGraph.tsx`
- Similar to ProfileStacking but with Plotly rendering

---

### Option D: Hybrid Approach (Recommended)
Combine Options A and B for the best coverage:

**Phase 1: Site-scoped tabs**
```
Site Detail View:
├── [Meters Tab] - Current meter table
├── [Analysis Tab] - MeterAnalysis with siteId
├── [Stacking Tab] - ProfileStacking with siteId  
└── [Overview Tab] - New summary dashboard
```

**Phase 2: Site overview dashboard**
- Aggregated load profile chart
- Consumption summary by meter
- Quick preview links

---

## Implementation Plan (Option D - Hybrid)

### Step 1: Add Tab Navigation to Site Detail
Modify SitesTab.tsx to include internal tabs when a site is selected:
- Meters (current view)
- Analysis
- Stacking
- Overview (new)

### Step 2: Pass siteId to Existing Components
- MeterAnalysis already accepts `siteId`
- Update ProfileStacking to accept and use `siteId`
- Update MeterComparison to accept and use `siteId`

### Step 3: Create SiteMeterOverview Component
New component with:
- Summary statistics for the site
- Aggregated stacked profile chart (all meters combined)
- Table of meters ranked by consumption
- Links to individual meter previews

### Step 4: Optional Plotly Enhancement
If richer interactivity is needed:
- Add `react-plotly.js` dependency
- Create enhanced chart component with zoom/pan

---

## Technical Details

### Files to Modify
1. `SitesTab.tsx` - Add internal tabs for site detail view
2. `ProfileStacking.tsx` - Add optional `siteId` prop for filtering
3. `MeterComparison.tsx` - Add optional `siteId` prop for filtering

### Files to Create
1. `SiteMeterOverview.tsx` - New dashboard component
2. Optional: `SiteLoadProfileChart.tsx` - Plotly-based visualization

### Database Queries
All components will use existing `scada_imports` table queries filtered by `site_id`:
```sql
SELECT * FROM scada_imports WHERE site_id = :selectedSiteId
```

---

## User Flow After Implementation

1. Go to Load Profiles > Sites tab
2. Click on a site (e.g., "Segonyana Mall")
3. See tabs: **Meters | Analysis | Stacking | Overview**
4. **Meters tab**: Current meter table with individual previews
5. **Analysis tab**: Deep-dive into raw data for any site meter
6. **Stacking tab**: Combine site meters into aggregated profile
7. **Overview tab**: Site-wide summary and aggregated chart

All views remain isolated to the selected site context.
