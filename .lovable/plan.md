

## Replace System Type Dropdown with Multi-Select Toggle Buttons

### What Changes

Replace the single "System Type" dropdown (Solar / Solar + Battery / Hybrid) with individual toggle buttons for each energy generation component: **Solar PV**, **Battery**, and **Generator**. Each can be independently toggled on/off, giving more flexible system configuration.

### UI Design

The current dropdown gets replaced with a row of toggle-style checkboxes/buttons:

```text
System Configuration
[x] Solar PV    [x] Battery    [ ] Generator
```

Each button shows an icon (Sun, Battery, Zap) and can be toggled independently. The combination is saved to the database as a comma-separated string in the existing `system_type` column (e.g. "Solar PV,Battery").

### Files Modified

**1. `src/pages/ProjectDetail.tsx`**
- Change `systemType` in `DashboardParams` from a single string union to an object: `{ solarPV: boolean; battery: boolean; generator: boolean }`
- Replace the `<Select>` dropdown (lines 421-444) with three toggle buttons using Shadcn's `Toggle` component or styled checkboxes with icons
- Update the save logic to serialise the selected components into the `system_type` DB column (e.g. "Solar PV,Battery")
- Update the load logic to parse the `system_type` string back into the boolean flags
- Update `systemIncludesBattery` and `systemIncludesSolar` derivations (line 806-809) to use the new flags

**2. `src/pages/ProjectDashboard.tsx`** (if still used)
- Same pattern: replace the System Type `<Select>` with toggle buttons for consistency

**3. `src/hooks/useProjectStore.ts`**
- Update the `SystemType` type and default values to reflect the new multi-select model

### Database

No schema changes needed -- the existing `system_type` column (text, nullable) can store the serialised value like `"Solar PV,Battery"` or `"Solar PV,Battery,Generator"`.

### How It Connects Downstream

The existing `systemIncludesBattery` and `systemIncludesSolar` boolean flags (used by load profile charts, financial analysis, energy flow) will be derived directly from the new toggle states, making downstream logic simpler and more accurate. A new `systemIncludesGenerator` flag will be added for future generator-related features.

### Technical Details

- Toggle UI uses the existing Shadcn `Toggle` component with `variant="outline"` for a clean pressed/unpressed look
- Icons: `Sun` for Solar PV, `Battery` for Battery, `Zap` for Generator (all from lucide-react)
- Serialisation format: comma-separated string stored in `system_type` (e.g. `"Solar PV,Battery"`)
- Parsing on load: `system_type?.split(",").map(s => s.trim())` to restore toggle states
- Auto-save triggers on each toggle change (same pattern as the current select `onValueChange`)
