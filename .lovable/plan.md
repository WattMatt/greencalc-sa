
## Plan: Fix Icon Positioning and Tab Highlighting

### Overview
This plan addresses two visual issues:
1. Three icons at the top left overlapping when the sidebar is collapsed
2. The selected tab (e.g., "Load Profile") not appearing highlighted/distinguished from unselected tabs

---

### Issue 1: Icon Positioning in Collapsed Sidebar

**Current Problem:**  
In `AppSidebar.tsx`, the `SidebarHeader` contains multiple elements (logo, company name, SyncStatus, theme toggle) that compete for space when the sidebar is collapsed. The current layout (lines 82-129) doesn't properly handle the collapsed state for all these elements.

**Solution:**  
Improve the header layout to properly space icons when collapsed:
- Ensure the logo, SyncStatus, and theme toggle icons stack vertically or are properly separated when collapsed
- Hide the SyncStatus when collapsed (it's already conditionally hidden but may still take space)
- Add proper flex-direction and gap to prevent overlap
- Ensure the `SidebarTrigger` in `AppLayout.tsx` has proper positioning relative to the sidebar icons

**File Changes:**
1. **`src/components/layout/AppSidebar.tsx`** (lines 82-130):
   - Restructure the header layout to use `flex-col` when collapsed
   - Properly center the logo when collapsed
   - Ensure theme toggle doesn't overlap with the logo

2. **`src/components/layout/AppLayout.tsx`** (lines 15-17):
   - Add proper margin/spacing to the `SidebarTrigger` to prevent overlap with sidebar content

---

### Issue 2: Tab Highlighting Not Visible

**Current Problem:**  
The `TabsTrigger` component uses `data-[state=active]:bg-background` for the active state. Looking at the CSS variables:
- `--background`: 210 20% 98% (very light, ~98% lightness)
- `--muted`: 215 15% 92% (~92% lightness)

The 6% difference in lightness is insufficient for clear visual distinction between the active tab and the tab list background.

**Solution:**  
Enhance the active tab styling in `tabs.tsx` to make the selected state more prominent:
- Change active background to pure white (`bg-white dark:bg-card`) or a higher contrast color
- Increase shadow on active tab (`shadow-md` instead of `shadow-sm`)
- Add a subtle border or ring to the active tab
- Optionally use `primary` color accent for the active tab

**File Changes:**
1. **`src/components/ui/tabs.tsx`** (lines 23-35):
   - Update `TabsTrigger` styling for better active state visibility
   - Change from `data-[state=active]:bg-background data-[state=active]:shadow-sm` to something more distinctive like:
     - `data-[state=active]:bg-white data-[state=active]:shadow-md` for light mode
     - Add `dark:data-[state=active]:bg-card` for dark mode
     - Consider adding `data-[state=active]:border data-[state=active]:border-border` for extra definition

---

### Technical Implementation Details

**AppSidebar.tsx Header Changes:**
```tsx
// Restructure SidebarHeader for better collapsed behavior
<SidebarHeader className="p-4">
  <div className={cn(
    "flex items-center",
    isCollapsed ? "flex-col gap-2" : "justify-between"
  )}>
    {/* Logo section */}
    <div className={cn("flex items-center", isCollapsed ? "justify-center" : "gap-3")}>
      {/* Logo */}
    </div>
    
    {/* Controls - only show when not collapsed */}
    {!isCollapsed && (
      <div className="flex items-center gap-1">
        <SyncStatus />
        {/* Theme toggle */}
      </div>
    )}
  </div>
  
  {/* When collapsed, show only the theme toggle below logo */}
  {isCollapsed && (
    <div className="flex justify-center mt-2">
      {/* Theme toggle only */}
    </div>
  )}
</SidebarHeader>
```

**TabsTrigger Styling Enhancement:**
```tsx
// Updated TabsTrigger with better active state visibility
className={cn(
  "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all",
  // Active state with higher contrast
  "data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-border/50",
  // Dark mode active state
  "dark:data-[state=active]:bg-card",
  // Other states
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  className,
)}
```

---

### Summary of Files to Modify

| File | Changes |
|------|---------|
| `src/components/layout/AppSidebar.tsx` | Restructure header for better collapsed state layout |
| `src/components/layout/AppLayout.tsx` | Add spacing to SidebarTrigger |
| `src/components/ui/tabs.tsx` | Enhance active tab styling with better contrast |

---

### Expected Results
1. Icons in the collapsed sidebar will be properly stacked/spaced without overlapping
2. The active tab will have a clearly visible white background with shadow, making it easy to identify which tab is selected
