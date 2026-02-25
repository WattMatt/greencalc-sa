
# Fix: Align Engine Solar Input with Chart Solar Data

## Root Cause

The simulation engine and the chart use **two completely different solar calculations**:

- **Chart** (`pvGeneration` in `useLoadProfileData`): Uses `pvNormalizedProfile * dcCapacityKwp * tempDerating * systemLosses`, then clips to `maxPvAcKva`. Totals **3 132 kWh**.
- **Engine** (`solarProfile` from `generateSolarProfile()`): Uses a separate Gaussian/Solcast model with its own efficiency calculation. Totals **~1 420 kWh**.

The `loadProfile` is correctly extracted from chart data (`loadProfileChartData.map(d => d.total)`), but the `solarProfile` is not. So the engine thinks there is only 1 420 kWh of solar to dispatch, while the chart shows 3 132 kWh of generation -- a fundamental mismatch.

When PV is set to "dispatch to load only", `solarUsed = Math.min(solar, load)`. Since load exceeds solar, `solarUsed = solar = 1 420` (the engine's value), not 3 132 (the chart's value). The PV curve then plots `solarUsed` at a much lower level than expected.

## Fix

### File: `src/components/projects/SimulationPanel.tsx`

Extract the engine's solar profile from the same chart data, mirroring how `loadProfile` is already done:

```text
Before:
  const effectiveSolarProfile = includesSolar ? solarProfile : loadProfile.map(() => 0);
  // where solarProfile comes from generateSolarProfile() -- a separate calculation

After:
  // Extract solar from chart data (same source as pvGeneration) for engine input
  const chartSolarProfile = useMemo(() => {
    return loadProfileChartData.map(d => d.pvGeneration || 0);
  }, [loadProfileChartData]);

  const effectiveSolarProfile = includesSolar ? chartSolarProfile : loadProfile.map(() => 0);
```

This ensures the engine receives exactly the same solar values that appear as `pvGeneration` in the charts -- including temperature derating, system losses, and DC/AC inverter clipping.

The separately-calculated `solarProfile` (from `generateSolarProfile`) will remain available for the comparison charts (Generic vs Solcast) but will no longer drive the primary simulation.

### Expected Result

| Scenario | Before | After |
|---|---|---|
| PV to load only, load > solar | solarUsed = 1 420 (wrong engine input) | solarUsed = 3 132 (matches chart pvGeneration) |
| PV to battery only | solarUsed = 0 (correct) | solarUsed = 0 (correct) |
| Grid import with PV to load | Overestimates import (underestimates solar offset) | Accurate import reflecting full solar offset |

### Files Modified
1. `src/components/projects/SimulationPanel.tsx` -- Replace engine solar input source with chart-derived values
