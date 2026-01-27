
# Fix Sidebar Icon Center Alignment

## Problem

Looking at the screenshot, the navigation icons are not centered in the collapsed sidebar. The issue is caused by the `px-3` (12px horizontal padding) on the NavLink elements - this padding pushes the icon off-center even when `justify-center` is applied.

## Current Code Issue

```tsx
// Lines 148, 169, 191, 213, 231, 259
className={`flex items-center gap-3 px-3 py-2 rounded-md ... ${isCollapsed ? "justify-center" : ""}`}
```

When collapsed:
- `px-3` adds 12px padding on both left AND right
- But the icon only exists on one side (no text)
- Result: icon appears shifted left

## Solution

Remove the horizontal padding (`px-3`) when the sidebar is collapsed:
- Expanded: `px-3 py-2` (keep padding for good touch targets)
- Collapsed: `py-2 px-0` (remove horizontal padding so icons center properly)

Also fix the `gap-3` which adds unwanted space even when text is hidden.

## Code Changes

**File: `src/components/layout/AppSidebar.tsx`**

For ALL NavLink elements and the Sign Out button, change from:
```tsx
className={`flex items-center gap-3 px-3 py-2 ... ${isCollapsed ? "justify-center" : ""}`}
```

To:
```tsx
className={`flex items-center rounded-md transition-colors hover:bg-sidebar-accent ${
  isCollapsed 
    ? "justify-center py-2 px-0" 
    : "gap-3 px-3 py-2"
}`}
```

### Affected Elements (6 total)

| Line | Element | Change |
|------|---------|--------|
| 148 | Dashboard NavLink | Remove `px-3 gap-3` when collapsed |
| 169 | Reference Data NavLinks | Remove `px-3 gap-3` when collapsed |
| 191 | Modeling NavLinks | Remove `px-3 gap-3` when collapsed |
| 213 | System NavLinks | Remove `px-3 gap-3` when collapsed |
| 231 | Profile NavLink | Remove `px-3 gap-3` when collapsed |
| 259 | Sign Out Button | Remove `px-3 gap-3` when collapsed |

## Expected Result

After fix:
```
┌──────┐
│ [⚡] │  ← Logo centered
├──────┤
│ [▶]  │  ← Trigger centered
├──────┤
│ [🏠] │  ← Dashboard icon CENTERED
│ [📊] │  ← Projects icon CENTERED
│ [⚙️] │  ← Settings icon CENTERED
│      │
│ [👤] │  ← Avatar CENTERED
│ [→]  │  ← Sign out CENTERED
└──────┘
```
