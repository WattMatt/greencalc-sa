

## Update Annual Production & Daily Output Formulas

### New Calculation Chain
The user wants to add a DC/AC ratio division step to convert DC-side energy to AC-side output:

```text
1. DC Capacity      = AC System Size × DC/AC Ratio
2. Specific Yield   = Annual GHI × 0.85 × (1 - reduction%)
3. Annual Production = (DC Capacity × Specific Yield) ÷ DC/AC Ratio
4. Daily Output     = Annual Production ÷ 365
```

This effectively means Annual Production = AC System Size × Specific Yield (the DC/AC ratio cancels out), but the user wants the explicit chain preserved for transparency.

### Changes in `src/components/projects/SimulationPanel.tsx`

1. **Line ~251-253**: Update `simplifiedDailyOutput` calculation:
   ```typescript
   const simplifiedAnnualProduction = simplifiedDcCapacity * simplifiedSpecificYield / inverterConfig.dcAcRatio;
   const simplifiedDailyOutput = simplifiedAnnualProduction / 365;
   ```

2. **Line ~506**: Update `annualSolar` passed to KPI cards:
   ```typescript
   annualSolar={... simplifiedDcCapacity * simplifiedSpecificYield / inverterConfig.dcAcRatio}
   ```

3. **Update all tooltip breakdowns** (~lines 522-548) to show the new formula chain:
   - Solar Generated: `(DC Capacity × Specific Yield ÷ DC/AC Ratio) ÷ 365`
   - Annual Production: `DC Capacity × Specific Yield ÷ DC/AC Ratio` with DC/AC Ratio as an input

