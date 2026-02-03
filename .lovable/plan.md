
# Plan: Add Fallback Error State for Configuration Wizard

## Problem Summary
When clicking the gear/configure button on a meter, the UI shows a loading spinner but if the CSV extraction fails (e.g., no `raw_data` field, unsupported format, or empty content), the wizard never opens and the spinner continues indefinitely. The user is stuck with no feedback about what went wrong.

## Root Cause
The `loadMeterForWizard` function in both `SitesTab.tsx` and `MeterLibrary.tsx` correctly shows a toast error when extraction fails, but it doesn't clear the loading state or provide a recoverable error UI. The wizard only opens when `currentWizardCsvContent` is set, but when extraction fails, this remains `null` and the wizard dialog stays closed—leaving a confusing UX.

## Solution Overview
Add a new error state variable that captures extraction failures and allows the `CsvImportWizard` dialog to open with an error message displayed inside it. This provides:
1. Clear feedback about what went wrong
2. A button to close the dialog and return to normal state
3. Options to retry or upload new data

---

## Technical Implementation

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/loadprofiles/SitesTab.tsx` | Add error state, update `loadMeterForWizard`, add error UI in wizard dialog |
| `src/components/loadprofiles/MeterLibrary.tsx` | Apply same pattern for consistency |
| `src/components/loadprofiles/CsvImportWizard.tsx` | Add optional `errorMessage` prop to display error state inside dialog |

---

### Detailed Changes

#### 1. CsvImportWizard.tsx - Add Error State Support

Add new props for error handling:
```typescript
interface CsvImportWizardProps {
  // ... existing props
  errorMessage?: string | null;  // NEW: Show error instead of wizard content
  onRetry?: () => void;          // NEW: Optional retry callback
}
```

When `errorMessage` is provided and `csvContent` is null:
- Display a centered error state with:
  - Alert icon and error message
  - "Close" button to dismiss
  - Optional "Retry" button if `onRetry` is provided
  - Suggestion to re-upload the CSV file

#### 2. SitesTab.tsx - Track Error State

Add new state variable:
```typescript
const [wizardError, setWizardError] = useState<{
  meterId: string;
  meterName: string;
  message: string;
} | null>(null);
```

Update `loadMeterForWizard` function:
- On extraction failure: set `wizardError` instead of just showing toast
- Clear `processingQueue` to stop the spinner
- Set `currentWizardMeterId` to trigger dialog opening (even with error)

Update wizard dialog rendering:
- Pass `errorMessage={wizardError?.message}` to `CsvImportWizard`
- Handle error state cleanup in `handleWizardClose`

#### 3. MeterLibrary.tsx - Apply Same Pattern

Mirror the changes from `SitesTab.tsx` for consistency across both views.

---

## UI Design for Error State

When the wizard opens with an error, display inside the dialog:

```text
+----------------------------------------+
|  Configure Import                   X  |
+----------------------------------------+
|                                        |
|   [!] Unable to Load CSV Data          |
|                                        |
|   The stored data for "Woolworths"     |
|   could not be extracted.              |
|                                        |
|   Reason: No CSV content stored        |
|                                        |
|   To fix this:                         |
|   • Re-upload the original CSV file    |
|   • Use the Import button              |
|                                        |
|   [Close]            [Upload New CSV]  |
|                                        |
+----------------------------------------+
```

---

## Implementation Steps

1. **Update CsvImportWizard component**
   - Add `errorMessage` and `onRetry` optional props
   - Add conditional rendering: if `errorMessage` is set and `csvContent` is null, show error UI
   - Include close button that calls `onClose`

2. **Update SitesTab.tsx**
   - Add `wizardError` state variable
   - Modify `loadMeterForWizard`:
     - When no CSV content: set error state with message
     - Set `currentWizardMeterId` to the meter ID (to open dialog)
     - Do NOT set `currentWizardCsvContent` (leave as null)
   - Update wizard dialog: pass error message to component
   - Update `handleWizardClose`: clear error state

3. **Update MeterLibrary.tsx**
   - Apply identical pattern for consistency

---

## Expected Behavior After Fix

| Scenario | Before | After |
|----------|--------|-------|
| Gear click - CSV exists | Wizard opens | Wizard opens (unchanged) |
| Gear click - No raw_data | Spinner indefinitely | Dialog opens with error message |
| Gear click - Empty CSV content | Spinner indefinitely | Dialog opens with error message |
| Gear click - Unsupported format | Spinner indefinitely | Dialog opens with error message |

---

## Edge Cases Handled

1. **Queue processing**: When processing multiple meters in a queue, errors should move to next meter with proper status
2. **Dialog state cleanup**: Closing the error dialog must reset all wizard state variables
3. **Toast suppression**: When showing error in dialog, suppress duplicate toast notifications

