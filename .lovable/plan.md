# Toolbar Reorganization & Placement Configuration Plan

## Status: ✅ COMPLETED

## Overview
This plan reorganized the PV Layout Toolbar dropdowns, added new placement tools for walkways and cable trays, and introduced configuration options (orientation and spacing) for inverters, walkways, and cable trays before placement.

---

## Summary of Changes Implemented

### 1. Toolbar Dropdown Reorganization ✅
- **Renamed** "Roof & Arrays" → "Roof Masks"
- **Renamed** "Draw Roof Mask" → "Roof Mask"
- **Moved** "Place PV Array" to "Equipment" dropdown, renamed to "Solar Module"
- **Reordered** dropdowns: File → General → Plant Setup → **Roof Masks** → **Equipment** → **Materials**
- **Renamed** "Cabling" → "Materials"
- **Moved** DC Combiner and AC Disconnect from Equipment to Materials
- **Added** Walkway and Cable Tray tools to "Materials" section

### 2. New Dropdown Structure ✅

**Roof Masks** (was "Roof & Arrays"):
- Roof Mask (with copy button)

**Equipment** (moved above Materials):
- Solar Module (was "Place PV Array", with copy button)
- Inverter
- Main Board

**Materials** (was "Cabling"):
- DC Cable
- AC Cable
- DC Combiner (moved from Equipment)
- AC Disconnect (moved from Equipment)
- Walkway (NEW)
- Cable Tray (NEW)

### 3. New Tool Types ✅
Added to `Tool` enum:
- `PLACE_WALKWAY = 'place_walkway'`
- `PLACE_CABLE_TRAY = 'place_cable_tray'`

### 4. Placement Configuration ✅
When selecting inverter, walkway, or cable tray tools, inline controls show:
- **Orientation** selector (portrait/landscape)
- **Minimum Spacing** input (in meters, default 0.3m)
- **Rotation** control (press R to rotate)

### 5. Canvas Updates ✅
- Ghost previews for walkway and cable tray placement
- Placement click handlers for walkways and cable trays
- Drawing functions for walkways (hatched pattern) and cable trays (ladder pattern)

---

## Files Modified

| File | Changes |
|------|---------|
| `src/components/floor-plan/types.ts` | Added PLACE_WALKWAY, PLACE_CABLE_TRAY tools; Updated PlacedWalkway and PlacedCableTray interfaces with position, rotation, minSpacing |
| `src/components/floor-plan/components/Toolbar.tsx` | Reorganized dropdowns, renamed sections, added walkway/cable tray tools, added orientation/spacing inline controls |
| `src/components/floor-plan/utils/drawing.ts` | Added drawWalkway and drawCableTray functions; Updated renderAllMarkups to include walkways and cable trays |
| `src/components/floor-plan/components/Canvas.tsx` | Added props for walkways/cable trays; Added ghost previews and placement handlers |
| `src/components/floor-plan/FloorPlanMarkup.tsx` | Added placementOrientation and placementMinSpacing state; Wired up new props to Canvas and Toolbar |

---

## Visual Changes Summary

```text
Before:                          After:
├── File                         ├── File
├── General                      ├── General
├── Plant Setup                  ├── Plant Setup
├── Roof & Arrays                ├── Roof Masks
│   ├── Draw Roof Mask           │   └── Roof Mask
│   └── Place PV Array           ├── Equipment
├── Cabling                      │   ├── Solar Module
│   ├── DC Cable                 │   ├── Inverter
│   └── AC Cable                 │   └── Main Board
└── Equipment                    └── Materials
    ├── Inverter                     ├── DC Cable
    ├── DC Combiner                  ├── AC Cable
    ├── AC Disconnect                ├── DC Combiner
    └── Main Board                   ├── AC Disconnect
                                     ├── Walkway
                                     └── Cable Tray
```
