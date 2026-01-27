
# Sidebar Header Icon Layout Adjustment

## Current State
The sidebar header has this layout:
```
┌────────────────────────────┐
│ [Logo] Green Energy        │
│        Financial Platform  │
├────────────────────────────┤
│ [Sync] [🌙] [◀]           │  ← Both icons on same row below logo
└────────────────────────────┘
```

When collapsed, both icons shrink and remain visible (but hard to use).

## Requested Layout

**Expanded State:**
```
┌────────────────────────────┐
│ [Logo] Green Energy   [🌙] │  ← Dark mode icon RIGHT of logo/text
│        Financial Platform  │
├────────────────────────────┤
│                       [◀]  │  ← Collapse icon below, right-aligned
└────────────────────────────┘
```

**Collapsed State:**
```
┌──────┐
│[Logo]│
├──────┤
│ [▶]  │  ← Only collapse icon visible (centered)
└──────┘
```

---

## Technical Changes

### File: `src/components/layout/AppSidebar.tsx`

**1. Move dark mode icon to logo row (right side)**
- Add the theme toggle button to the logo row with `ml-auto` to push it right
- Only show when `!isCollapsed`

**2. Move collapse icon to separate row below**
- Keep `SidebarTrigger` on its own row
- Right-align it with `justify-end` when expanded
- Center it when collapsed
- Always visible in both states

**3. Remove SyncStatus from controls row**
- Move `SyncStatus` to the logo row (between text and dark mode icon) or remove if not needed when collapsed

---

## Code Structure

```tsx
<SidebarHeader className="p-4">
  <div className="flex flex-col gap-2">
    {/* Row 1: Logo + Company Name + Dark Mode (right) */}
    <div className="flex items-center gap-3">
      {/* Logo */}
      {orgBranding.logo_url ? (
        <img ... />
      ) : (
        <div ...><Zap /></div>
      )}
      
      {/* Company name - only when expanded */}
      {!isCollapsed && (
        <div className="flex flex-col flex-1">
          <span>Green Energy</span>
          <span>Financial Platform</span>
        </div>
      )}
      
      {/* Dark mode toggle - only when expanded, right-aligned */}
      {!isCollapsed && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={toggleTheme}>
              {theme === "dark" ? <Sun /> : <Moon />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            Toggle theme
          </TooltipContent>
        </Tooltip>
      )}
    </div>
    
    {/* Row 2: Collapse trigger - always visible */}
    <div className={`flex ${isCollapsed ? "justify-center" : "justify-end"}`}>
      <SidebarTrigger className="h-8 w-8" />
    </div>
  </div>
</SidebarHeader>
```

---

## Visual Summary

| State | Dark Mode Icon | Collapse Icon |
|-------|---------------|---------------|
| Expanded | Visible (right of text) | Visible (below, right-aligned) |
| Collapsed | Hidden | Visible (centered) |

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/layout/AppSidebar.tsx` | Restructure header layout: move dark mode to logo row, collapse icon to separate row below |
