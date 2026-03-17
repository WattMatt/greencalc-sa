

## Bug: Double-discounting GSA Specific Yield

**Root cause**: `PVOUT_csi` from Global Solar Atlas is already a net specific yield for crystalline silicon modules (includes standard system losses). Line 252 in `SimulationPanel.tsx` multiplies it by 0.85, applying a redundant 15% loss. This reduces the correct 1,587 kWh/kWp to ~1,349.

**Fix**: Use `PVOUT_csi` directly without the 0.85 multiplier when GSA is the data source.

### File: `src/components/projects/SimulationPanel.tsx` (~line 251-253)

Change:
```typescript
const simplifiedSpecificYield = solarDataSource === "gsa" && gsaSpecificYield
  ? gsaSpecificYield * 0.85
  : annualGHI * 0.85 * (1 - productionReductionPercent / 100);
```

To:
```typescript
const simplifiedSpecificYield = solarDataSource === "gsa" && gsaSpecificYield
  ? gsaSpecificYield
  : annualGHI * 0.85 * (1 - productionReductionPercent / 100);
```

### Also check: GSA simplified solar profile in `useSolarProfiles.ts`

The `solarProfileGSASimplified` memo (line ~194) applies `* 0.85` to the hourly profile and then scales to match `PVOUT_csi * 0.85`. This scaling target should also use `PVOUT_csi` directly (without the extra 0.85) to stay consistent with the corrected specific yield.

### Files to modify
1. `src/components/projects/SimulationPanel.tsx` — Remove 0.85 from GSA specific yield
2. `src/components/projects/simulation/useSolarProfiles.ts` — Update GSA profile scaling target to use `PVOUT_csi` directly

