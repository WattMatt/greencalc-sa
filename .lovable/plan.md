

# Fix: Guaranteed Generation Scaling Logic

## Problem
The current code incorrectly scales **down** the guarantee for monthly and daily views when "Sun Hours" is selected. The monthly guarantee is multiplied by `23/48`, reducing it -- but the full monthly guarantee should always be shown at monthly level, and the full daily share at daily level. The scaling should only affect the per-hour or per-30min value, where fewer intervals means each interval carries a **higher** share of the guarantee.

## Correct Logic

| Timeframe | All Hours | Sun Hours |
|-----------|-----------|-----------|
| Monthly | `guaranteed_kwh` (no change) | `guaranteed_kwh` (no change) |
| Daily | `guaranteed_kwh / days` (no change) | `guaranteed_kwh / days` (no change) |
| Hourly | `daily / 24` | `daily / 11.5` (higher per hour) |
| 30 min | `daily / 48` | `daily / 23` (higher per interval) |

The monthly total and daily share are fixed regardless of the hours filter. Only hourly and 30-min views redistribute across fewer intervals when sun hours is selected, resulting in a higher per-interval value.

## Change

**File: `src/components/projects/generation/PerformanceChart.tsx`** (lines ~190-203)

Replace the `guaranteeValue` calculation:

```
const guaranteeValue = timeframe === "monthly"
  ? monthData.guaranteed_kwh
  : timeframe === "daily"
    ? dailyGuarantee
    : timeframe === "hourly"
      ? (dailyGuarantee ? dailyGuarantee / hoursPerDay : null)
      : (dailyGuarantee ? dailyGuarantee / intervalsPerDay : null);
```

- Monthly: always full value
- Daily: always `monthly / days`
- Hourly: `daily / hoursPerDay` (24 or 11.5)
- 30 min: `daily / intervalsPerDay` (48 or 23)

This keeps the `hoursPerDay` and `intervalsPerDay` variables (which already adjust based on the sun hours filter) for the sub-daily views only.

