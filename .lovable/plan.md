
# Fix: Synchronize Simulation Engine with Chart Load Profile Data

## Problem Analysis

The simulation engine and the charts use **different load profile data sources**:

| Component | Data Source | Issue |
|-----------|-------------|-------|
| **Charts** (`useLoadProfileData.ts`) | SCADA meter data, interval corrections, area scaling, day multipliers | Accurate - shows real demand patterns |
| **Simulation** (`SimulationPanel.tsx`) | Shop type estimates only | Simplified - ignores SCADA data entirely |

This desync causes:
- Charts show realistic 680 kW peak with solar reducing grid import to ~280 kW at midday
- Simulation calculates with estimated data, resulting in `peakLoad = peakGridImport` (both 680.4 kW)
- **Demand savings show as 0 kVA** because the simulation doesn't "see" the solar offsetting load during peak hours

## Root Cause (Code Reference)

**SimulationPanel.tsx lines 515-534** - The simplified load profile calculation:
```typescript
const loadProfile = useMemo(() => {
  const profile = Array(24).fill(0);
  tenants.forEach((tenant) => {
    // ONLY uses shop type estimates - ignores SCADA data!
    const shopType = tenant.shop_type_id ? ... : null;
    const monthlyKwh = tenant.monthly_kwh_override || ...;
    const tenantProfile = shopType?.load_profile_weekday || DEFAULT_PROFILE;
    // ...
  });
  return profile;
}, [tenants, shopTypes]);
```

Meanwhile, **useLoadProfileData.ts lines 252-336** correctly handles:
- SCADA meter profiles (`tenant.scada_imports`, `tenant.tenant_meters`)
- Sub-hourly interval correction (30-min/15-min to hourly averaging)
- Area-based scaling for SCADA intensities
- Day-of-week multipliers
- Diversity factor

## Solution

Refactor the simulation to use the same load profile calculation as the charts by extracting the hourly kW profile from `useLoadProfileData` hook output.

---

## Implementation Steps

### Step 1: Extract Load Profile from Chart Hook

The `useLoadProfileData` hook already returns `chartData` with `.total` values representing the hourly kW load. Use this instead of the simplified calculation.

**File:** `src/components/projects/SimulationPanel.tsx`

Replace the simplified `loadProfile` calculation with:
```typescript
// Use the same load profile as charts (from useLoadProfileData hook)
const loadProfile = useMemo(() => {
  // loadProfileChartData already calculated with SCADA, scaling, multipliers
  return loadProfileChartData.map(d => d.total);
}, [loadProfileChartData]);
```

### Step 2: Verify Energy Simulation Uses Correct Data

The existing `energyResults` calculation at line 686 should now receive the accurate load profile:
```typescript
const energyResults = useMemo(() =>
  runEnergySimulation(loadProfile, solarProfile, energyConfig),
  [loadProfile, solarProfile, energyConfig]
);
```

With the synchronized load profile, `energyResults.peakLoad` and `energyResults.peakGridImport` will correctly reflect:
- **peakLoad**: Maximum hourly load (e.g., 680 kW at 11:00)
- **peakGridImport**: Maximum grid import after solar offset (e.g., 650 kW at 06:00)

### Step 3: Demand Savings Will Calculate Correctly

In `AdvancedSimulationEngine.ts`, the existing logic will now work:
```typescript
const demandSavingKva = Math.max(0, peakLoadKva - peakWithSolarKva);
// With correct data: (680 - 650) / 0.9 = 33 kVA saved!
```

### Step 4: Remove Redundant Load Profile Calculation

Delete the obsolete simplified `loadProfile` calculation (lines 515-534) from `SimulationPanel.tsx` since it's now derived from `loadProfileChartData`.

---

## Technical Details

### Before (Current State)
```text
Charts:           Simulation:
SCADA Data  ─────→ Charts Display    Shop Type ─────→ Energy Sim
                   (accurate)        Estimates        (inaccurate)
                                     (ignores SCADA)
```

### After (Fixed State)
```text
SCADA Data ─────→ useLoadProfileData ─────→ Charts Display
                         │                  (accurate)
                         └────────────────→ Energy Simulation
                                            (now accurate!)
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/projects/SimulationPanel.tsx` | Replace simplified loadProfile with chartData-derived profile (lines 515-534) |

---

## Expected Results

After implementation:
1. Demand kVA savings will show real reductions (e.g., 33 kVA instead of 0)
2. `newPeakDemand` will differ from `peakDemand` in saved simulations
3. Financial returns will include demand income from peak reduction
4. Charts and simulation will be fully synchronized
