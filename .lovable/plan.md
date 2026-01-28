# Plan: Landing View for PV Layout with File Browser Interface

## Status: ✅ IMPLEMENTED

## Overview

Transformed the PV Layout experience from immediately showing the canvas editor to showing a **layout browser landing page first**. Users now see a file manager interface where they can browse, create, and select layouts. Only when they click on a specific layout or create a new one will they enter the canvas editing mode.

## Implementation Complete

### Files Created/Modified:
1. **`src/components/floor-plan/components/LayoutBrowser.tsx`** (NEW)
   - Three-panel layout: left sidebar, center folder list, right overview
   - Left sidebar with FILE ACTIONS and ADVANCED collapsible sections
   - Center panel with layout cards in "Uncategorized" folder
   - Design cards with rename/duplicate/delete actions
   - Right panel with project overview placeholder

2. **`src/components/floor-plan/FloorPlanMarkup.tsx`** (MODIFIED)
   - Added `viewMode` state: `'browser' | 'editor'`
   - Default to `'browser'` mode
   - NO auto-load of layouts on mount (stays in browser)
   - Handlers for selecting layout, creating new design, loading PDF from browser

3. **`src/components/floor-plan/components/Toolbar.tsx`** (MODIFIED)
   - Added `onBackToBrowser` prop
   - Added "Back to Designs" button at top of toolbar

## User Flow

1. User navigates to PV Layout tab → Sees file browser with all layouts
2. User can:
   - Click a layout card → Loads that layout and switches to editor
   - Click "+ New Design" → Creates blank layout and switches to editor
   - Click "Load PDF File" → Opens modal and switches to editor
3. In editor mode, user clicks "Back to Designs" to return to browser
