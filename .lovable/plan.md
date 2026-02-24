

## Fix: Make Battery Dispatch Strategy Visible

### What's Happening
The Dispatch Strategy dropdown **is already in the code** (lines 1572-1691 of `SimulationPanel.tsx`). It sits below the DC Capacity row, separated by a border. The issue is that it's not visible without scrolling -- the Battery card is tall and the strategy section is below the fold.

### The Fix
Move the Dispatch Strategy section **higher up** in the Battery pane so it's immediately visible, and tighten the layout so everything fits in one view.

### Changes to `src/components/projects/SimulationPanel.tsx`

**Restructure the Battery pane content order:**

```text
Current layout:                     New layout:
┌───────────────────────┐           ┌───────────────────────┐
│ AC Capacity | C-Rate  │           │ AC Capacity | C-Rate  │
│ DoD | Power | DC Cap  │           │ DoD | Power | DC Cap  │
│ ───────────────────── │           │ ───────────────────── │
│ Dispatch Strategy [v] │  <-- move │ Dispatch Strategy [v] │
│ (strategy options)    │  UP and   │ (strategy options)    │
│ ───────────────────── │  combine  │ ───────────────────── │
│ Usable / Cycles / etc │           │ Usable / Cycles / etc │
└───────────────────────┘           └───────────────────────┘
```

The layout order is actually already correct -- the strategy dropdown comes right after the input grid. The real issue is likely that the **parent container** of the carousel or the page itself has limited visible height and the user isn't scrolling.

**Proposed solution -- make the strategy dropdown more prominent:**

1. Move the Dispatch Strategy **into the same grid** as Row 2 (DoD / Power / DC), making it a third row rather than a separate bordered section -- this reduces vertical space and ensures it's visible
2. Alternatively, add it as a **full-width select** directly after Row 1 (AC Capacity / C-Rate), before DoD/Power/DC, so it's one of the first things visible

**Recommended approach** -- Add strategy as a full-width row between Row 1 and Row 2:

```text
┌─────────────────────────────────────┐
│  AC Capacity (kWh) [1063] | C-Rate [0.94] │
│  Dispatch Strategy: [Self-Consumption v]   │  <-- NEW position
│  DoD [85] | Power [999] | DC Cap [1251]    │
│  (strategy-specific options if needed)     │
│  ─────────────────────────────────────     │
│  Usable: 1063 kWh | Cycles: 0.40          │
└─────────────────────────────────────┘
```

### Technical Details

**File:** `src/components/projects/SimulationPanel.tsx`

- Cut the Dispatch Strategy `<div>` block (lines 1572-1691) from its current position after the input grid
- Paste it between Row 1 (AC Capacity / C-Rate grid, line 1536) and Row 2 (DoD / Power / DC grid, line 1538)
- Remove the `pt-2 border-t` classes from the strategy section since it will flow naturally between the input rows
- Keep all the conditional strategy-specific options (TOU windows, peak shaving target, grid charging switch) in place

No other files need to change. The engine logic and types are already correct.
