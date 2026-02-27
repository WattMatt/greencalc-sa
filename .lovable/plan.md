
# Stacked Bar Chart for Building Profile

## What Changes

Convert the Building Profile chart from side-by-side bars + lines into a **stacked bar chart** that clearly shows positive and negative power flows.

### Data Model for Stacking

The chart data needs to be transformed so that bars stack correctly. The building's energy balance at each hour is:

**Positive stack (supply to load):**
- PV to Load (solar used directly)
- Grid Import
- Battery Discharge (if battery present)

**Negative stack (export/storage):**
- Grid Export (shown as negative)
- Battery Charge (shown as negative)

The **Load** bar will remain as a separate unstacked bar for reference (shown behind the stacked bars).

### File: `src/components/projects/load-profile/charts/BuildingProfileChart.tsx`

1. **Pre-process chart data** to add negative values for export and charge:
   - Add `gridExportNeg` = `-(gridExport)` for each data point
   - Add `batteryChargeNeg` = `-(batteryCharge)` for each data point

2. **Replace individual Bars with stacked Bars** using `stackId="building"`:
   - `solarUsed` -- stackId="building", positive (amber)
   - `gridImport` -- stackId="building", positive (red)
   - `batteryDischarge` -- stackId="building", positive (orange), conditional on `includesBattery`
   - `gridExportNeg` -- stackId="building", negative (green)
   - `batteryChargeNeg` -- stackId="building", negative (green), conditional on `includesBattery`

3. **Keep Load as a separate unstacked Bar** (blue, lower opacity) so users can see the total demand envelope behind the stacked components.

4. **Add a ReferenceLine at y=0** to clearly separate positive (consumption) from negative (export/charge) flows.

5. **Update legend icons** -- change the line indicators for Charge/Discharge to square indicators (since they are now bars, not lines).

6. **Update tooltip** -- no changes needed, it already shows all values correctly.

7. **Adjust Y-axis** to auto-scale into negative territory to accommodate export and charge values below zero.

### Technical Details

```text
Stacking order (bottom to top):
  Positive:  [PV to Load] + [Grid Import] + [Battery Discharge]
  Negative:  [Grid Export] + [Battery Charge]
  Separate:  [Load] (unstacked, behind)
```

The `ComposedChart` already supports mixed stacked/unstacked bars. The key change is adding `stackId="building"` to the supply/sink bars and pre-computing negative values for export and charge so they render below the zero line.

No other chart files are affected -- this change is isolated to `BuildingProfileChart.tsx`.
