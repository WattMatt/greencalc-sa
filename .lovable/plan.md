

## Update Downtime Detection: Threshold and Consecutive-Slot Rule

### Changes to `src/components/projects/generation/PerformanceSummaryTable.tsx`

**Location:** Lines 288-298 (the downtime calculation loop)

### 1. Lower the threshold from 1% to 0.05%

Current (line 292):
```
const threshold = perSlotEnergy * 0.01;
```
New:
```
const threshold = perSlotEnergy * 0.0005;
```

### 2. Require two consecutive below-threshold slots to classify as downtime

Currently, any single slot below the threshold is counted as downtime. The new logic:

1. First pass: for each source on each day, iterate through all sun-hour slots and record which ones are below the 0.05% threshold (store as a boolean array or set of slot indices).
2. Second pass: only mark a slot as downtime if **both it and the immediately preceding slot** are below the threshold. The first slot of the day can only be downtime if slot 2 is also below threshold (i.e., require a pair).
3. This means isolated single-slot dips are ignored; only sustained periods (2+ consecutive slots) count.

### Technical Detail

Replace lines 288-298 with:

```typescript
// First pass: identify below-threshold slots
const slotTimes: number[] = [];
const belowThreshold: boolean[] = [];
for (let min = sunStartMin; min <= sunEndMin; min += slotIntervalMin) {
  slotTimes.push(min);
  const key = `${d}-${min}-${sourceLabel}`;
  const val = readingLookup.get(key);
  const actualVal = (val !== undefined && val !== null) ? val : 0;
  const threshold = perSlotEnergy * 0.0005;
  belowThreshold.push(actualVal < threshold);
}

// Second pass: only count downtime when 2+ consecutive slots are below threshold
for (let i = 0; i < slotTimes.length; i++) {
  if (!belowThreshold[i]) continue;
  const hasConsecutive =
    (i > 0 && belowThreshold[i - 1]) ||
    (i < slotTimes.length - 1 && belowThreshold[i + 1]);
  if (hasConsecutive) {
    const key = `${d}-${slotTimes[i]}-${sourceLabel}`;
    const val = readingLookup.get(key);
    const actualVal = (val !== undefined && val !== null) ? val : 0;
    entry.downtimeSlots += 1;
    entry.downtimeEnergy += (perSlotEnergy - actualVal);
    sd.downtimeSlots += 1;
    sd.downtimeEnergy += (perSlotEnergy - actualVal);
  }
}
```

**File:** `src/components/projects/generation/PerformanceSummaryTable.tsx`, lines 288-298

