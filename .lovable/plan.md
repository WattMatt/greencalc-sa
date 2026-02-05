

## Fix: Remove ALL Fallback Calculations - Read Directly from Simulation

### Problem
The `simModuleCount` calculation still contains fallback logic (lines 582-599) that tries to calculate the module count from capacity and wattage when `moduleCount` isn't directly stored. This results in incorrect values (813 instead of 1083) because the fallback doesn't account for DC/AC ratio correctly.

**The user's requirement is clear: NO FALLBACKS. Read the values directly from the simulation's `results_json` or show nothing.**

---

### Solution

**File: `src/components/floor-plan/components/SummaryPanel.tsx`**

Replace the entire `simModuleCount` memo with a direct read:

```typescript
// BEFORE (lines 574-600) - Has fallback calculation
const simModuleCount = useMemo(() => {
  if (!assignedSimulation) return null;
  const results = assignedSimulation.results_json;
  if (results?.moduleCount !== undefined) return results.moduleCount;
  // ... 20+ lines of fallback calculation logic ...
  return null;
}, [assignedSimulation]);

// AFTER - Direct read only, NO fallbacks
const simModuleCount = assignedSimulation?.results_json?.moduleCount ?? null;
```

Similarly for `simInverterCount` (lines 602-605) - simplify to direct read only:

```typescript
// BEFORE - Has fallback paths
const simInverterCount = assignedSimulation?.results_json?.inverterConfig?.inverterCount 
  ?? assignedSimulation?.results_json?.inverterCount 
  ?? null;

// AFTER - Single direct path only
const simInverterCount = assignedSimulation?.results_json?.inverterCount ?? null;
```

---

### Technical Details

| Value | Source | Path |
|-------|--------|------|
| Module Count | Direct read | `results_json.moduleCount` |
| Inverter Count | Direct read | `results_json.inverterCount` |

If these values don't exist in the simulation's stored data, the display will show just the placed count without a target (e.g., "1195" instead of "1195 / 1083").

---

### Files to Modify

1. **`src/components/floor-plan/components/SummaryPanel.tsx`** - Remove fallback calculation logic, use direct property access only

