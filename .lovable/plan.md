
# Fix Vertical Alignment of Positive/Negative Bars in Building Profile Chart

## Problem
Recharts' default stacking behaviour computes a cumulative sum across all bars in a stack. This means negative-valued bars (export, battery charge) start from the top of the positive stack and extend downward from there, rather than starting from the zero line. The result is misaligned columns.

## Root Cause
The `ComposedChart` is using Recharts' default `stackOffset="none"`, which accumulates all values sequentially regardless of sign.

## Solution
Add `stackOffset="sign"` to the `ComposedChart` component. This is a built-in Recharts feature that automatically separates positive values (stacked upward from zero) and negative values (stacked downward from zero), keeping them vertically aligned in the same column.

## File to Update

**`src/components/projects/load-profile/charts/BuildingProfileChart.tsx`**

Single change on the `ComposedChart` element (line 76): add the `stackOffset="sign"` prop.

```text
Before:
<ComposedChart data={...} margin={...} barGap={1} barCategoryGap="5%">

After:
<ComposedChart data={...} margin={...} barGap={1} barCategoryGap="5%" stackOffset="sign">
```

No other changes required. All bars remain on `stackId="building"`.
