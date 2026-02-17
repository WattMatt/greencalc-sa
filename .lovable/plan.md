

## Collapsible Sections in the LaTeX Editor

### Overview
Add fold/collapse toggles to the line number gutter so you can collapse the content between `%%-- BEGIN:sectionId --%%` and `%%-- END:sectionId --%%` markers. Clicking the arrow on a BEGIN line hides all lines until the matching END line.

### Challenge
A plain `<textarea>` cannot selectively hide lines. To support collapsing, the editor must switch to a line-by-line rendering approach.

### Implementation

**Replace the textarea with a contentEditable code block** in `LaTeXEditor.tsx`:

1. **Parse section ranges** -- Scan the source lines to find pairs of BEGIN/END markers and their line ranges.

2. **Track collapsed state** -- Add a `Set<string>` state for collapsed section IDs (keyed by the block name, e.g. "introduction").

3. **Line-by-line rendering** -- Replace the textarea with a single `contentEditable` `<pre>` or `<code>` element rendered line-by-line:
   - Each visible line is a `<div>` inside the editable container.
   - Lines belonging to a collapsed section (between BEGIN+1 and END-1) are hidden via `display: none` or simply not rendered.
   - The BEGIN line itself remains visible so the user can see what is collapsed.

4. **Gutter fold indicators** -- In the line number column:
   - BEGIN lines show a small chevron arrow (ChevronRight when collapsed, ChevronDown when expanded).
   - Clicking the chevron toggles the section's collapsed state.
   - Collapsed sections show a summary indicator (e.g. "..." or a line count badge) on the BEGIN line.

5. **Editing via hidden textarea sync** -- To maintain reliable text editing (cursor, selection, undo, paste, IME):
   - Keep a hidden `<textarea>` as the actual editable surface.
   - Overlay the styled line display on top.
   - Sync scroll positions between them.
   - This avoids contentEditable quirks while still allowing visual line folding in the display layer.

   Alternatively, a simpler approach: use the visible textarea but apply a **virtual fold** -- maintain a mapping between "display lines" and "source lines". The textarea shows only unfolded lines, and a separate `collapsedRanges` map tracks hidden content. When the user types, the editor reconstructs the full source by splicing collapsed content back in at the correct positions.

### Recommended Approach (Virtual Fold)

This is simpler and avoids contentEditable issues:

1. **Source of truth**: The full LaTeX source string (unchanged).
2. **Display source**: A filtered version with collapsed section contents replaced by a single placeholder line (e.g., `  ... (12 lines hidden)`).
3. **On edit**: Map display-line edits back to the full source using an index map.
4. **Gutter**: Render fold arrows on BEGIN marker lines; collapsed sections show a single summary row.

### Technical Details

**File: `src/components/proposals/latex/LaTeXEditor.tsx`**

- Add `collapsedSections` state (`Set<string>`).
- Add `parseFoldRegions(source)` helper that returns `{ sectionId, beginLine, endLine }[]`.
- Compute `visibleLines` and `lineMapping` (display index to source index) from the full source, skipping lines in collapsed regions.
- Build the display string from visible lines only, set that as the textarea value.
- On change, use `lineMapping` to reconstruct the full source with collapsed content spliced back in.
- In the gutter, render fold toggle buttons (ChevronRight/ChevronDown) on BEGIN lines.
- Style collapsed indicators with a muted "... N lines" badge.

### User Experience
- Click the arrow next to a BEGIN line to collapse that section.
- Click again to expand.
- Collapsed sections show the BEGIN marker line with a fold indicator and hidden line count.
- All editing, right-click menu, scroll preservation, and sync continue to work as before.
- Collapse state is ephemeral (not persisted) -- sections start expanded.

