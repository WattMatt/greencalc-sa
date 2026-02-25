
# Fix: Wire Engine's `solarUsed` Into Charts So Dispatch Settings Are Visually Reflected

## Problem

The simulation engine correctly computes `solarUsed = 0` when PV is configured to only charge the battery (load discharge disabled). However, the charts never reflect this because:

1. **Missing data merge**: The `simulationChartData` merge (SimulationPanel.tsx ~line 967) copies `batteryCharge`, `batteryDischarge`, `gridImport`, `gridExport` from engine results but **does not include `solarUsed`**.
2. **Charts use raw generation**: Both the Building Profile and PV Profile charts plot `pvGeneration` (raw panel output from the load profile), not the engine's dispatched values. So they always show the full solar bell curve regardless of dispatch settings.

Result: Even when PV-to-load is disabled, the charts visually show PV "discharging" into the load all day.

## Solution

### 1. Add `solarUsed` to `ChartDataPoint` type
**File: `src/components/projects/load-profile/types.ts`**
- Add `solarUsed?: number` field to the `ChartDataPoint` interface.

### 2. Merge `solarUsed` from engine into chart data
**File: `src/components/projects/SimulationPanel.tsx`**
- In the `simulationChartData` merge (~line 967), add: `solarUsed: engineHour.solarUsed`

### 3. Update Building Profile chart to show actual solar dispatch
**File: `src/components/projects/load-profile/charts/BuildingProfileChart.tsx`**
- Change the PV area from plotting `pvGeneration` (raw output) to `solarUsed` (actual solar-to-load).
- Update the legend to distinguish:
  - "PV to Load" showing `solarUsed` totals
  - Keep `pvGeneration` as a reference line or secondary info
- When `solarUsed = 0` (PV not feeding load), the PV area correctly disappears from the building profile.

### 4. Update PV Profile chart to show dispatch breakdown
**File: `src/components/projects/load-profile/charts/SolarChart.tsx`**
- Add `solarUsed` to the chart interface props/data.
- Show the total generation curve as-is (panels still produce power).
- Add a visual indicator or annotation showing where the solar goes:
  - "To Load: X kWh" vs "To Battery: Y kWh" vs "Curtailed: Z kWh" in the legend/badges.
- This way the PV Profile still shows raw generation (physical reality) but clearly communicates that PV is NOT feeding the load.

## Expected Behaviour After Fix

| Scenario | Building Profile | PV Profile |
|---|---|---|
| PV to Load enabled (default) | PV area overlaps load (current behaviour) | Shows generation + "To Load: X kWh" |
| PV to Battery only | PV area disappears from building profile | Shows generation + "To Load: 0 kWh, To Battery: Y kWh" |
| Battery None + PV to Battery | No PV area, no battery discharge, grid = full load | Generation curve + "To Battery: Y kWh" |

## Files Modified
1. `src/components/projects/load-profile/types.ts` -- Add `solarUsed` to ChartDataPoint
2. `src/components/projects/SimulationPanel.tsx` -- Merge `solarUsed` from engine
3. `src/components/projects/load-profile/charts/BuildingProfileChart.tsx` -- Plot `solarUsed` instead of `pvGeneration`
4. `src/components/projects/load-profile/charts/SolarChart.tsx` -- Add dispatch breakdown to legend
