

# Plan: Collapsible Toolbar and Summary Panels

## Overview

Add collapse/expand functionality to both the left-hand **Toolbar** pane (PV Layout tools) and the right-hand **SummaryPanel** (Project Summary) in the PV Layout editor view. This will allow users to maximize canvas space when needed.

## Design Approach

Each panel will have:
- A collapse button (chevron icon) in the header
- Collapsed state shows only a thin strip with an expand button
- Smooth transition between states
- State managed in parent component (`FloorPlanMarkup.tsx`)

## Visual Behavior

```text
EXPANDED VIEW:
+----------+------------------+----------+
| Toolbar  |      Canvas      | Summary  |
| (w-52)   |    (flex-1)      | (w-64)   |
|    [<]   |                  |    [>]   |
+----------+------------------+----------+

LEFT COLLAPSED:
+---+------------------------+----------+
|[>]|        Canvas          | Summary  |
+---+------------------------+----------+

RIGHT COLLAPSED:
+----------+------------------------+---+
| Toolbar  |        Canvas          |[<]|
+----------+------------------------+---+

BOTH COLLAPSED:
+---+------------------------------+---+
|[>]|           Canvas             |[<]|
+---+------------------------------+---+
```

## File Changes

### 1. `src/components/floor-plan/FloorPlanMarkup.tsx`

Add state for panel visibility:
```typescript
const [isToolbarCollapsed, setIsToolbarCollapsed] = useState(false);
const [isSummaryCollapsed, setIsSummaryCollapsed] = useState(false);
```

Pass collapse state and toggle handlers to Toolbar and SummaryPanel:
```typescript
<Toolbar
  isCollapsed={isToolbarCollapsed}
  onToggleCollapse={() => setIsToolbarCollapsed(!isToolbarCollapsed)}
  // ... other props
/>

<SummaryPanel
  isCollapsed={isSummaryCollapsed}
  onToggleCollapse={() => setIsSummaryCollapsed(!isSummaryCollapsed)}
  // ... other props
/>
```

### 2. `src/components/floor-plan/components/Toolbar.tsx`

Add new props:
```typescript
interface ToolbarProps {
  // ... existing props
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}
```

Modify the component to render collapsed or expanded view:
- When collapsed: render a thin vertical strip (`w-10`) with just an expand chevron button
- When expanded: render full toolbar with a collapse button in the header

```typescript
if (isCollapsed) {
  return (
    <div className="w-10 bg-card border-r flex flex-col items-center py-3">
      <Button variant="ghost" size="icon" onClick={onToggleCollapse}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

// Full toolbar with collapse button
return (
  <div className="w-52 bg-card border-r flex flex-col h-full">
    <div className="p-3 border-b flex items-start justify-between">
      <div>
        {/* Back button, title, etc. */}
      </div>
      <Button variant="ghost" size="icon" onClick={onToggleCollapse}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
    </div>
    {/* Rest of toolbar */}
  </div>
);
```

### 3. `src/components/floor-plan/components/SummaryPanel.tsx`

Add new props:
```typescript
interface SummaryPanelProps {
  // ... existing props
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}
```

Modify the component similarly:
- When collapsed: render a thin vertical strip (`w-10`) with just an expand chevron button
- When expanded: render full panel with a collapse button in the header

```typescript
if (isCollapsed) {
  return (
    <div className="w-10 bg-card border-l flex flex-col items-center py-3">
      <Button variant="ghost" size="icon" onClick={onToggleCollapse}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
    </div>
  );
}

// Full panel with collapse button
return (
  <div className="w-64 bg-card border-l flex flex-col h-full">
    <div className="p-3 border-b flex items-center justify-between">
      <h2 className="font-semibold text-sm">Project Summary</h2>
      <Button variant="ghost" size="icon" onClick={onToggleCollapse}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
    {/* Rest of panel */}
  </div>
);
```

## Icon Logic

- **Left panel (Toolbar)**:
  - Expanded: `ChevronLeft` (pointing left = "collapse to left")
  - Collapsed: `ChevronRight` (pointing right = "expand from left")
  
- **Right panel (Summary)**:
  - Expanded: `ChevronRight` (pointing right = "collapse to right")
  - Collapsed: `ChevronLeft` (pointing left = "expand from right")

## Implementation Steps

1. Update `Toolbar.tsx`:
   - Add `isCollapsed` and `onToggleCollapse` props
   - Import `ChevronLeft`, `ChevronRight` from lucide-react
   - Add collapsed state rendering (thin strip with expand button)
   - Add collapse button to header when expanded

2. Update `SummaryPanel.tsx`:
   - Add `isCollapsed` and `onToggleCollapse` props
   - Import `ChevronLeft`, `ChevronRight`, `Button` 
   - Add collapsed state rendering
   - Add collapse button to header when expanded

3. Update `FloorPlanMarkup.tsx`:
   - Add `isToolbarCollapsed` and `isSummaryCollapsed` state
   - Pass collapse props to both components

## Technical Notes

- Transitions will be instant (no animation) for simplicity
- The Canvas will automatically expand via `flex-1` when panels collapse
- Collapse state is not persisted (resets when navigating away) - can add localStorage persistence later if desired


