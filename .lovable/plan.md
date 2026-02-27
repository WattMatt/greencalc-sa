

# Minimize White Space Between Profile Chart Bars

## What Changes
Reduce the `barCategoryGap` from `"5%"` to `"1%"` across all 5 simulation profile charts. This tightens the spacing between bars so they fill more of the available chart width, matching the dense bar style shown in the reference image.

## Files to Update

All changes are identical -- replace `barCategoryGap="5%"` with `barCategoryGap="1%"`:

1. **`src/components/projects/load-profile/charts/LoadChart.tsx`** (line 39)
2. **`src/components/projects/load-profile/charts/BuildingProfileChart.tsx`** (line 69)
3. **`src/components/projects/load-profile/charts/GridFlowChart.tsx`** (line 45)
4. **`src/components/projects/load-profile/charts/SolarChart.tsx`** (line 139)
5. **`src/components/projects/load-profile/charts/BatteryChart.tsx`** (line 48)

No structural or logic changes required -- purely a visual spacing adjustment.

