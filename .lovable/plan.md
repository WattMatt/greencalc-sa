

## Fix Grid Profile, Battery Simulation, and Show 12-Month Average

### Issues Identified

1. **Grid Profile is empty when solar is off**: The `gridImport` and `gridExport` fields in `useLoadProfileData` are only computed inside an `if (showPVProfile && maxPvAcKva)` block. When solar is disabled, these are never set, so the Grid Flow chart renders blank. The fix: always compute grid import/export -- when there is no solar or battery, grid import equals total load and export is zero.

2. **Battery not charging/discharging**: The battery simulation block is gated behind `showPVProfile && maxPvAcKva`. This means battery does nothing when solar is off. The fix: run the battery simulation whenever `showBattery` is true, independent of solar. This also enables TOU Arbitrage (grid-charging) scenarios without solar.

3. **Profiles should show average over first 12 months**: Currently the charts show a single selected day. The user wants these to represent the average daily profile across the first 12 months of operation. This requires computing a monthly-averaged profile using month-specific solar yield data (from Solcast monthly factors if available) and averaging across all 12 months.

### Technical Changes

**File: `src/components/projects/load-profile/hooks/useLoadProfileData.ts`**

1. **Always compute grid fields** -- Move the `gridImport`/`gridExport`/`netLoad` calculation outside the `showPVProfile` conditional. When PV is off, set:
   - `gridImport = total` (full load comes from grid)
   - `gridExport = 0`
   - `netLoad = total`

2. **Decouple battery simulation from solar** -- Change the battery simulation gate from `if (showBattery && showPVProfile && maxPvAcKva)` to `if (showBattery)`. The battery logic already uses `gridExport` (excess PV) and `gridImport` (grid need), which will now always be populated. This enables:
   - Solar + Battery: charges from excess PV, discharges during peak/standard
   - Battery only (no solar): charges from grid during off-peak (TOU arbitrage), discharges during peak

3. **Update `gridImportWithBattery`** -- Ensure this field is also computed when battery runs without solar.

**File: `src/components/projects/SimulationPanel.tsx`**

4. **12-month average profile** -- Update the simulation chart data computation to average across 12 monthly profiles rather than showing a single day:
   - For load: use the existing daily profile (already an average for the selected day type)
   - For PV: if Solcast monthly data is available, compute 12 monthly PV profiles using each month's irradiance factor, then average them. If no Solcast data, use the single generic profile (already a yearly average)
   - For battery: simulate battery dispatch for each monthly profile, then average the results
   - Display the card title as "Average Daily Profile (Year 1)" instead of the day name
   - Remove the day navigation arrows (prev/next) since this is now a 12-month composite, not a single day view

   Alternatively, if Solcast per-month data is not readily available, a simpler approach: keep the current day-based navigation but add a toggle or default mode that shows the weighted average across all 7 days of the week for the first year. This preserves the existing architecture while meeting the "average over 12 months" requirement.

### Approach for 12-Month Average

The simplest correct approach that fits the existing architecture:

- Add a boolean state `showAnnualAverage` (default: true) to SimulationPanel
- When true, call `useLoadProfileData` with `selectedDays` containing all 7 days (Mon-Sun) and `selectedMonths` containing all 12 months -- this already produces a weighted average profile across the full year from the validated SCADA data
- The PV profile is already computed as a yearly average from Solcast normalised profile data
- The day navigation header changes to show "Annual Average (Year 1)" with no prev/next arrows
- A toggle allows switching back to per-day view

### Summary of Data Flow After Fix

```text
Without Solar, Without Battery:
  gridImport = total load
  gridExport = 0

With Solar, Without Battery:
  gridImport = max(0, total - pvGeneration)
  gridExport = max(0, pvGeneration - total)

Without Solar, With Battery:
  gridImport = total load (before battery)
  battery charges from grid during off-peak
  battery discharges during peak/standard
  gridImportWithBattery = gridImport - discharge

With Solar, With Battery:
  (existing behaviour, now correctly decoupled)
```

### Files Modified

| File | Change |
|------|--------|
| `src/components/projects/load-profile/hooks/useLoadProfileData.ts` | Always compute grid fields; decouple battery from solar gate |
| `src/components/projects/SimulationPanel.tsx` | Add annual average mode; update chart header; pass all days/months when in average mode |
