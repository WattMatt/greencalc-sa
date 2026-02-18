

## Problem: Backspace Fails at Last Lines of LaTeX Editor

### Root Cause

The editor uses a `ContextMenuTrigger asChild` (Radix) wrapping the entire editing area (gutter + textarea + overlays). Radix's context menu trigger attaches keyboard event listeners to the wrapper `div` that can intercept and swallow key events (like Backspace, Delete) when focus is on a child element, particularly at boundary positions in the textarea. This prevents native textarea editing behaviour at the end of the content.

Additionally, the `reconstructSource` function has a logic gap: when sections are collapsed and the user deletes lines from the end (via Backspace), the function copies the original source lines into `result` but never removes trailing lines that no longer exist in the edited display. This means backspace-deletions at the bottom are silently discarded.

### Fix (2 changes in LaTeXEditor.tsx)

**1. Stop ContextMenu from intercepting keyboard events**

Add an `onKeyDown` handler on the wrapper div (the `ContextMenuTrigger` child) that stops propagation for all key events originating from the textarea. This prevents Radix from capturing Backspace/Delete:

```tsx
<div className="flex-1 flex overflow-hidden"
  onKeyDownCapture={(e) => {
    // Prevent Radix ContextMenu from swallowing keyboard events in the textarea
    if (e.target === textareaRef.current) {
      e.stopPropagation();
    }
  }}
>
```

**2. Fix `reconstructSource` to handle line deletions**

Update the function to trim trailing source lines when the user deletes lines from the display:

```typescript
function reconstructSource(...): string {
  // ... existing mapping logic ...

  // After mapping: calculate expected total length
  // If display has fewer lines than mapped, trim the result
  const mappedSourceIndices = lineMap.filter(x => x >= 0);
  const lastMappedSource = mappedSourceIndices[mappedSourceIndices.length - 1] ?? 0;
  const expectedLength = lastMappedSource + 1 + 
    (displayIdx < newDisplayLines.length ? newDisplayLines.length - displayIdx : 0);
  
  // Trim extra trailing lines that were deleted by the user
  if (result.length > expectedLength) {
    result.length = expectedLength;
  }

  return result.join("\n");
}
```

### Technical Details

- **Files changed**: `src/components/proposals/latex/LaTeXEditor.tsx` only
- **No new dependencies**
- The `onKeyDownCapture` approach uses the capture phase to intercept events before Radix processes them, but only for events originating from the textarea itself (so the context menu keyboard navigation still works)
- The `reconstructSource` fix ensures that when `newDisplayLines` has fewer entries than expected (from backspace at end), the surplus original lines are trimmed from the result

