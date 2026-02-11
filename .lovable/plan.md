

# Fix Downtime Calculation: Account for Actual Data Interval

## Problem
The downtime calculation assumes 1-hour intervals (12 readings between 06:00-18:00), but the data uses 30-minute intervals (24 readings). This causes downtime to be double-counted, exceeding the yield guarantee on days with significant downtime.

## Solution
Detect the actual reading interval from the data and use the correct divisor.

### File: `src/components/projects/generation/PerformanceSummaryTable.tsx`

1. **Detect interval**: After fetching readings, determine the interval between consecutive timestamps (e.g., 30 min = 0.5 hours).
2. **Calculate correct divisor**: Sun hours (12) divided by interval in hours gives the number of expected readings. For 30-min data: `12 / 0.5 = 24`.
3. **Update downtime formula**: Change `dailyGuarantee / 12` to `dailyGuarantee / sunHourReadingsCount` so each zero reading contributes its correct proportional share.

Fallback: If the interval cannot be detected (e.g., too few readings), default to 24 (30-min intervals) based on the known data architecture.

