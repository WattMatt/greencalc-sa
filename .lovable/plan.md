
# Fix Double-Counting of Solar and Battery kWh in Cashflow

## The Bug

When PV is configured to charge the battery only (not serve load directly), and the battery then discharges to load or grid, the cashflow table shows **both** Solar Direct kWh income **and** Battery Discharge kWh income -- double-counting the same energy.

### Root Cause

The `netBatteryFlows` function in `EnergySimulationEngine.ts` (lines 322-346) resolves simultaneous battery charge + discharge by reclassifying energy. When PV charges battery (`batteryCharge > 0`) while battery also discharges to load (`batteryDischarge > 0`), netting inflates `solarUsed` by the offset amount -- even when `loadDischargeAllowed` was `false`.

```text
// netBatteryFlows inflates solarUsed regardless of user config:
solarUsed: result.solarUsed + offset,   // <-- adds to solarUsed even if solar-to-load was disabled
batteryCharge: netCharge,
batteryDischarge: 0,
```

The financial engine then uses `solarUsed` as "Solar Direct" income (line 84 of `AdvancedSimulationEngine.ts`), AND counts `batteryDischarge` separately. The same kWh gets monetised twice.

### The Fix: Track intentional solar-to-load separately

Add a `solarDirectToLoad` field that captures only the **intentional** solar-to-load dispatch (before netting). The financial engine uses this field for income instead of `solarUsed`.

## Changes

### 1. EnergySimulationEngine.ts -- Add `solarDirectToLoad` field

**HourResult interface** (line 262): Add `solarDirectToLoad: number`.

**Each dispatch function** (`dispatchSelfConsumption`, `dispatchTouArbitrage`, `dispatchPeakShaving`, `dispatchScheduled`): Set `solarDirectToLoad` to the pre-netting `solarUsed` value (i.e., what was explicitly dispatched to load based on permissions).

**`netBatteryFlows`** (line 322): Preserve `solarDirectToLoad` from the input -- do NOT inflate it. Only `solarUsed` gets adjusted for energy balance.

**HourlyEnergyData interface** (line 135): Add `solarDirectToLoad: number`.

**AnnualEnergySimulationResults interface**: Add `totalAnnualSolarDirectToLoad: number`.

**Hourly data push** (lines 613, 924): Include `solarDirectToLoad` from the dispatch result.

**Annual totals**: Accumulate `totalAnnualSolarDirectToLoad` alongside existing totals.

### 2. AdvancedSimulationEngine.ts -- Use `solarDirectToLoad` for income

**`calculateAnnualHourlyIncome`** (line 84): Replace `hour.solarUsed` with `hour.solarDirectToLoad` (falling back to `solarUsed` for backward compatibility if the field is undefined).

```text
// Before:
totalSolarDirectKwh += hour.solarUsed;
totalSolarDirectIncome += hour.solarUsed * rate;

// After:
const solarDirect = hour.solarDirectToLoad ?? hour.solarUsed;
totalSolarDirectKwh += solarDirect;
totalSolarDirectIncome += solarDirect * rate;
```

**Cashflow yearly projection** (line 495): Use `totalAnnualSolarDirectToLoad` instead of `totalAnnualSolarUsed` for `baseSolarDirectKwh`.

```text
// Before:
const baseSolarDirectKwh = annualEnergyResults?.totalAnnualSolarUsed ?? ...

// After:
const baseSolarDirectKwh = annualEnergyResults?.totalAnnualSolarDirectToLoad
  ?? annualEnergyResults?.totalAnnualSolarUsed
  ?? baseEnergyResults.totalSolarUsed * 365;
```

### 3. No chart or UI changes

`solarUsed` remains unchanged for energy balance in charts (Building Profile, Load, Grid, Solar, Battery). Only the **financial income** calculation switches to using the new `solarDirectToLoad` field.

## Expected Result

When PV is configured to charge battery only (load discharge disabled):
- Solar Direct kWh in cashflow = **0** (no PV-to-load income)
- Battery Discharge kWh = actual discharge (sole income source for stored energy)
- No double-counting

When PV serves load directly AND charges battery:
- Solar Direct kWh = only the portion that directly offset load (as configured)
- Battery Discharge kWh = battery output to load
- Both are legitimate, non-overlapping income streams

## Files Changed

| File | Change |
|------|--------|
| `src/components/projects/simulation/EnergySimulationEngine.ts` | Add `solarDirectToLoad` to `HourResult`, `HourlyEnergyData`, `AnnualEnergySimulationResults`; set it in all dispatch functions; preserve it through `netBatteryFlows`; accumulate in annual totals |
| `src/components/projects/simulation/AdvancedSimulationEngine.ts` | Use `solarDirectToLoad` instead of `solarUsed` in `calculateAnnualHourlyIncome` and in cashflow projection base kWh |
