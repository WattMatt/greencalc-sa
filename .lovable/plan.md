

## Problem Analysis

The simulation has **two disconnected calculation paths** for GSA:

1. **Simplified yield** (line 251-257): `gsaSpecificYield × 0.85` → used only for KPI card display and the "Specific Yield" / "Daily Output" fields in SolarModulesPane.

2. **8760 engine** (the actual simulation): Uses `solarProfileGSASimplified` — a synthetic bell-curve profile derived from GSA monthly GHI data, processed through `generateSolarProfile()` with `reductionFactor = 1 - productionReductionPercent/100`. This profile's annual sum does NOT equal `dcCapacity × gsaSpecificYield × 0.85 / dcAcRatio`. All KPIs for Grid Import, Self-Consumption, and Peak Reduction come from this engine path.

**Result**: The displayed specific yield may show one number, but the engine uses a different total solar generation — so all downstream values (grid import, self-consumption, financials) are inconsistent with the stated specific yield.

---

## Plan

### 1. Fix GSA specific yield display (SimulationPanel.tsx)
- Confirm `simplifiedSpecificYield = gsaSpecificYield * 0.85` is active (already changed)
- For Kingswalk: 1812 × 0.85 = **1540 kWh/kWp/yr**

### 2. Scale GSA solar profile to match simplified yield (useSolarProfiles.ts)
When `solarDataSource === "gsa"`, scale `solarProfileGSASimplified` so its annual total equals the target annual production:
- **Target annual production** = `dcCapacity × gsaSpecificYield × 0.85 / dcAcRatio`
- **Current profile total** = `sum(solarProfileGSASimplified) × 365`
- **Scale factor** = target / current profile total
- Apply this scale factor to the GSA profile before returning it

This ensures the 8760 engine's solar input matches the GSA-derived production, and all downstream KPIs (grid import, self-consumption, peak reduction, financials) recalculate correctly.

### 3. Remove double-application of reductionFactor for GSA profile (useSolarProfiles.ts)
Currently `solarProfileGSASimplified` applies `reductionFactor` (= `1 - productionReductionPercent/100`). Since GSA now uses a fixed 15% reduction, change the GSA profile to apply `× 0.85` instead of `× reductionFactor`. This keeps the `productionReductionPercent` slider from affecting GSA.

### Files changed
- `src/components/projects/simulation/useSolarProfiles.ts` — Scale GSA profile to match target yield, use fixed 0.85 instead of reductionFactor
- `src/components/projects/SimulationPanel.tsx` — Already correct (line 252: `gsaSpecificYield * 0.85`)

