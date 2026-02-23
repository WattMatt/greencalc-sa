

## Fix: Align Stacked Meter Chart with Site-Level Envelope Values

### Problem

The "By Meter" stacked chart currently computes each tenant's **maximum** independently across all filtered days, then stacks them. Because each tenant can peak on a different day, the stacked total ("sum of peaks") is always higher than the envelope's "Max" line ("peak of sums"). The two charts show inconsistent totals, which is confusing.

The correct approach: compute statistics at the **site level first**, then decompose into tenant contributions.

### How It Should Work

**Average view (default):** For each tenant, compute the average hourly value across all filtered days. Since averages are additive, the stacked total will exactly equal the envelope's "Avg" (dashed) line.

**Max view:** For each hour, find the specific **day** where the site-wide total is highest. Then show each tenant's actual value on that same day. The stacked total will exactly equal the envelope's "Max" line.

**Min view:** Same logic -- find the day with the lowest site total per hour, show each tenant's value on that day.

### Technical Details

**File: `src/components/projects/load-profile/hooks/useStackedMeterData.ts`**

1. Accept `siteDataByDate` from validated site data (needed to identify which day is the max/min at each hour)
2. Add a `mode` prop: `"avg" | "max" | "min"` (default `"avg"`)
3. Replace the current per-tenant MAX logic with three modes:

```text
Mode "avg" (default):
  For each tenant, sum their hourly values across filtered days and divide by count.
  Stacked total = site average (matches envelope avg line).

Mode "max":
  For each hour h, scan siteDataByDate to find the dateKey with the highest site total at hour h.
  Then for each tenant, use their value on THAT specific date at hour h.
  Stacked total = site max (matches envelope max line).

Mode "min":
  Same as max but find the date with the lowest site total at hour h.
  Stacked total = site min (matches envelope min line).
```

4. Include non-SCADA fallback tenants as an "Estimated" bar (using the same fallback logic from the envelope hook), so the full site load is represented.

**File: `src/components/projects/load-profile/charts/LoadEnvelopeChart.tsx`**

- Add a small mode selector (e.g. three toggle buttons: Avg / Max / Min) next to the existing Envelope/By Meter toggle, visible only in "stacked" view mode.
- Pass the selected mode down to the hook.

**File: `src/components/projects/load-profile/index.tsx`**

- Add state for the stacked mode (`useState<"avg" | "max" | "min">("avg")`)
- Pass `siteDataByDate`, `nonScadaTenants`, `shopTypes`, and the mode to `useStackedMeterData`
- Pass the mode and setter to `LoadEnvelopeChart`

### Files to Change

| File | Change |
|------|--------|
| `hooks/useStackedMeterData.ts` | Rewrite aggregation: avg/max/min modes computed at site level, decomposed per tenant; add fallback bar |
| `charts/LoadEnvelopeChart.tsx` | Add Avg/Max/Min mode toggle visible in stacked view |
| `charts/StackedMeterChart.tsx` | No changes needed (it just renders what it receives) |
| `load-profile/index.tsx` | Add stacked mode state; pass new props to hook and chart |

### Result

- In "Avg" mode: stacked total matches the envelope dashed average line exactly
- In "Max" mode: stacked total matches the envelope solid max line exactly
- In "Min" mode: stacked total matches the envelope solid min line exactly
- Non-SCADA tenants appear as an "Estimated" bar so the full site is represented
- Users can toggle between views to understand which tenants drive peak, average, or minimum demand

