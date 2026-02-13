

# Fix: Building Toggle Stacking Behavior and Button Order

## Summary

Two changes:
1. Swap the **kWh** and **Building** button positions so order becomes: Sources, Building, kWh
2. Fix the stacking logic so when **Building is OFF**, the council demand bar appears as a standalone bar next to the solar bars (not stacked with them)

## Stacking Behavior Matrix

| Sources | Building | Solar Bars | Council Demand Bar |
|---------|----------|------------|--------------------|
| OFF | OFF | Standalone bar | Standalone bar (side by side) |
| OFF | ON | stackId="building" | stackId="building" (stacked) |
| ON | OFF | stackId="solar" (stacked sources) | Standalone bar (side by side) |
| ON | ON | stackId="solar" | stackId="solar" (all stacked together) |

## Technical Details

### File: `src/components/projects/generation/PerformanceChart.tsx`

**Change 1 — Swap buttons (lines 408-423):**
Move the Building button block (lines 416-423) before the kWh button block (lines 408-415).

**Change 2 — Fix building_load stackId (line 551):**
Current: `stackId={stackBars ? "building" : (showSources ? "solar" : undefined)}`
New: `stackId={stackBars ? (showSources ? "solar" : "building") : undefined}`

When Building toggle is OFF (`stackBars` is false), `stackId` becomes `undefined`, making it a standalone bar. When Building is ON and Sources is ON, it joins the `"solar"` stack. When Building is ON and Sources is OFF, it uses `"building"` stack shared with the solar bar.

