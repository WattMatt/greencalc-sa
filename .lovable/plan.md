

# Fix: Auto-save Missing Battery and PV Configuration Dependencies

## Problem
The auto-save `useEffect` dependency array (lines 1302-1318 in `SimulationPanel.tsx`) only watches a subset of configuration values. Several battery and dispatch variables are **saved in the mutation body** but are **not listed as dependencies**, meaning changes to them never trigger an auto-save.

### Missing from auto-save dependency array:
- `batteryChargeCRate`
- `batteryDischargeCRate`
- `batteryDoD` (derived, but should still trigger)
- `batteryMinSoC`
- `batteryMaxSoC`
- `chargeTouPeriod`
- `JSON.stringify(dischargeTouSelection)`
- `useHourlyTouRates`

The manual save (`SavedSimulations.tsx`) and the load handler both correctly handle these fields already. The only gap is the auto-save trigger.

## Fix

### File: `src/components/projects/SimulationPanel.tsx`

**Lines 1302-1318** -- Add missing variables to the auto-save `useEffect` dependency array:

```typescript
], [
  solarCapacity,
  batteryCapacity,
  batteryPower,
  JSON.stringify(pvConfig),
  JSON.stringify(inverterConfig),
  JSON.stringify(pvsystConfig),
  JSON.stringify(advancedConfig),
  lossCalculationMode,
  productionReductionPercent,
  solarDataSource,
  JSON.stringify(systemCosts),
  blendedRateType,
  batteryStrategy,
  JSON.stringify(dispatchConfig),
  // Previously missing battery characteristics
  batteryChargeCRate,
  batteryDischargeCRate,
  batteryMinSoC,
  batteryMaxSoC,
  chargeTouPeriod,
  JSON.stringify(dischargeTouSelection),
  useHourlyTouRates,
]);
```

This is a single-line-range edit. No other files need changes -- the save payload and load handlers already include all these fields.

