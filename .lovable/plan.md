
# Plan: Ensure Plant Setup Syncs with Live Simulation Data

## Problem Analysis

The user identified two related issues:

1. **Simulation auto-save appears broken** - The Simulation tab shows "0 saved simulations" despite displaying "Auto-saves on tab change", and the user reports simulations do not persist when switching tabs
2. **Plant Setup sync shows stale data** - The "Sync from Simulation" button fetches from database records that may not exist or may be outdated

## Root Cause Investigation

Based on the codebase review:

1. **Auto-save mechanism exists** - SimulationPanel has debounced auto-save (1500ms delay) that triggers on configuration changes
2. **Tab change triggers save** - `handleTabChange` in ProjectDetail calls `simulationRef.current.saveIfNeeded()` when leaving the Simulation or Costs tabs
3. **Possible issue** - The network logs show DELETE operations on `project_simulations`, which could explain why "0 saved simulations" appears. Simulations may be getting cleaned up or the user deleted them.
4. **Plant Setup fetches from DB** - The `onSyncFromSimulation` callback queries the database, but if no simulation record exists, it returns nothing

## Proposed Solution

### 1. Make Plant Setup sync from the LIVE simulation state (not database)

Instead of querying the database when "Sync from Simulation" is clicked, pass the current simulation configuration directly from the parent component. This ensures:
- The values are always up-to-date with what the user sees in the Simulation tab
- No database round-trip is needed
- Works even before the first auto-save occurs

**Implementation:**
- Pass `latestSimulation` or `inverterConfig` prop from ProjectDetail through FloorPlanMarkup
- Update FloorPlanMarkup to receive optional simulation config as a prop
- Modify PlantSetupModal's `onSyncFromSimulation` to use the passed prop instead of fetching

### 2. Add visual feedback when simulation has no saved record

When the Plant Setup modal opens, if there's no saved simulation:
- Show a helpful message explaining that simulation data will sync after the user configures and saves a simulation
- Disable the "Sync from Simulation" button if no simulation data is available

### 3. Ensure simulation auto-save triggers reliably

Verify that leaving the Simulation tab (to PV Layout, for example) triggers the auto-save by:
- Checking the handleTabChange function includes "pv-layout" in its save trigger conditions
- Adding immediate save (not just debounced) when navigating away from simulation

## Technical Changes

### File: `src/pages/ProjectDetail.tsx`

Pass the latest simulation to FloorPlanMarkup:

```typescript
<TabsContent value="pv-layout" className="mt-6">
  <FloorPlanMarkup 
    projectId={id!} 
    latestSimulation={latestSimulation}
  />
</TabsContent>
```

### File: `src/components/floor-plan/FloorPlanMarkup.tsx`

1. Add prop for simulation data:
```typescript
interface FloorPlanMarkupProps {
  projectId: string;
  latestSimulation?: {
    results_json?: any;
  };
}
```

2. Update PlantSetupModal to use passed simulation data directly instead of fetching

### File: `src/components/floor-plan/components/PlantSetupModal.tsx`

Remove the async database fetch from `onSyncFromSimulation` - the parent will pass the simulation data directly.

## Data Flow (After Fix)

```text
ProjectDetail (manages latestSimulation query)
    |
    +--> SimulationModes (edits config, auto-saves)
    |         |
    |         +--> project_simulations table
    |
    +--> FloorPlanMarkup (receives latestSimulation prop)
              |
              +--> PlantSetupModal
                     |
                     onSyncFromSimulation uses prop data
                     (no database fetch needed)
```

## Alternative Approach: Keep Database Fetch but Improve UX

If real-time database sync is preferred:

1. Add a "Save Simulation" button in the Simulation tab for explicit saves
2. Show loading state in Plant Setup modal while fetching
3. Display "No simulation saved yet" message when database returns empty
4. Add a toast notification when Sync completes with what was loaded

## Summary

| Issue | Root Cause | Fix |
|-------|------------|-----|
| Stale data in Plant Setup | Fetches from DB which may be empty/outdated | Pass live simulation state as prop |
| "0 saved simulations" | User may have deleted simulations OR auto-save not triggered | Ensure handleTabChange saves before navigating to PV Layout |
| No explicit save button | Design relies on auto-save which may not be visible | Consider adding manual save button for clarity |
