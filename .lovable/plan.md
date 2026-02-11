

# Add Date Range Navigation Arrows with Auto-Inferred Step

## Overview
Add left/right arrow buttons to the right of the date range filter. The step size is automatically determined by the number of days between the "From" and "To" dates. Clicking an arrow shifts the entire window by that amount.

## Example
- If From = Jan 5, To = Jan 10 (5-day span), clicking right shifts to From = Jan 10, To = Jan 15.
- If From = Jan 1, To = Jan 7 (7-day span), clicking left is disabled (already at month start).

## Changes

**File: `src/components/projects/generation/PerformanceChart.tsx`**

### 1. Add Navigation Arrows
Place a left arrow (`ChevronLeft`) and right arrow (`ChevronRight`) button to the right of the "To" date input, in the same row.

### 2. Step Logic
- Calculate the step as the difference in days between `dateEnd` and `dateStart` (plus 1 to include both endpoints, or just the raw difference -- using raw difference so the window slides by its own width).
- **Step Left**: Subtract the step from both `dateStart` and `dateEnd`, clamping `dateStart` to the first of the month and adjusting `dateEnd` accordingly.
- **Step Right**: Add the step to both dates, clamping `dateEnd` to the last day of the month and adjusting `dateStart` accordingly.

### 3. Boundary Behavior
- Left arrow disabled when `dateStart` is already at the first of the month.
- Right arrow disabled when `dateEnd` is already at the last day of the month.
- When a step would exceed the boundary, the window is clamped so it butts up against the edge while preserving its width if possible.

## Technical Details

- Import `ChevronLeft`, `ChevronRight` from `lucide-react`
- Import `Button` from `@/components/ui/button`
- Compute step: `const stepDays = Math.round((new Date(dateEnd).getTime() - new Date(dateStart).getTime()) / 86400000) + 1`
- Helper to shift a date string by N days:
  ```text
  function shiftDate(date: string, days: number): string {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }
  ```
- On left click: compute new start/end, clamp to `startDate`/`endDate` (month boundaries)
- On right click: same in the other direction
- Buttons styled as `variant="outline" size="icon"` with `h-8 w-8` to match existing controls

