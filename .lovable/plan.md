

# Building Profile: Load as Line + Fix Colour Blending

## Changes

### File: `src/components/projects/load-profile/charts/BuildingProfileChart.tsx`

**1. Import `Line` from recharts** (add to existing import on line 1).

**2. Convert Load from Bar to Line overlay**
- Remove `<Bar dataKey="total" ...>` (line 130)
- Add a `<Line>` element **after** all Bar elements so it renders on top:
  - `type="stepAfter"` for a stepped profile matching the bar edges
  - `dataKey="total"`, stroke = `hsl(var(--primary))`, `strokeWidth={2}`, `dot={false}`

**3. Increase bar fillOpacity to eliminate brown blending**
The muddy brown colour is caused by semi-transparent red (import) stacking on top of semi-transparent amber (solar). Increasing opacity to near-opaque prevents bleed-through:
- `solarUsed`: fillOpacity 0.6 -> 0.85
- `gridImport`: fillOpacity 0.5 -> 0.85
- `batteryDischarge`: fillOpacity 0.6 -> 0.85
- `gridExportNeg`: fillOpacity 0.5 -> 0.7
- `batteryChargeNeg`: fillOpacity 0.3 -> 0.6

**4. Update Load legend indicator** from a square to a line dash to reflect it is now a line, not a bar.

### Visual Result
```text
Line (on top):  ---- Load (blue stepped line) ----
Bars (stacked):  [PV to Load] + [Grid Import] + [Battery Discharge]  (positive, opaque)
                 [Grid Export] + [Battery Charge]  (negative)
Reference:       ---- y=0 line ----
```

No other files are affected.

