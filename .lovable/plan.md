

# Fix: Allow All Numeric Inputs to Be Fully Cleared

## Problem
Every numeric input in the project uses the pattern `parseFloat(e.target.value) || 0` (or `parseInt(...) || 0`). When you select all text and press Delete/Backspace, the empty string is immediately parsed as `NaN`, which falls through to `0`, snapping the value back and preventing you from typing a new number cleanly.

## Solution
Create a reusable `NumericInput` component that stores the **display value as a string** internally, only committing the parsed number to the parent on **blur** or **Enter**. While typing, the field is free-text, so you can clear it, type partial values like `0.` or `-`, without the value snapping back.

## Implementation

### 1. Create `src/components/ui/numeric-input.tsx`
A thin wrapper around the existing `Input` component:
- Internal `string` state for display
- Syncs from parent `value` prop (number) when not focused
- On blur / Enter: parse the string, clamp to min/max if provided, call `onChange(parsedNumber)`
- If the field is empty on blur, fall back to a configurable `fallback` prop (default `0`)
- Forwards all standard Input props (className, step, min, max, disabled, etc.)

### 2. Replace all `parseFloat(...) || 0` and `parseInt(...) || 0` patterns
Swap every inline number input across these files to use `NumericInput`:

| File | Approx. replacements |
|------|---------------------|
| `AdvancedSimulationConfig.tsx` | ~20 inputs |
| `FutureEnhancementsConfig.tsx` | ~15 inputs |
| `SystemCostsManager.tsx` | ~15 inputs |
| `SimulationPanel.tsx` | ~5 inputs |
| `SolarForecastCard.tsx` | 2 inputs |
| `InverterSizeModuleConfig.tsx` | custom module fields |
| `InverterSliderPanel.tsx` | 1 input |
| `TenantManager.tsx` | area/kWh fields |

### 3. Component API

```typescript
interface NumericInputProps extends Omit<React.ComponentProps<"input">, "onChange" | "value" | "type"> {
  value: number;
  onChange: (value: number) => void;
  /** Value to use when field is empty on blur. Default: 0 */
  fallback?: number;
  /** Use integer parsing instead of float. Default: false */
  integer?: boolean;
}
```

Usage before:
```tsx
<Input type="number" value={config.discountRate}
  onChange={(e) => onChange({ ...config, discountRate: parseFloat(e.target.value) || 0 })} />
```

Usage after:
```tsx
<NumericInput value={config.discountRate}
  onChange={(v) => onChange({ ...config, discountRate: v })} />
```

## Technical Notes
- The component uses `type="number"` on the underlying input so browser stepper arrows and mobile numeric keyboards still work.
- Min/max clamping happens on commit (blur/Enter), not while typing, so the user is never interrupted mid-edit.
- The `fallback` prop lets each field decide what "empty" means (e.g. `0`, `0.5`, `25`) -- matching the current `|| 0`, `|| 0.5`, `|| 25` defaults.

