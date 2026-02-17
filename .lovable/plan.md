

# Proposal Workspace Layout and UX Improvements

## Problem Summary
Three issues with the current Proposal Workspace:
1. **Scrollbar overflow** -- The sidebar, editor, and PDF preview each introduce their own scrollbars, making the page feel disjointed instead of fitting cleanly into one screen.
2. **Auto-compilation on toggle** -- Toggling a section in the sidebar immediately regenerates the LaTeX source and triggers the 800ms debounced compile, sending unnecessary API calls.
3. **PDF viewer is limited** -- No zoom, no pan, and the page number can only be changed with arrows (not typed directly).

---

## Plan

### 1. Fix layout overflow (remove extra scrollbars)

**Files:** `ProposalSidebar.tsx`, `ProposalWorkspace.tsx`

- The sidebar currently uses `w-80` with `flex-col h-full` and a `ScrollArea` for the content list. The issue is the sidebar's content blocks list grows taller than the viewport.
- Constrain the sidebar to `h-screen` and ensure the `ScrollArea` only wraps the content block list (not the export buttons). The export buttons are already pinned at the bottom -- this is correct.
- Ensure the parent layout in `ProposalWorkspace.tsx` uses `h-screen overflow-hidden` so nothing escapes the viewport.
- The `LaTeXWorkspace` resizable panels already use `h-full` which should cascade correctly once the parent is `overflow-hidden`.

### 2. Replace "Reset" with "Sync" -- decouple toggle from compilation

**Files:** `LaTeXWorkspace.tsx`, `LaTeXEditor.tsx`

Current behavior:
- `templateData` changes (e.g. toggling a block) triggers a `useEffect` that regenerates the source, which triggers the debounced compile.

New behavior:
- Toggling blocks in the sidebar will still update `templateData` and regenerate the source in the editor (so the user sees the updated `.tex` code), but it will **not** automatically compile.
- Remove the `useEffect` that auto-compiles on every `source` change.
- Add a `needsSync` state that tracks whether source has changed since last compilation.
- Replace the "Reset" button with a **"Sync"** button (with a refresh/sync icon). Clicking it sends the current source to the API for compilation.
- Manual edits in the editor will also set `needsSync = true` but won't auto-compile.
- The Sync button will show a visual indicator (e.g. highlighted/pulsing) when `needsSync` is true.

### 3. Enhanced PDF Viewer with zoom, pan, and page input

**File:** `PDFPreview.tsx`

- **Zoom controls**: Add zoom in (+), zoom out (-), and fit-to-width buttons in the toolbar. Track a `scale` state (default: fit-to-width). Re-render the canvas at the chosen scale.
- **Pan support**: The container already has `overflow-auto`. When zoomed in, the scrollbars on the container div provide panning. This works naturally.
- **Editable page number**: Replace the static `{pageNum} / {numPages}` text with an editable `<input>` field. The user can type a page number and press Enter (or blur) to jump to that page. Keep the arrow buttons for convenience.

---

## Technical Details

### LaTeXWorkspace.tsx changes
- Remove the `useEffect` at line 141-152 that debounce-compiles on `source` change.
- Add `needsSync` state, set to `true` whenever `source` changes (both programmatic and manual).
- Add a `handleSync` callback that calls `compile(source)` and sets `needsSync = false`.
- Pass `onSync` and `needsSync` props to `LaTeXEditor` instead of `onReset`.
- Keep the `handleReset` logic available but internalize it or remove it (replaced by Sync).

### LaTeXEditor.tsx changes
- Replace the Reset button with a Sync button (using `RefreshCw` icon from lucide).
- Accept `onSync` and `needsSync` props.
- Visually highlight the Sync button when `needsSync` is true (e.g. primary color variant).

### PDFPreview.tsx changes
- Add `scale` state (default: `0` meaning "fit to width").
- Add `zoomIn`, `zoomOut`, `fitToWidth` handlers that adjust scale.
- Update `renderPage` to use the user-specified scale (or compute fit-to-width when scale is 0).
- Replace the page number span with an `<input type="number">` that allows direct page entry.
- Add zoom controls (+, -, fit) to the toolbar alongside the pagination controls.
- Show zoom percentage in the toolbar.

### ProposalSidebar.tsx changes
- Ensure the root div uses `overflow-hidden` and the `ScrollArea` is properly bounded so the sidebar never exceeds the viewport height.

