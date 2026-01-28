

# Plan: Canvas Resize Fix + Collapsible Toolbar Sections

## Overview

This plan addresses four requests:
1. **Fix canvas not updating when right Summary panel collapses/expands**
2. **Move "Back to Designs" button above Layouts/Load Image and group them in a collapsible dropdown**
3. **Group General tools (Select, Pan, Set Scale) in a collapsible section**
4. **Make PV Setup, Roof & Arrays, Cabling, and Equipment all collapsible sections**

---

## Part 1: Canvas Resize Fix

### Problem
When the right-side Summary panel collapses or expands, the canvas container size changes but the canvas doesn't re-render. This is because the Canvas component's `useEffect` that sets up the drawing canvas size only triggers based on content changes, not container size changes.

### Solution
Add a `ResizeObserver` to the Canvas component to detect when the container dimensions change and trigger a re-render.

### File: `src/components/floor-plan/components/Canvas.tsx`

Add a state to track container dimensions and a `ResizeObserver` to detect changes:

```typescript
// Add state to track container dimensions
const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });

// Add ResizeObserver effect
useEffect(() => {
  const container = containerRef.current;
  if (!container) return;
  
  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect;
      setContainerSize({ width, height });
    }
  });
  
  resizeObserver.observe(container);
  return () => resizeObserver.disconnect();
}, []);
```

Update the drawing canvas `useEffect` to include `containerSize` as a dependency:

```typescript
useEffect(() => {
  // ... existing drawing code
}, [viewState, equipment, lines, roofMasks, pvArrays, scaleInfo, pvPanelConfig, 
    selectedItemId, scaleLine, currentDrawing, previewPoint, containerSize, activeTool]);
```

---

## Part 2: Toolbar Reorganization with Collapsible Sections

### Current Structure
```
- Back to Designs (button in header)
- PV Layout Tool (title)
- Layouts (button)
- Load Image (button)
- General (label + buttons)
- PV Setup (label + button)
- Roof & Arrays (label + buttons)
- Cabling (label + buttons)
- Equipment (label + buttons)
```

### New Structure
```
- PV Layout Tool (title)
- Layout Name
- [File] (collapsible dropdown - open by default)
    - Back to Designs
    - Layouts  
    - Load Image
- [General] (collapsible - open by default)
    - Select
    - Pan
    - Set Scale
- [PV Setup] (collapsible)
    - View Panel Config
- [Roof & Arrays] (collapsible)
    - Draw Roof Mask
    - Place PV Array
- [Cabling] (collapsible)
    - DC Cable
    - AC Cable
- [Equipment] (collapsible)
    - Inverter
    - DC Combiner
    - AC Disconnect
    - Main Board
```

### File: `src/components/floor-plan/components/Toolbar.tsx`

**Imports to add:**
```typescript
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
```

**Add state for collapsed sections:**
```typescript
const [openSections, setOpenSections] = useState<Record<string, boolean>>({
  file: true,
  general: true,
  pvSetup: false,
  roofArrays: false,
  cabling: false,
  equipment: false,
});

const toggleSection = (section: string) => {
  setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
};
```

**Create a reusable CollapsibleSection component:**
```typescript
interface CollapsibleSectionProps {
  title: string;
  sectionKey: string;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
}

const CollapsibleSection = ({ title, sectionKey, children, isOpen, onToggle }: CollapsibleSectionProps) => (
  <Collapsible open={isOpen} onOpenChange={onToggle}>
    <CollapsibleTrigger asChild>
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-between px-2 py-1"
      >
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
        <ChevronDown className={cn("h-3 w-3 transition-transform", isOpen && "rotate-180")} />
      </Button>
    </CollapsibleTrigger>
    <CollapsibleContent className="space-y-1 pt-1">
      {children}
    </CollapsibleContent>
  </Collapsible>
);
```

**Refactor toolbar sections:**

Replace the current flat structure with collapsible sections:

```tsx
<div className="flex-1 overflow-y-auto p-2 space-y-1">
  {/* File Section (Back to Designs, Layouts, Load Image) */}
  <CollapsibleSection 
    title="File" 
    sectionKey="file"
    isOpen={openSections.file}
    onToggle={() => toggleSection('file')}
  >
    {onBackToBrowser && (
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start"
        onClick={onBackToBrowser}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        <span className="text-xs">Back to Designs</span>
      </Button>
    )}
    <Button variant="outline" size="sm" className="w-full justify-start" onClick={onOpenLayoutManager}>
      <FolderOpen className="h-4 w-4 mr-2" />
      <span className="text-xs">Layouts</span>
    </Button>
    <Button variant="outline" size="sm" className="w-full justify-start" onClick={onOpenLoadLayout}>
      <Upload className="h-4 w-4 mr-2" />
      <span className="text-xs">Load Image</span>
    </Button>
  </CollapsibleSection>

  <Separator className="my-2" />

  {/* General Tools */}
  <CollapsibleSection 
    title="General" 
    sectionKey="general"
    isOpen={openSections.general}
    onToggle={() => toggleSection('general')}
  >
    <ToolButton icon={MousePointer} label="Select" ... />
    <ToolButton icon={Hand} label="Pan" ... />
    <ToolButton icon={Ruler} label="Set Scale" ... />
  </CollapsibleSection>

  <Separator className="my-2" />

  {/* PV Setup */}
  <CollapsibleSection 
    title="PV Setup" 
    sectionKey="pvSetup"
    isOpen={openSections.pvSetup}
    onToggle={() => toggleSection('pvSetup')}
  >
    <Button variant="outline" size="sm" ... onClick={onOpenPVConfig}>
      View Panel Config
    </Button>
  </CollapsibleSection>

  {/* ... same pattern for Roof & Arrays, Cabling, Equipment */}
</div>
```

**Move "Back to Designs" out of header:**
Remove the "Back to Designs" button from the header section (lines 144-154) since it's now inside the File collapsible section.

---

## Summary of Changes

| File | Change |
|------|--------|
| `Canvas.tsx` | Add ResizeObserver to detect container size changes and trigger canvas re-render |
| `Toolbar.tsx` | Add collapsible sections for File, General, PV Setup, Roof & Arrays, Cabling, Equipment |
| `Toolbar.tsx` | Move "Back to Designs" into File section as first item |
| `Toolbar.tsx` | Import Collapsible components and ChevronDown icon |

---

## Visual Result

**Expanded toolbar with collapsed sections:**
```
+------------------------+
| PV Layout Tool         |
| New Layout •           |
| 12 panels • 6.5 kWp    |
+------------------------+
| [v] File               |
|   Back to Designs      |
|   Layouts              |
|   Load Image           |
+------------------------+
| [v] General            |
|   Select               |
|   Pan                  |
|   Set Scale [✓]        |
+------------------------+
| [>] PV Setup           |
+------------------------+
| [>] Roof & Arrays      |
+------------------------+
| [>] Cabling            |
+------------------------+
| [>] Equipment          |
+------------------------+
| [Save Layout]          |
| [Undo] [Redo]          |
+------------------------+
```

This allows users to collapse unused sections to reduce vertical scrolling while keeping essential tools readily accessible.

