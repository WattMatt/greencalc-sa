

# Redesign Inverter Sizing Logic

## Core Concept Change

The **System Size (AC)** becomes the primary design input. The number of inverters is a **derived value**, not a user-controlled slider.

**New logic:**
- User sets desired AC system size (e.g. 100 kW) via Quick Select or Custom input
- User selects inverter size (e.g. 125 kW)
- Number of inverters = `Math.ceil(systemSize / inverterSize)` (auto-calculated, read-only)
- DC capacity = systemSize x DC/AC ratio

**Example:** 100 kW system with 125 kW inverters = `ceil(100/125)` = 1 inverter

## Changes to `InverterSliderPanel.tsx`

### 1. Swap positions
Move **Quick Select + Custom AC input** to the top, followed by the **Inverter Size dropdown** below it.

### 2. Make Number of Inverters read-only
- Remove the slider control
- Replace with a calculated display showing the formula result
- Auto-compute: `Math.ceil(acCapacity / inverterSize)`

### 3. Update handlers
- Quick Select and Custom input now set `acCapacity` directly (stored as a new concept, no longer derived from `inverterSize x inverterCount`)
- When inverter size changes, recalculate inverter count from the current system size
- When system size changes, recalculate inverter count from the current inverter size
- The `inverterCount` in config is always kept in sync as a derived value

### 4. Update `acCapacity` derivation
Currently: `acCapacity = inverterSize * inverterCount`
New: `acCapacity` is the user's desired system size; `inverterCount = Math.ceil(acCapacity / inverterSize)`

Since `InverterConfig` stores `inverterCount`, we will continue using `inverterSize * inverterCount` as the effective AC capacity but set `inverterCount` based on `Math.ceil(desiredAC / inverterSize)`. The custom input will allow any kW value and derive the count accordingly.

## Layout Order (top to bottom)

1. **Quick Select System Size (AC)** buttons + Custom kW input (inline)
2. **Inverter Size (AC)** dropdown + custom kW input
3. **Number of Inverters** -- read-only calculated display
4. **DC/AC Ratio** slider + input
5. **Calculated Metrics** box
6. **Validation Status**

## Files Modified
- `src/components/projects/InverterSliderPanel.tsx` -- All layout and logic changes

