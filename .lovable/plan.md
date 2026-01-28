

# Plan: Comment Out Project Overview Panel

## Overview

Remove the right-side "Project Overview" panel from the Layout Browser view, but keep the code commented out with a clear note for future expansion.

## Change

### File: `src/components/floor-plan/components/LayoutBrowser.tsx`

**Lines 289-303** - Comment out the entire Right Panel section:

```tsx
{/* 
  ============================================
  FUTURE EXPANSION: Project Overview Panel
  ============================================
  This panel is reserved for future functionality such as:
  - Project summary stats (name, location, total kWp)
  - Selected layout thumbnail preview on hover
  - Quick project info (coordinates, tariff, tenant area)
  
  Uncomment and implement when ready.
  ============================================
  
  <div className="w-72 bg-card border-l flex flex-col items-center justify-center p-6 text-center">
    <div className="grid grid-cols-2 gap-1 mb-4">
      <div className="w-8 h-8 border rounded flex items-center justify-center">
        <Grid3X3 className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="w-8 h-8 border rounded" />
      <div className="w-8 h-8 border rounded" />
      <div className="w-8 h-8 border rounded" />
    </div>
    <h3 className="font-semibold">Project Overview</h3>
    <p className="text-sm text-muted-foreground mt-2">
      Load a PDF and select design purpose to view project details
    </p>
  </div>
*/}
```

Also remove the unused `Grid3X3` import from line 28 since it won't be needed (or keep it commented if preferred).

## Result

- The center panel will expand to fill the available space
- The commented code provides clear guidance for future developers
- No functionality is lost - just hidden for now

