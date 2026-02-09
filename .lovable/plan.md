
## Cross-Site Meter Comparison Feature

### Overview
Create a new comprehensive comparison tool that allows users to compare load profiles of similar shops (meters) across different sites on daily, weekly, and monthly aggregation levels. This extends the current two-meter comparison to support multi-meter, multi-site analysis with flexible time period grouping.

---

### User Experience

The feature will be accessible from the Load Profiles page as a new tab called "Cross-Site Comparison". Users will be able to:

1. **Select multiple meters** from different sites to compare (up to 6 meters for visual clarity)
2. **Filter meters by shop type/category** to find similar shops across sites (e.g., "Supermarkets" across all sites)
3. **Choose aggregation level**: Daily, Weekly, or Monthly
4. **View comparison charts** showing overlaid or side-by-side profiles
5. **See statistical summaries** including averages, peaks, and variance between meters
6. **Export comparison data** as CSV

---

### Technical Implementation

#### 1. New Component: `CrossSiteComparison.tsx`

Location: `src/components/loadprofiles/CrossSiteComparison.tsx`

**Features:**
- Multi-select meter picker with site and category grouping
- Aggregation level toggle (Daily Average / Weekly Pattern / Monthly Trend)
- Date range filter for the comparison period
- Recharts-based visualization with multiple line series
- Statistical comparison table
- CSV export functionality

**Key States:**
```typescript
interface ComparisonConfig {
  meterIds: string[];
  aggregation: 'daily' | 'weekly' | 'monthly';
  dateFrom?: Date;
  dateTo?: Date;
  categoryFilter?: string;
  siteFilter?: string;
  dayTypeFilter: 'all' | 'weekday' | 'weekend';
}
```

#### 2. New Custom Hook: `useCrossSiteComparison.ts`

Location: `src/components/loadprofiles/hooks/useCrossSiteComparison.ts`

This hook will:
- Fetch raw data for selected meters in parallel
- Process and aggregate data based on selected time period
- Calculate comparison statistics (average, peak, variance, correlation)
- Handle large datasets efficiently with memoization

**Aggregation Logic:**
- **Daily**: Average hourly profile across all days in date range
- **Weekly**: 7-day pattern showing Mon-Sun average consumption
- **Monthly**: Month-over-month consumption totals for trend analysis

#### 3. Updates to `LoadProfiles.tsx`

Add a new tab "Cross-Site Comparison" after the existing tabs:
```tsx
<TabsTrigger value="cross-site-comparison" className="gap-2">
  <GitCompare className="h-4 w-4" />
  Cross-Site Comparison
</TabsTrigger>
```

#### 4. Database Query Optimization

The component will fetch meter metadata (without raw_data) for the selection UI, then only fetch raw_data for selected meters when comparison is triggered. This prevents loading large datasets unnecessarily.

---

### Component Structure

```text
CrossSiteComparison/
├── MeterSelector (multi-select with site/category grouping)
├── ComparisonConfig (aggregation, date range, filters)
├── ComparisonChart (Recharts LineChart with multiple series)
├── StatisticsPanel (summary stats, variance analysis)
└── ExportButton (CSV download)
```

---

### Chart Visualization Options

**Daily Aggregation View:**
- X-axis: Hours (00:00 - 23:00)
- Y-axis: Average kW
- Lines: One per selected meter
- Legend: Meter name + Site name

**Weekly Aggregation View:**
- X-axis: Days (Mon - Sun)
- Y-axis: Average daily kWh
- Lines: One per selected meter
- Shows day-of-week consumption patterns

**Monthly Aggregation View:**
- X-axis: Months (e.g., Jan 2024 - Dec 2024)
- Y-axis: Total monthly kWh
- Lines: One per selected meter
- Shows consumption trends over time

---

### Statistical Analysis Features

1. **Summary Table:**
   - Average consumption per meter
   - Peak demand per meter
   - Consumption variance
   - Energy intensity (if area_sqm available)

2. **Comparison Metrics:**
   - Percentage difference from group average
   - Consumption ranking
   - Peak hour alignment

---

### Files to Create

| File | Purpose |
|------|---------|
| `src/components/loadprofiles/CrossSiteComparison.tsx` | Main comparison component |
| `src/components/loadprofiles/hooks/useCrossSiteComparison.ts` | Data fetching and processing hook |

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/LoadProfiles.tsx` | Add new tab for Cross-Site Comparison |

---

### UI Wireframe (Conceptual)

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Cross-Site Meter Comparison                                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Filter by Category: [Supermarkets ▼]   Filter by Site: [All ▼]   │
│                                                                     │
│  Selected Meters (3/6):                                             │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐          │
│  │ ● PnP Eastgate │ │ ● PnP Sandton │ │ ● PnP Menlyn  │ [+ Add]   │
│  │   Site A       │ │   Site B       │ │   Site C       │          │
│  └────────────────┘ └────────────────┘ └────────────────┘          │
│                                                                     │
│  Aggregation: [Daily ○] [Weekly ●] [Monthly ○]                     │
│  Day Type: [All ●] [Weekdays ○] [Weekends ○]                       │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                     Comparison Chart                           │ │
│  │  kWh                                                           │ │
│  │   │     ●─────●                                                │ │
│  │   │   /         \      ▲─────▲                                 │ │
│  │   │  ●           ●───▲         \                               │ │
│  │   │ /                           ▲                              │ │
│  │   └──────────────────────────────────                          │ │
│  │     Mon   Tue   Wed   Thu   Fri   Sat   Sun                    │ │
│  │                                                                │ │
│  │  ── PnP Eastgate  ── PnP Sandton  ▲▲ PnP Menlyn               │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  Summary Statistics                              [Export CSV]       │
│  ┌─────────────┬──────────┬──────────┬──────────┬─────────────┐   │
│  │ Meter       │ Avg kWh  │ Peak kW  │ vs Avg   │ Site        │   │
│  ├─────────────┼──────────┼──────────┼──────────┼─────────────┤   │
│  │ PnP Eastgate│ 1,245    │ 98.5     │ +12%     │ Site A      │   │
│  │ PnP Sandton │ 1,089    │ 85.2     │ -2%      │ Site B      │   │
│  │ PnP Menlyn  │ 1,150    │ 92.1     │ +4%      │ Site C      │   │
│  └─────────────┴──────────┴──────────┴──────────┴─────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Implementation Notes

1. **Performance:** Only load raw_data for selected meters (up to 6), not all meters
2. **Color Assignment:** Use a predefined palette with distinct colors for each meter line
3. **Tooltip:** Show all meter values at hovered time point for easy comparison
4. **Responsive:** Chart adapts to container width, legend can wrap on mobile
5. **Category Filtering:** Leverage existing `category_id` field on `scada_imports` table to group similar shop types
