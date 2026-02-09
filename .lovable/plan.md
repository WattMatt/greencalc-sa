
# Fix DC Cable Ghost Preview Consistency

## Problem
The ghost preview line shown during cable endpoint editing looks completely different from the ghost shown during initial cable placement. Two key differences:

1. **Color mismatch**: Initial placement uses `#f97316` (orange, from `TOOL_COLORS.LINE_DC`), but endpoint editing uses `#ef4444` (red, from a locally-computed `cableColor`).
2. **Line style mismatch**: Initial placement draws a **solid** line (no dash pattern), but endpoint editing draws a **dashed** line with `setLineDash([4, 4])`.

## Root Cause
The initial placement ghost is drawn at line ~374 in Canvas.tsx:
```text
ctx.strokeStyle = activeTool === Tool.ROOF_MASK ? '#9470d8' : '#f97316';
ctx.lineWidth = 2 / viewState.zoom;
// No setLineDash -- solid line
```

The endpoint editing ghost is drawn at line ~844:
```text
ctx.strokeStyle = cableColor; // #ef4444 for DC (wrong color)
ctx.lineWidth = 2 / viewState.zoom;
ctx.setLineDash([4 / viewState.zoom, 4 / viewState.zoom]); // dashed (wrong style)
```

## Fix

Update the endpoint editing ghost rendering (around lines 844-849) to match the initial placement ghost exactly:

1. Use `TOOL_COLORS.LINE_DC` (`#f97316`) for DC cables and `TOOL_COLORS.LINE_AC` (`#4d4dff`) for AC cables instead of the red/green `cableColor`.
2. Remove the `setLineDash` call so the ghost line is solid, matching initial placement.
3. Also remove the corresponding `ctx.setLineDash([])` reset since dashing is no longer applied.

### Technical Details

In `src/components/floor-plan/components/Canvas.tsx`, the ghost cable preview block (~lines 844-849) will change from:

```typescript
ctx.strokeStyle = cableColor;
ctx.lineWidth = 2 / viewState.zoom;
ctx.setLineDash([4 / viewState.zoom, 4 / viewState.zoom]);
ctx.stroke();
ctx.setLineDash([]);
```

To:

```typescript
ctx.strokeStyle = cable.type === 'dc' ? TOOL_COLORS.LINE_DC : TOOL_COLORS.LINE_AC;
ctx.lineWidth = 2 / viewState.zoom;
ctx.stroke();
```

This uses the same color constants (`TOOL_COLORS.LINE_DC = '#f97316'`, `TOOL_COLORS.LINE_AC = '#4d4dff'`) and same solid line style as the initial placement ghost, ensuring a uniform drawing experience across both modes.
