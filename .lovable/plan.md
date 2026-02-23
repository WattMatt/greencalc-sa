
## Rotating Configuration Carousel for Simulation Panel

### What Changes
Replace the current 3-column grid layout (Solar PV | Inverter Sizing | Financial Analysis) and the separate Battery row with a **single rotating carousel** in the centre of the simulation panel. The carousel cycles between four configuration panes:

1. **Solar Modules** (Solar PV System card content)
2. **Inverters** (Inverter-Based Sizing card content)
3. **Battery Storage** (Battery card content)
4. **Financial Analysis** (Financial returns card content)

If a feature is not enabled (e.g. Solar PV is off, Battery is off), that carousel item appears **greyed out and disabled**. Clicking a disabled item triggers a confirmation dialog asking the user if they want to enable the feature.

### User Experience

```text
   [< Prev]   [ Solar Modules | Inverters | Battery | Financial ]   [Next >]
              ┌────────────────────────────────────────────────────┐
              │                                                    │
              │          Active pane content goes here             │
              │                                                    │
              └────────────────────────────────────────────────────┘
```

- Navigation via left/right chevron buttons and clickable tab indicators
- Active tab shown with a primary colour indicator; disabled tabs shown greyed out
- Clicking a disabled tab opens an `AlertDialog` asking: "Enable [Feature]?" with Enable/Cancel buttons
- The Enable action calls back to `ProjectDetail` to toggle the system config

### Technical Details

**New file: `src/components/projects/simulation/ConfigCarousel.tsx`**
- A self-contained component that wraps the four configuration panes
- Props:
  - `activeIndex` / `onActiveIndexChange` for controlled navigation
  - `solarEnabled`, `batteryEnabled`, `financialEnabled` (boolean flags)
  - `onRequestEnable: (feature: 'solarPV' | 'battery') => void` callback for the enable dialog
  - `children` or render props for each pane's content
- Uses Shadcn `AlertDialog` for the enable confirmation popup
- Chevron left/right buttons cycle through the 4 panes (skipping or landing on disabled ones with the grey overlay)
- Tab indicators at the top showing all four options with active/disabled styling

**Modified file: `src/components/projects/SimulationPanel.tsx`**
- Add `includesSolar` prop (passed from `ProjectDetail`)
- Add `onRequestEnableFeature` callback prop
- Replace the `grid-cols-3` div (lines ~1311-1713) and the battery row (lines ~1715-1800) with a single `<ConfigCarousel>` component
- Move each card's content into the carousel as named slots/children
- Conditionally render pane content vs disabled overlay based on `includesSolar` / `includesBattery` / `hasFinancialData`

**Modified file: `src/pages/ProjectDetail.tsx`**
- Pass `includesSolar={projectSystemConfig.solarPV}` to `SimulationPanel`
- Pass `onRequestEnableFeature` callback that toggles the system config and saves

### Carousel Pane Details

| Pane | Enabled When | Content |
|------|-------------|---------|
| Solar Modules | `includesSolar` | Current Solar PV System card (capacity slider, inverter size selector, module config, production reduction) |
| Inverters | `includesSolar` | Current Inverter-Based Sizing card (slider panel, quick select) |
| Battery Storage | `includesBattery` | Current Battery Storage card (capacity/power sliders, daily cycles, throughput) |
| Financial Analysis | `hasFinancialData` (tariff assigned) | Current Financial Return Outputs card; disabled state shows "Select a tariff to enable" |

### Disabled State Behaviour
- Greyed-out card with reduced opacity (`opacity-40`) and a lock/disabled overlay
- Tab indicator uses `text-muted-foreground` with a subtle strikethrough or badge
- On click: `AlertDialog` with title "Enable [Feature Name]?", description explaining the feature, and "Enable" / "Cancel" buttons
- Financial Analysis disabled state does NOT offer an enable button (it requires tariff selection, not a toggle)

### Styling
- Carousel container uses `max-w-2xl mx-auto` for centred placement
- Smooth CSS transition between panes (slide left/right)
- Active tab indicator with primary colour underline
- Touch-friendly navigation buttons (min 44px)
