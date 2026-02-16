

## Persist LaTeX Section Overrides to Database

### Current State

The section-aware editing system is fully functional **in-session**:
- Manual edits are detected per-section via `%%-- BEGIN/END --%%` delimiters
- Overrides are preserved when toggling sections or changing data
- The "Reset" button clears all overrides

**Gap**: Overrides are stored in a `useRef` (memory only). Reloading the page loses all manual LaTeX edits.

### What Will Change

Save the per-section override map to the `proposals` table so manual LaTeX edits survive page reloads.

### Technical Details

**1. Database migration** -- Add a `section_overrides` JSONB column to `proposals`:
```sql
ALTER TABLE public.proposals ADD COLUMN section_overrides jsonb DEFAULT NULL;
```

**2. Save overrides on proposal save (`ProposalWorkspace.tsx`)**:
- Convert `overridesRef.current` (a `Map`) to a plain object and include it in both the update and insert mutations alongside `content_blocks`.

**3. Load overrides on proposal load (`ProposalWorkspace.tsx`)**:
- Pass saved overrides down to `LaTeXWorkspace` as a new prop (e.g., `initialOverrides`).

**4. Restore overrides in `LaTeXWorkspace.tsx`**:
- On mount, if `initialOverrides` is provided, populate `overridesRef.current` from it before the first `assembleSource` call.

**5. Pass overrides up for saving**:
- Add an `onOverridesChange` callback prop to `LaTeXWorkspace` so the parent can capture the current overrides map whenever it changes, making it available for the save mutation.

### Files to Change

| File | Change |
|------|--------|
| Database migration | Add `section_overrides jsonb DEFAULT NULL` column |
| `src/pages/ProposalWorkspace.tsx` | Save/load `section_overrides`; pass `initialOverrides` and `onOverridesChange` to `LaTeXWorkspace` |
| `src/components/proposals/latex/LaTeXWorkspace.tsx` | Accept `initialOverrides` prop; populate overridesRef on mount; call `onOverridesChange` when overrides change |

