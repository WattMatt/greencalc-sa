

# Fix: Module Count and Collector Area Not Propagating to PV Calculations

## Problem

When the user changes the solar module type (which changes module count, collector area, and actual DC capacity), the PV generation does not update. There are **three places** where the DC capacity is calculated using a theoretical formula that ignores the actual module selection:

1. **`useLoadProfileData` stable engine call** (line 584): `dcCapacityKwp: solarCapacity * inverterConfig.dcAcRatio`
2. **`useLoadProfileData` per-day chart call** (line 614): same formula
3. **Annual PVsyst calculation** (line 770): `dcCapacityKwp = inverterConfig.inverterSize * inverterConfig.inverterCount * inverterConfig.dcAcRatio`

Meanwhile, `moduleMetrics.actualDcCapacityKwp` correctly accounts for the rounded-up module count (e.g., 640 x 545W = 348.8 kWp vs the theoretical 346.5 kWp). The TMY path already uses `moduleMetrics.collectorAreaM2` and `moduleMetrics.stcEfficiency` correctly for the conversion, but the simplified path feeding the chart ignores module selection entirely.

## Solution

Replace all theoretical DC capacity calculations with `moduleMetrics.actualDcCapacityKwp` across three locations in `SimulationPanel.tsx`.

### Changes (single file: `src/components/projects/SimulationPanel.tsx`)

**1. Stable engine `useLoadProfileData` call (~line 584)**

Change:
```typescript
dcCapacityKwp: solarCapacity * inverterConfig.dcAcRatio,
```
To:
```typescript
dcCapacityKwp: moduleMetrics.actualDcCapacityKwp,
```

**2. Per-day chart `useLoadProfileData` call (~line 614)**

Same change:
```typescript
dcCapacityKwp: solarCapacity * inverterConfig.dcAcRatio,
```
To:
```typescript
dcCapacityKwp: moduleMetrics.actualDcCapacityKwp,
```

**3. Annual PVsyst calculation (~line 770)**

Change:
```typescript
const dcCapacityKwp = inverterConfig.inverterSize * inverterConfig.inverterCount * inverterConfig.dcAcRatio;
```
To:
```typescript
const dcCapacityKwp = moduleMetrics.actualDcCapacityKwp;
```

### Why This Works

- `moduleMetrics.actualDcCapacityKwp` = `ceil(acCapacity * dcAcRatio * 1000 / moduleWp) * moduleWp / 1000`
- When the user picks a different module (e.g., 450W vs 545W), the rounded module count changes, which changes the actual DC capacity, collector area, and therefore PV generation
- The TMY conversion path already correctly uses `moduleMetrics.collectorAreaM2` and `moduleMetrics.stcEfficiency` -- no changes needed there
- The inverter AC clipping limit (`maxPvAcKva`) remains correctly derived from `inverterConfig.inverterSize * inverterConfig.inverterCount`

### Ordering Note

`moduleMetrics` is computed at line 671, before all three consumption points (lines 584, 614, 770). However, lines 584 and 614 appear *before* 671 in the file. Since `useMemo` hooks are evaluated during render (not at declaration order), this works correctly in React -- but the `moduleMetrics` dependency must be added to the dependency arrays of the two `useLoadProfileData` calls if not already implicitly captured via the input prop change.

### Impact

- All three PV calculation paths (simplified chart, annual PVsyst, TMY 8760-hour) will now respond to module selection changes
- Module count, collector area, and actual DC capacity are consistently derived from the selected module
- No changes needed to `useLoadProfileData.ts`, `tmySolarConversion.ts`, or `SolarModulePresets.ts`

