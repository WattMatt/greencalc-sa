
## Fix: Collapsed Section Chevrons Disappearing on Enter

### Root Cause

The `reconstructSource` function uses a naive 1:1 mapping between display lines and source lines via `lineMap`. When you press **Enter** (inserting a new line), all subsequent display lines shift down by one position, but the `lineMap` does not shift. This means:

1. Display line 5 (which was mapped to source line 10, a `%%-- BEGIN:xxx --%%` marker) now contains the second half of whatever line you split
2. That content overwrites the fold marker in the source
3. All downstream fold markers get similarly corrupted
4. With the markers destroyed, `parseFoldRegions` finds no regions, so the chevrons vanish

### Fix: Diff-Based Reconstruction

Replace the current "blind 1:1" loop with a **diff-based** approach that:

1. Compares the **old** display lines (pre-edit) with the **new** display lines (post-edit)
2. Finds the common prefix (unchanged lines from the top) and common suffix (unchanged lines from the bottom)
3. Only modifies the source lines corresponding to the **changed region**, leaving all other source lines (including hidden/collapsed content and fold markers) completely untouched

### Technical Details

**File: `src/components/proposals/latex/LaTeXEditor.tsx`**

**1. Update `reconstructSource` signature** to accept `oldDisplayLines: string[]`:

```typescript
function reconstructSource(
  newDisplayText: string,
  originalSource: string,
  lineMap: number[],
  collapsedSections: Set<string>,
  oldDisplayLines: string[],  // <-- new parameter
): string
```

**2. Replace the mapping logic** with diff-based reconstruction:

```text
Algorithm:
a) Find prefixLen: number of identical lines from the start
   between oldDisplayLines and newDisplayLines

b) Find suffixLen: number of identical lines from the end
   (not overlapping with prefix), skipping placeholder lines (-1)

c) Determine the source range to replace:
   - sourceStart = lineMap[prefixLen] (first real mapped index)
   - sourceEnd = lineMap[oldLen - suffixLen - 1] (last real mapped index)

d) Collect new content: the changed display lines from
   newDisplayLines[prefixLen .. newLen - suffixLen),
   skipping any placeholder lines (the "... (N lines hidden)" entries)

e) Splice: result.splice(sourceStart, sourceEnd - sourceStart + 1, ...newContent)
```

This guarantees that lines outside the edit region -- including all `%%-- BEGIN/END --%%` markers and all hidden/collapsed content -- are never touched.

**3. Update all call sites** (`handleChange`, `handleKeyDown`, `insertAtCursor`) to pass `displayLines` as the final argument:

```typescript
// In handleChange:
const newSource = reconstructSource(newDisplayText, value, lineMap, collapsedSections, displayLines);

// In handleKeyDown (Tab):
onChange(reconstructSource(newDisplay, value, lineMap, collapsedSections, displayLines));

// In insertAtCursor:
onChange(reconstructSource(newDisplay, value, lineMap, collapsedSections, displayLines));
```

### Edge Cases Handled

- **Enter at end of document**: suffix is empty, new line appended after last mapped source line
- **Backspace joining two lines**: changed region shrinks by one line, splice removes the join point
- **Edit within a line (no line count change)**: prefix and suffix cover everything except the changed line, single-line splice
- **Placeholder lines in changed region**: skipped during content collection so hidden-line markers are never written back into the source
