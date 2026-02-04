# Plan: Cable Tray Type Property (AC/DC) with Cable Snapping

## ✅ COMPLETED

This feature has been fully implemented.

## Summary

Added a new property to cable trays that designates them as either "AC Cable Tray" or "DC Cable Tray". This property determines which type of cables (AC or DC) can snap to that cable tray during placement.

## What Was Implemented

### 1. Updated Data Types (`types.ts`)
- Added `CableTrayType = 'ac' | 'dc'`
- Added optional `cableType` property to `PlacedCableTray` interface

### 2. Updated ObjectConfigModal
- Enabled Properties section for cable trays (no longer grayed out)
- Added "Cable Type" dropdown with AC/DC options
- Added `cableType` to `ObjectProperties` interface

### 3. Updated FloorPlanMarkup
- Extract `cableType` from selected cable trays in `handleContextMenuOpen`
- Apply `cableType` property when updating cable trays in `handleApplyConfig`

### 4. Updated Cable Snapping (`geometry.ts`)
- Added `getCableTraySnapPoints()` function to calculate snap positions along cable tray centerline
- Updated `snapCablePointToTarget()` to accept `placedCableTrays` parameter
- Cable trays with matching type (AC/DC) are now valid snap targets
- Updated `CableSnapTarget` interface to include `'cableTray'` type

### 5. Updated Canvas
- All three calls to `snapCablePointToTarget` now pass `placedCableTrays`

## User Experience

1. User places a cable tray on the canvas
2. User right-clicks on the cable tray → Properties section is now enabled
3. User expands Properties and sees "Cable Type" dropdown
4. User selects "DC Cable Tray" or "AC Cable Tray"
5. When drawing DC cables, they snap to DC cable trays (endpoints and center)
6. When drawing AC cables, they snap to AC cable trays (endpoints and center)

## Backward Compatibility

- Existing cable trays without `cableType` set will not participate in cable snapping until a type is assigned
- The dropdown shows "Select cable type..." placeholder for trays without a type
- Both single and multi-selection work for setting the cable type
