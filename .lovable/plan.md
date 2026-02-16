

## Fix Toggle Visibility + Implement Section-Aware LaTeX Editing

### Problem 1: Toggle Switches Not Visible
The screenshot shows the Switch components are completely missing from view. The issue is that the `w-11` (44px) switch is being squeezed out despite `shrink-0`. The sidebar is `w-80` (320px), and with `p-3` padding on both the scroll area and the block container, plus the grip icon, there isn't enough room. The `flex-1 min-w-0` on the label container should constrain it, but the text content may be forcing the container wider than expected because the `Label` and `p` elements need explicit `block` display to respect `truncate`/`min-w-0` properly in a flex context.

**Fix in `ContentBlockToggle.tsx`:**
- Wrap the entire flex row with explicit `max-w-full` and ensure the middle column has `w-0 flex-1` instead of `flex-1 min-w-0` to force it to shrink.
- Ensure Label uses `block` display so `truncate` works.

### Problem 2: Section-Aware LaTeX Editing

Currently, every change to `templateData` (including toggling a content block) regenerates the **entire** LaTeX source, wiping any manual edits. We need to preserve per-section manual edits.

**Architecture:**

1. **Delimiters** -- Each section in the generated LaTeX output will be wrapped with comment markers:
   ```
   %%-- BEGIN:cover --%%
   ... LaTeX content ...
   %%-- END:cover --%%
   ```

2. **Section Override Store** -- A `Map<ContentBlockId, string>` state in `LaTeXWorkspace` tracks user-edited section content. When the user manually edits LaTeX in the editor, we parse the source by delimiters and diff against the auto-generated version. Any section that differs is stored as an override.

3. **Smart Regeneration** -- When `templateData` changes (e.g., toggle, branding change):
   - Generate fresh LaTeX for each section
   - For sections with user overrides, use the override instead of the generated content
   - Sections toggled OFF are excluded entirely (overrides preserved in the map for if toggled back ON)
   - A "Reset Section" button per block (or a global "Reset All") clears overrides

4. **Persistence** -- Section overrides are saved to the `proposals` table in a new `section_overrides` JSONB column so they survive page reloads.

### Files to Change

| File | Change |
|------|--------|
| `src/components/proposals/ContentBlockToggle.tsx` | Fix layout so Switch is always visible |
| `src/lib/latex/templates/proposalTemplate.ts` | Wrap each section output with `%%-- BEGIN:id --%%` / `%%-- END:id --%%` delimiters |
| `src/components/proposals/latex/LaTeXWorkspace.tsx` | Add section override logic: parse editor source by delimiters, detect manual edits, merge overrides with generated content on templateData change |
| `src/components/proposals/types.ts` | Export delimiter constants and a helper type for section overrides |

### Technical Details

**Delimiter format in `proposalTemplate.ts`:**
```typescript
const sections = enabled.map(block => {
  const content = /* switch statement */;
  return `%%-- BEGIN:${block.id} --%%\n${content}\n%%-- END:${block.id} --%%`;
}).join("\n\\newpage\n");
```

**Parsing in `LaTeXWorkspace.tsx`:**
```typescript
function parseSections(source: string): Map<string, string> {
  const regex = /%%-- BEGIN:(\w+) --%%\n([\s\S]*?)\n%%-- END:\1 --%%/g;
  const map = new Map();
  let match;
  while ((match = regex.exec(source)) !== null) {
    map.set(match[1], match[2]);
  }
  return map;
}
```

**Override detection:** When the user edits the source (via `onChange`), we parse both the current editor source and the last auto-generated source. Any section whose content differs from the auto-generated version is stored as an override.

**Merge on regeneration:** When `templateData` changes, instead of replacing the entire source:
1. Generate fresh per-section content
2. For each enabled section, use `overrides.get(id) ?? freshContent`
3. Wrap in preamble + `\begin{document}` / `\end{document}`

**No database migration needed initially** -- overrides can be stored in the existing `simulation_snapshot` JSON or we add a column later when saving is needed.

### Sequence

1. Fix `ContentBlockToggle` layout (immediate visual fix)
2. Add delimiters to `proposalTemplate.ts`
3. Implement parse/merge logic in `LaTeXWorkspace.tsx`
4. Wire up override detection on editor changes

