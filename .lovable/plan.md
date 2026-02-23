
## Add Tooltip with Navigation Link to Stacked Meter Legend

### Overview
Each tenant label in the "By Meter" legend will get a tooltip saying "View in Tenants tab". Clicking the tooltip (or a small link icon) will navigate the user to the Tenants tab where that meter's data is managed.

### Changes

**1. `src/components/projects/load-profile/charts/StackedMeterChart.tsx`**
- Accept a new optional prop: `onNavigateToTenant?: (tenantId: string) => void`
- Wrap each legend button in a `Tooltip` (from shadcn/ui) that shows "Click to view in Tenants tab"
- Add a right-click or secondary action: left-click still toggles visibility, but the tooltip will contain a small clickable link/icon (e.g. an ExternalLink icon) that calls `onNavigateToTenant(tk.id)`
- Alternative simpler UX: double-click navigates, single-click toggles. Or: add a small arrow icon next to each label that navigates on click, while the label itself still toggles.
- Recommended approach: Add a `TooltipProvider` + `Tooltip` around each legend item. The tooltip content includes the tenant name and a "Go to Tenants" link button. Single-click on the label still toggles visibility. The tooltip's link button triggers navigation.

**2. `src/components/projects/load-profile/charts/LoadEnvelopeChart.tsx`**
- Accept and pass through `onNavigateToTenant` prop to `StackedMeterChart`

**3. `src/components/projects/load-profile/index.tsx`**
- Accept and pass through `onNavigateToTenant` prop to `LoadEnvelopeChart`

**4. `src/pages/ProjectDetail.tsx`**
- Pass `onNavigateToTenant` to `LoadProfileChart` that calls `setActiveTab("tenants")` (and optionally scrolls/highlights the tenant row)

### Technical Details

The legend item interaction model:
- **Single click**: Toggles meter visibility (existing behaviour, preserved)
- **Tooltip on hover**: Shows tenant name + a small "Go to Tenants" link
- **Click the link in the tooltip**: Navigates to the Tenants tab

Props threaded through the component chain:
```
ProjectDetail (setActiveTab) 
  -> LoadProfileChart (onNavigateToTenant)
    -> LoadEnvelopeChart (onNavigateToTenant)
      -> StackedMeterChart (onNavigateToTenant)
```

The tooltip will use the existing shadcn `Tooltip` component (`@/components/ui/tooltip`) and a small `ExternalLink` or `ArrowRight` icon from `lucide-react` to indicate it is a navigation action.
