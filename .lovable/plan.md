

# Add Vertical Dashed Tick Lines to TOU Hour Grid

## What
Replace the current horizontal dashed tick marks (on the hour-axis labels row) with **vertical dashed lines** that span the full height of each season's grid -- crossing through all three day-type rows (Weekday, Saturday, Sunday) and the label row at every 3-hour interval (0:00, 3:00, 6:00, ... 21:00).

## How

### File: `src/components/settings/TOUSettingsCard.tsx` -- `HourGrid` component

Restructure the grid to use a **CSS Grid with 24 columns** and overlay vertical dashed lines using `position: relative` on the grid container and absolutely-positioned pseudo-elements or thin divider elements at every 3rd column.

Specifically:

1. **Wrap the entire grid** (all 3 day-type rows + the hour-axis labels) in a single `relative` container.

2. **Overlay vertical tick lines**: Render 8 thin absolutely-positioned `div` elements (at columns 0, 3, 6, 9, 12, 15, 18, 21) that span the full height of the container. Each line uses a dashed border-left style: `border-left: 1px dashed` with `border-muted-foreground/30` colour. They are positioned using `left: calc((h / 24) * 100%)` and `top: 0; bottom: 0`.

3. **Remove the existing `border-t border-dashed`** from the hour-axis label cells since the vertical lines now provide the alignment cues.

4. Keep the hour-axis label text (`0:00`, `3:00`, etc.) positioned below each vertical line for readability.

This is a CSS/layout-only change within the `HourGrid` component -- no logic or state changes required.

