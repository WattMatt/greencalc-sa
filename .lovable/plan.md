

## GSA Specific Yield: Fixed 15% Reduction

### Current (line 251-253)
```typescript
const simplifiedSpecificYield = solarDataSource === "gsa" && gsaSpecificYield
  ? gsaSpecificYield * (1 - productionReductionPercent / 100)
  : annualGHI * 0.85 * (1 - productionReductionPercent / 100);
```

### Change
For GSA: `gsaSpecificYield * 0.85` — fixed 15% system loss, no `productionReductionPercent` stacking.

Annual production formula remains unchanged: `dcCapacity × specificYield / dcAcRatio` (already correct on line 254-256).

```typescript
const simplifiedSpecificYield = solarDataSource === "gsa" && gsaSpecificYield
  ? gsaSpecificYield * 0.85
  : annualGHI * 0.85 * (1 - productionReductionPercent / 100);
```

**One line change** in `src/components/projects/SimulationPanel.tsx`.

