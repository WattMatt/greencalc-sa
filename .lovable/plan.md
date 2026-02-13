

## Fix Down Time Tab: Comment Column Separation and Source-Data Mapping

### Problem 1: Comment Column Not Visually Separated
The "Comment" column blends into the last source group. It needs a `border-l` separator to stand out.

### Problem 2: Lost Production Values Are Identical Across All Tie-Ins
The values (413.71, 413.95, 413.75) are nearly identical because the guarantee sources ("Tie-In 1", "Tie-In 2", "Tie-In 3") have **no `reading_source` mapping** set. The actual CSV reading sources are:

- `31190 - Parkdene Solar Checkers`
- `31198 - Parkdene Solar DB2.1`
- `31193 - Parkdene Solar DB3.1`

Since none are linked, the system falls back to distributing the total guarantee evenly across all three sources, producing nearly identical downtime values. **This is a data configuration issue, not a code bug.**

### Plan

**Code change (PerformanceSummaryTable.tsx):**
1. Add `border-l` to the Comment header cells and body/footer cells to visually separate it from the source groups.

**Data fix (user action required):**
2. Open the "Guaranteed Generation Sources" dialog for the active month/year and use the "Link to CSV source" dropdown to map each Tie-In to its correct reading source:
   - Tie-In 1 -> one of `31190 - Parkdene Solar Checkers`, `31198 - Parkdene Solar DB2.1`, `31193 - Parkdene Solar DB3.1`
   - Tie-In 2 -> another
   - Tie-In 3 -> the remaining one

Once mapped, the Lost Production and 30-Min Intervals will correctly reflect each source's individual downtime.

### Technical Details

**File:** `src/components/projects/generation/PerformanceSummaryTable.tsx`

Lines to change:
- Line 443 (header row 1, Comment): add `border-l` class
- Line 454 (header row 2, empty Comment sub-header): add `border-l` class
- Line 471 (body Comment cell): add `border-l` class
- Line 488 (footer Comment cell): add `border-l` class

