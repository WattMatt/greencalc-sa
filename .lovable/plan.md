

## Add "Solar Characteristics" Section with Discharge Sources

### Overview
Add a new collapsible section called **"Solar Characteristics"** above the existing "Battery Characteristics" section. It will contain a **"Discharge Sources"** reorderable list -- similar in design to the existing "Charge Sources" list -- that defines the priority order for dispatching solar PV energy (e.g., Load first, then Battery, then Grid Export).

---

### Changes

#### 1. Data Model (`EnergySimulationEngine.ts`)

- Add a new type `DischargeSourceId` with values: `'load'`, `'battery'`, `'grid-export'`
- Add a new `DischargeSource` interface (same shape as `ChargeSource`: `id` + `enabled`)
- Add a `DEFAULT_DISCHARGE_SOURCES` constant with default priority order:
  1. Load (enabled)
  2. Battery (enabled)
  3. Grid Export (enabled)
- Add `dischargeSources?: DischargeSource[]` to the `DispatchConfig` interface

#### 2. UI -- New Solar Characteristics Section (`AdvancedSimulationConfig.tsx`)

- Add a new `SolarCharacteristicsSection` component containing:
  - A `DischargeSourcesList` component (reusing the same drag-to-reorder pattern as `ChargeSourcesList`)
  - Labels: Load, Battery, Grid Export
  - Each item: drag handle, checkbox toggle, label, priority badge
- Add a new `CollapsibleSection` with a `Sun` icon titled "Solar Characteristics" placed **above** the Battery Characteristics section (around line 286)
- This section is always visible (no enable/disable toggle needed -- it's configuration, not a feature toggle)

#### 3. Props Threading

- Add `dischargeSources` and `onDischargeSourcesChange` props to `AdvancedSimulationConfigPanel`
- Thread these from `SimulationPanel.tsx` where the dispatch config state lives
- Store discharge sources within the existing `dispatchConfig` state (as `dispatchConfig.dischargeSources`)

#### 4. State Persistence

- Discharge sources will be persisted alongside the existing `dispatchConfig` in `results_json` -- no new state variables needed since it's part of `DispatchConfig`

---

### Technical Details

**New types in `EnergySimulationEngine.ts`:**
```typescript
export type DischargeSourceId = 'load' | 'battery' | 'grid-export';

export interface DischargeSource {
  id: DischargeSourceId;
  enabled: boolean;
}

export const DEFAULT_DISCHARGE_SOURCES: DischargeSource[] = [
  { id: 'load', enabled: true },
  { id: 'battery', enabled: true },
  { id: 'grid-export', enabled: true },
];
```

**New UI placement order in the Advanced Simulation panel:**
1. Quick Presets / My Presets (existing)
2. **Solar Characteristics** (NEW -- with Discharge Sources list)
3. Battery Characteristics (existing -- with Charge Sources list)
4. Seasonal Variation (existing)
5. Degradation Modeling (existing)
6. Financial Sophistication (existing)
7. Grid Constraints (existing)
8. Load Growth (existing)

The `DischargeSourcesList` component will mirror the existing `ChargeSourcesList` drag-and-drop pattern for a consistent user experience.
