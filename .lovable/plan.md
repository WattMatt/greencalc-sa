
# Fix: DimensionInput Unit Conversion Overwrites User Input

## Problem Identified

When using the "Set Distance Between Objects" modal:
1. User opens modal (current distance: 1.89m displayed)
2. User changes unit dropdown from "m" to "mm"
3. The `useEffect` in `DimensionInput` triggers and converts the parent value (1.89m) to the new unit (1890mm)
4. This **overwrites** any value the user intended to type
5. User types "50" but may be confused by the large number already in the field
6. If user clears and types "50", it correctly converts to 0.05m

### The Real Issue from Screenshot
Looking at the screenshot, the New Distance shows "1,8851" m - this suggests the value was NOT updated when the user clicked Apply. The comma (`,`) in "1,8851" indicates a locale issue where the decimal separator is a comma instead of a period, which can cause `parseFloat()` to fail silently.

**Root Cause**: When using a locale with comma as decimal separator (e.g., European locales), the `<input type="number">` displays values with commas, but `parseFloat()` only recognizes periods as decimal separators. This causes the conversion to fail, and `onChange()` is never called with the correct value.

```text
DimensionInput.tsx (line 47):
─────────────────────────────
const numericValue = parseFloat(inputValue);  // "1,8851" → NaN!
if (!isNaN(numericValue)) {  // Fails - onChange never called
  const meters = displayToMeters(numericValue, unit);
  onChange(meters);  // ← Never executed!
}
```

---

## Solution

Fix the `DimensionInput` component to handle locale-specific number formats by normalizing the input before parsing:

### File: `src/components/floor-plan/components/DimensionInput.tsx`

**Change**: Normalize comma to period before parsing in `handleValueChange`:

```typescript
const handleValueChange = (inputValue: string) => {
  setDisplayValue(inputValue);
  // Normalize locale decimal separators (comma → period)
  const normalizedValue = inputValue.replace(',', '.');
  const numericValue = parseFloat(normalizedValue);
  if (!isNaN(numericValue)) {
    const meters = displayToMeters(numericValue, unit);
    onChange(meters);
  }
};
```

---

## Expected Behavior After Fix

| User Action | Before Fix | After Fix |
|-------------|-----------|-----------|
| Enter "50" with mm selected | Correctly sets 0.05m | Correctly sets 0.05m |
| Enter "1,5" with m selected (EU locale) | Silent failure, no change | Correctly sets 1.5m |
| Enter "0,05" with m selected | Silent failure | Correctly sets 0.05m |
| Switch units after typing | Value preserved | Value preserved |

---

## Testing Scenarios

1. **Standard Input**: Open Set Distance modal, change to mm, type "50", click Apply - object should move to 50mm distance
2. **Decimal with Comma**: With locale using commas, enter "0,5" in meters, Apply - should set 0.5m distance
3. **Unit Switch Flow**: Enter "500" in mm (0.5m), switch to m, display shows "0.5", switch to cm, display shows "50"
4. **Edge Align Tool**: Verify edge alignment still works correctly after this fix
