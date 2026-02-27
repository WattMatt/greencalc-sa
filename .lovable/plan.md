
# Remove Scenario Comparison Pane and Add Drag-to-Reorder on Saved Configurations

## Changes

### 1. Remove the Scenario Comparison (A/B/C) pane
The `AdvancedConfigComparison` component block in `SimulationPanel.tsx` (lines 1611-1642) will be removed entirely. The saved configurations area already has checkbox-based comparison built in, making this redundant.

The `AdvancedConfigComparison.tsx` file itself will be left in place (not deleted) to avoid breaking any other potential imports, but can be cleaned up later.

### 2. Add a `sort_order` column to `project_simulations`
A database migration will add an integer `sort_order` column (default 0) so that reordering persists between sessions.

### 3. Add drag-to-reorder handles on Saved Configurations
In `SavedSimulations.tsx`, each saved configuration row will get a grip/drag handle icon (`GripVertical` from Lucide) on the left side. Drag-and-drop reordering will be implemented using native HTML drag-and-drop (no new dependencies) with the following behaviour:

- A `GripVertical` icon appears to the left of the checkbox
- Dragging a row repositions it in the list
- On drop, the new order is persisted to the database by updating the `sort_order` column for affected rows
- The query that fetches saved simulations will order by `sort_order` ascending, then `created_at` descending as a tiebreaker

### Files changed

| File | Change |
|------|--------|
| Database migration | Add `sort_order INTEGER DEFAULT 0` to `project_simulations` |
| `src/components/projects/SimulationPanel.tsx` | Remove the Scenario Comparison block (lines 1611-1642) |
| `src/components/projects/SavedSimulations.tsx` | Add `GripVertical` drag handle, implement native drag-and-drop reorder, persist order via `sort_order` column, update fetch query to sort by `sort_order` |
