

## ✅ COMPLETED: Capture Cable Connections During Placement

### Summary
Implemented the plan to store cable connection IDs (`from`/`to`) during placement instead of relying on proximity-based calculations.

### Changes Made

**1. `src/components/floor-plan/components/Canvas.tsx`**
- Added `cableStartConnection` state to track the snap target when the first cable point is placed
- Updated `completeDrawing()` to include `from` field from stored start connection
- Updated `cancelDrawing()` to reset `cableStartConnection` state
- Updated auto-complete cable creation to:
  - Include both `from` (start connection) and `to` (end connection) in the `SupplyLine`
  - Capture `cableStartConnection` when placing the first point
  - Reset `cableStartConnection` after cable completion

**2. `src/components/floor-plan/components/SummaryPanel.tsx`**
- Updated `getPVArrayForString()` to first try direct lookup using `cable.from`/`cable.to` IDs
- Falls back to legacy proximity matching for older cables without stored connections

### Benefits
| Aspect | Before | After |
|--------|--------|-------|
| Accuracy | Proximity-based (could match wrong array) | Exact connection stored at creation |
| Performance | O(n) distance calculations per cable | O(1) direct lookup |
| Reliability | Breaks if objects move | Connection persists regardless of movement |
| Backward compatible | N/A | Legacy cables still work via fallback |


