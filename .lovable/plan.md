

# 3D Elevation and Viewer for PV Layout

## Overview

Add elevation (height) data to all layout objects and introduce a 3D viewer powered by React Three Fiber, enabling accurate vertical cable distance calculations and visual site verification.

## Phase 1: Elevation Data Model

Add an `elevation` property (meters above ground) to every placeable object type, and update cable length calculations to account for vertical distance.

### Type Changes (`src/components/floor-plan/types.ts`)

- Add `elevation?: number` (meters) to:
  - `PVArrayItem` -- height of the array (e.g., rooftop at 6m)
  - `EquipmentItem` -- height of inverters, boards, etc.
  - `PlacedWalkway` -- elevation of walkway surface
  - `PlacedCableTray` -- elevation of cable tray
- Add `elevations?: number[]` to `SupplyLine` -- per-point elevation array matching the `points` array, enabling cables to change elevation along their route

### Geometry Updates (`src/components/floor-plan/utils/geometry.ts`)

- Update `calculateLineLength` to accept an optional `elevations` array
- When elevations are provided, compute 3D segment lengths:
  ```
  sqrt(dx^2 + dy^2 + dz^2) * scaleRatio
  ```
  where `dz` is the elevation difference in world units (converted from meters back to pixel-space via scaleRatio)
- Existing calls without elevations continue to work unchanged (backward compatible)

### UI for Editing Elevation

- Add an "Elevation (m)" field to `ObjectConfigModal` for equipment, walkways, cable trays
- Add an "Elevation (m)" field to `PVArrayModal` for PV arrays
- For cables: auto-inherit elevation from connected endpoints (from/to objects), or allow manual override per cable in its config dialog

### Summary Panel Updates

- Show "3D Length" alongside existing horizontal length for cables where elevation data exists
- Show elevation value next to each object in the summary list

## Phase 2: 3D Viewer

Add a toggleable 3D view using `@react-three/fiber` (v8) and `@react-three/drei` (v9) that renders the entire layout with elevation.

### New Component: `ThreeDViewer`

Location: `src/components/floor-plan/components/ThreeDViewer.tsx`

- Renders a Three.js canvas using `@react-three/fiber`
- Receives the same design state props as the 2D canvas (pvArrays, equipment, lines, walkways, cableTrays, roofMasks)
- Uses `@react-three/drei` for orbit controls, grid helper, and labels

### 3D Object Rendering

| Object | 3D Representation |
|---|---|
| Roof Masks | Flat planes at ground level, tilted by pitch angle |
| PV Arrays | Thin boxes (panel dimensions) at their elevation, tilted to match roof pitch |
| Equipment | Simple box meshes at their elevation, color-coded by type |
| DC Cables | Orange tube geometry following point paths with elevation |
| AC Cables | Blue tube geometry following point paths with elevation |
| Walkways | Flat box meshes at their elevation |
| Cable Trays | Narrow box meshes at their elevation |

### View Toggle

- Add a "2D / 3D" toggle button to the Toolbar
- 3D view replaces the Canvas component when active (not side-by-side, to keep it simple)
- 3D view is read-only for visualization; all editing stays in 2D
- Orbit controls (rotate, zoom, pan) for free camera movement

### Camera and Navigation

- Default camera positioned to show the full site from an elevated angle
- "Reset View" button to return to default camera position
- Optional: click an object in 3D to highlight it in the summary panel

## Phase 3: Cable Auto-Elevation

- When a cable's `from` connects to a PV array at elevation 6m and `to` connects to an inverter at elevation 1.5m, automatically populate the cable's elevation array
- Intermediate waypoints default to linear interpolation unless manually overridden

## Dependencies

- `@react-three/fiber@^8.18` (compatible with React 18)
- `@react-three/drei@^9.122.0`
- `three@^0.133` (peer dependency)

## Implementation Order

1. Add elevation fields to types (backward compatible, all optional)
2. Update `calculateLineLength` for 3D
3. Add elevation inputs to existing config modals
4. Update Summary Panel to show 3D lengths
5. Install Three.js dependencies
6. Build `ThreeDViewer` component with basic object rendering
7. Add 2D/3D toggle to Toolbar
8. Implement cable auto-elevation from connected objects

## Technical Notes

- All elevation values default to `0` (ground level) when not set, preserving full backward compatibility with existing layouts
- The 3D viewer is purely for visualization -- no editing in 3D mode to keep complexity manageable
- Saved layout JSON automatically includes elevation data with no schema migration needed (optional fields)
- The 2D canvas remains unchanged; elevation is only visible via the config modals and 3D viewer

