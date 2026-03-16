

## Update KPI Cards & Tooltips to Reflect Yield/Output Overrides

### Problem
When a user enters a specific yield or daily output override, the `overrideScaleFactor` correctly scales the hourly engine profiles, but the KPI cards' simplified-mode values (`annualSolar`, tooltip breakdowns) still show the un-overridden `simplifiedAnnualProduction` and `simplifiedSpecificYield`.

### Solution
Compute "effective" simplified values that incorporate the override, and use those everywhere in the KPI section.

### Changes — `src/components/projects/SimulationPanel.tsx`

**1. After `overrideScaleFactor` (line ~274), compute effective values:**
```typescript
const effectiveSpecificYield = simplifiedSpecificYield * overrideScaleFactor;
const effectiveAnnualProduction = simplifiedAnnualProduction * overrideScaleFactor;
const effectiveDailyOutput = effectiveAnnualProduction / 365;
```

**2. Update `annualSolar` prop on `SimulationKPICards` (line ~507):**
Replace `simplifiedAnnualProduction` with `effectiveAnnualProduction`.

**3. Update `calculatedDailyOutput` and `calculatedSpecificYield` passed to `SolarModulesPane` (lines ~471-472):**
These already show the baseline — no change needed since the override inputs are separate.

**4. Update tooltip breakdowns (lines ~522-551):**
Replace raw `simplifiedSpecificYield`, `simplifiedAnnualProduction` with `effectiveSpecificYield`, `effectiveAnnualProduction` so the hover formulas reflect the actual displayed values. When an override is active, add an "Override Applied" input showing the scale factor.

### Result
Entering a specific yield of e.g. 1,600 kWh/kWp/yr (vs calculated 1,424) will immediately update: Solar Generated daily, Annual Production, and all downstream KPIs that flow from the engine's scaled profiles — with tooltips showing the overridden values.

