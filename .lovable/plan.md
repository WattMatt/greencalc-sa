

# Fix Jumping Layout in Day Navigation Header

## Problem

The date label text changes width as you navigate days (e.g. "Wednesday, 1 January" vs "Monday, 5 May"), causing the left and right arrow buttons to shift position. The calendar popover also resizes with different months.

## Root Cause

1. The date label between the arrows has no fixed width -- it auto-sizes to its text content, pushing the right arrow around.
2. The arrows are conditionally rendered (`{!showAnnualAverage && ...}`) separately on either side of the date label, so the left arrow position depends on nothing but the right arrow shifts with the label width.
3. The calendar `PopoverContent` uses `w-auto`, letting it resize per month.

## Fix (single file: `DayNavigationHeader.tsx`)

### 1. Fixed-width date label

Give the date trigger button a fixed width (e.g. `w-[280px]`) so the text area never changes size regardless of the day/month name length. The arrows stay pinned.

### 2. Always render arrows (even in annual mode, just hidden)

Replace the conditional rendering of arrows with `visibility: hidden` or `opacity-0 pointer-events-none` when in annual average mode. This keeps the layout stable -- the arrows always occupy space.

Alternatively, since the arrows already have `shrink-0`, just fixing the centre label width is sufficient. The simpler approach: give the centre element a fixed `min-w` so it never collapses or expands.

### 3. Fixed calendar popover dimensions

Change `PopoverContent` from `w-auto` to a fixed width (e.g. `w-[280px]`) so it doesn't resize between months.

## Technical Detail

```text
// Line 69: Add fixed width to the trigger button
<button className="text-left cursor-pointer hover:opacity-80 transition-opacity w-[260px]">

// Line 75: Fixed popover width
<PopoverContent className="w-[280px] p-0" align="start">
```

## Files Changed

| File | Change |
|------|--------|
| `src/components/projects/simulation/DayNavigationHeader.tsx` | Fixed width on date label trigger + fixed calendar popover width |

