
# Smooth Load Line on Building Profile Chart

## Change

In `src/components/projects/load-profile/charts/BuildingProfileChart.tsx`, line 143:

Change the `Line` component's `type` from `"stepAfter"` to `"monotone"` to produce a smooth, continuous curve matching the style used for SoC in the battery profile chart.

### Before
```tsx
<Line type="stepAfter" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Load" />
```

### After
```tsx
<Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Load" />
```

Single-line change, no other files affected.
