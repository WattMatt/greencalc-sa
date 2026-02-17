

## Embed Proposal Editing Within the Project Page

### Problem
Clicking "Edit" on a proposal navigates away from the project page (with all the section tabs like Overview, Tenants, Load Profile, etc.) to a completely separate full-screen route (`/projects/:projectId/proposal`). This removes all navigation context.

### Solution
Instead of navigating away, open the Proposal Workspace inline within the Proposals tab on the project detail page. The "Edit" button will switch the Proposals tab into an editing mode that shows the full Proposal Builder (sidebar + LaTeX workspace) while keeping the project tabs visible above.

### Technical Details

**File: `src/components/projects/ProposalManager.tsx`**
- Add an `editingProposalId` state (string | null)
- When `editingProposalId` is set, render a `ProposalWorkspaceInline` component instead of the proposal list
- Pass a `onBack` callback to return to the list view
- The "Edit" button sets `editingProposalId` instead of navigating
- The "Create Proposal" button sets `editingProposalId` to `"new"` instead of navigating

**File: `src/components/proposals/ProposalWorkspaceInline.tsx`** (new file)
- Extract the core logic from `src/pages/ProposalWorkspace.tsx` into a reusable component
- Accept `projectId`, `proposalId` (string | null), and `onBack` as props
- Remove the full-screen `h-screen` layout; use a flexible height that fits within the tab content area (e.g., `h-[calc(100vh-12rem)]`)
- Replace the back arrow navigation with the `onBack` callback
- Keep all existing functionality: sidebar, LaTeX workspace, save, export, share

**File: `src/pages/ProposalWorkspace.tsx`**
- Keep this file as-is for backwards compatibility (direct URL access still works)
- Optionally refactor to wrap `ProposalWorkspaceInline` to avoid code duplication

### Visual Behavior
- Project tabs remain visible at the top at all times
- The Proposals tab content area shows either the proposal list OR the full editor
- A back arrow / "Back to list" button in the editor returns to the proposal list
- The editor fills the available height below the tabs

