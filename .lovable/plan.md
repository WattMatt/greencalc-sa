

# Plan: Fix Canvas Not Updating When Right Panel Collapses

## Problem Analysis

The canvas correctly updates when the left Toolbar collapses but **not** when the right SummaryPanel collapses. 

Looking at the current implementation in `Canvas.tsx`:
1. A `ResizeObserver` watches the container and updates `containerSize` state (lines 53-66)
2. The drawing `useEffect` has `containerSize` in its dependencies (line 121)
3. However, inside the effect, the canvas dimensions are set using `container.getBoundingClientRect()` (line 91)

The issue is a subtle timing problem: when `containerSize` triggers the effect, the `getBoundingClientRect()` call may return the same values if the browser hasn't finished the layout reflow, or there could be a synchronization issue between the state update and the actual DOM measurement.

## Root Cause

The `containerSize` state exists and updates correctly, but it's not actually being **used** to set the canvas dimensions. The effect uses `getBoundingClientRect()` instead of the `containerSize` state values. This means the state change triggers the effect, but the actual canvas sizing still depends on a separate DOM measurement which may not reflect the latest layout.

## Solution

Use the `containerSize` state values directly to set the canvas dimensions instead of calling `getBoundingClientRect()` inside the effect. This ensures the canvas dimensions are synchronized with the state that triggered the re-render.

## File Change

### `src/components/floor-plan/components/Canvas.tsx`

**Current code (lines 85-93):**
```typescript
useEffect(() => {
  const canvas = drawingCanvasRef.current;
  const container = containerRef.current;
  if (!canvas || !container) return;
  
  // Set canvas to container size for proper mouse hit detection
  const rect = container.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
```

**Updated code:**
```typescript
useEffect(() => {
  const canvas = drawingCanvasRef.current;
  const container = containerRef.current;
  if (!canvas || !container) return;
  
  // Use containerSize state directly for proper reactivity when panels collapse/expand
  canvas.width = containerSize.width;
  canvas.height = containerSize.height;
```

This change ensures that:
1. When the ResizeObserver fires (for either left or right panel toggle), `containerSize` is updated
2. The drawing useEffect re-runs because `containerSize` is a dependency
3. The canvas dimensions are set using the **same values** that triggered the re-render, guaranteeing synchronization

## Why This Fixes the Issue

Currently the logic is:
1. Panel collapses → container resizes
2. ResizeObserver fires → `setContainerSize({ width, height })`
3. React re-renders → useEffect runs
4. useEffect calls `getBoundingClientRect()` → might get stale/same values

With the fix:
1. Panel collapses → container resizes  
2. ResizeObserver fires → `setContainerSize({ width, height })`
3. React re-renders → useEffect runs
4. useEffect uses `containerSize.width/height` → guaranteed to use the new values

## Summary

| File | Change |
|------|--------|
| `Canvas.tsx` | Use `containerSize` state values instead of `getBoundingClientRect()` for canvas dimensions |

