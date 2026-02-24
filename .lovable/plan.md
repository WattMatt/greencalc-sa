

## Battery Dispatch Strategy -- Charge/Discharge Scheduling

### The Problem
The current `EnergySimulationEngine` uses a **passive strategy**: the battery only charges from excess solar and discharges when load exceeds solar. This means:

- A **battery-only project** (no solar) will **never charge** -- so it never discharges, producing zero financial return
- Even with solar, there's no **TOU arbitrage** -- the battery doesn't know to charge during cheap off-peak hours and discharge during expensive peak hours
- There's no **peak shaving** logic to reduce demand charges
- The user has no way to configure *when* the battery should operate

### The Solution
Add a **Battery Dispatch Strategy** selector to the Battery pane in the carousel, and extend the `EnergySimulationEngine` to support multiple dispatch modes.

---

### Battery Dispatch Strategies

| Strategy | Description | When Battery Charges | When Battery Discharges |
|----------|-------------|---------------------|------------------------|
| **Self-Consumption** (current default) | Absorb excess solar, discharge when load > solar | Excess solar hours | Deficit hours (load > solar) |
| **TOU Arbitrage** | Buy cheap grid power off-peak, sell/use during peak | Off-peak hours (22:00-06:00) from grid + solar | Peak hours (07:00-10:00, 18:00-20:00) |
| **Peak Shaving** | Reduce maximum grid demand to lower demand charges | Off-peak hours (from grid) + solar excess | When load exceeds a configurable threshold |
| **Scheduled** | User-defined charge/discharge windows | User-specified hours | User-specified hours |

---

### UI Changes (Battery Pane in ConfigCarousel)

Add a **Strategy** selector below the existing AC Capacity / C-Rate / DoD fields:

```text
┌─────────────────────────────────────────────┐
│  AC Capacity (kWh)  [42]  |  C-Rate  [0.5] │
│  DoD (%)  [85]  |  Power (kW) [21]  | DC [49] │
├─────────────────────────────────────────────┤
│  Dispatch Strategy: [Self-Consumption ▼]    │
│                                             │
│  (Strategy-specific options appear here)    │
│  TOU Arbitrage:                             │
│    Charge window:  [22:00] - [06:00]        │
│    Discharge window: [07:00] - [10:00]      │
│                      [18:00] - [20:00]      │
│    Grid charging: [✓] Allow                 │
│                                             │
│  Peak Shaving:                              │
│    Target peak (kW): [150]                  │
│    Grid charging: [✓] Allow                 │
├─────────────────────────────────────────────┤
│  Usable capacity: 42 kWh                   │
│  Daily cycles: 0.85                         │
│  Energy throughput: 36 kWh                  │
└─────────────────────────────────────────────┘
```

---

### Technical Changes

#### 1. `src/components/projects/simulation/EnergySimulationEngine.ts`

**Add new types:**
- `BatteryDispatchStrategy` -- `'self-consumption' | 'tou-arbitrage' | 'peak-shaving' | 'scheduled'`
- `DispatchConfig` -- strategy-specific parameters (charge/discharge windows, peak target, grid charging flag)

**Extend `EnergySimulationConfig`:**
- Add `dispatchStrategy?: BatteryDispatchStrategy`
- Add `dispatchConfig?: DispatchConfig`

**Update `runEnergySimulation` loop logic:**
- Current logic becomes the `self-consumption` path (default, backward-compatible)
- `tou-arbitrage`: During charge window hours, charge battery from grid (up to power limit); during discharge window hours, discharge battery to offset load regardless of solar
- `peak-shaving`: When load exceeds target peak, discharge battery to bring grid import down to the target; charge from grid during off-peak or from excess solar
- `scheduled`: Simple hour-based rules from user-defined windows

**Key change in the loop (hour 0-23):**

```text
For each hour:
  1. Calculate net load (load - solar) as before
  2. Check dispatch strategy:
     - self-consumption: existing logic (no change)
     - tou-arbitrage:
         if hour in charge_window AND battery not full:
           charge from grid (gridImport increases)
         if hour in discharge_window AND battery not empty:
           discharge to offset load (gridImport decreases)
         else: fall back to self-consumption logic
     - peak-shaving:
         if gridImport would exceed target_peak:
           discharge battery to cap gridImport at target
         if hour in off-peak AND battery not full:
           charge from grid
     - scheduled: similar to TOU but with user-defined windows
```

#### 2. `src/components/projects/SimulationPanel.tsx`

**New state variables:**
- `batteryStrategy: BatteryDispatchStrategy` (default: `'self-consumption'`)
- `chargeWindowStart / chargeWindowEnd` (default: 22, 6)
- `dischargeWindowStart / dischargeWindowEnd` (default: 7, 20 -- covering both peak windows)
- `allowGridCharging: boolean` (default: false for self-consumption, true for TOU)
- `peakShavingTarget: number` (default: derived from load profile peak)

**Pass to `energyConfig`:**
- Include `dispatchStrategy` and `dispatchConfig` in the config memo

**UI in Battery pane:**
- Add a `Select` dropdown for strategy after the existing input grid
- Conditionally render strategy-specific options based on selection
- Use the existing grid layout pattern (matching Solar Modules style)

#### 3. `src/components/projects/load-profile/types.ts`

**Leverage existing TOU definitions:**
- The `getTOUPeriod()` function already defines SA peak/standard/off-peak hours
- The TOU Arbitrage strategy will use these same hour definitions as defaults

---

### Financial Impact
Once the battery has a proper dispatch strategy:
- The `calculateFinancials` function already accounts for `totalGridImport` and `peakGridImport` from energy results
- TOU arbitrage will reduce `totalGridImport` during expensive peak hours (lowering energy costs)
- Peak shaving will reduce `peakGridImport` (lowering demand charges)
- No changes needed to `FinancialAnalysis.ts` -- the financial layer already works correctly with whatever energy results it receives

### Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/projects/simulation/EnergySimulationEngine.ts` | Add dispatch strategy types and multi-strategy loop logic |
| `src/components/projects/SimulationPanel.tsx` | Add strategy selector UI and state, pass config to engine |

No new files needed. No new dependencies.
