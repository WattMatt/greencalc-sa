

# Plan: Load Profile Data Inspector

Add a collapsible "Data Inspector" panel below the Load Envelope chart inside the existing Load Profile tab. This shows the actual processed data powering the charts — per-tenant, per-date, hourly kW values — directly in context within the project.

## What it shows

1. **Summary bar** — Total validated dates, tenants with SCADA data, estimated tenants, outlier count, available year range
2. **Site-level table** — Rows = validated dates, Columns = hours 00–23, values = site-total kW. Sortable by date or peak hour. Colour-coded cells (heatmap style) for quick visual scanning.
3. **Per-tenant breakdown** — Select a tenant from a dropdown to see their individual hourly kW arrays per date
4. **Raw data sample** — For any tenant/date, click to see the underlying `raw_data` entries (the normalised `{date, time, value}` points) in a dialog
5. **Format verification badge** — Shows whether raw_data is in normalised format or legacy format per meter

## New files

| File | Purpose |
|------|---------|
| `src/components/projects/load-profile/components/DataInspector.tsx` | Main collapsible panel with tabs: Site Data, Per-Tenant, Raw Sample |

## Edited files

| File | Change |
|------|--------|
| `src/components/projects/load-profile/index.tsx` | Add a toggle button in ChartHeader area and render `<DataInspector>` below the charts, passing `validatedSiteData`, `rawDataMap`, and `tenants` |

## Technical details

- **DataInspector** receives `ValidatedSiteData` (already computed) and `RawDataMap` — no extra DB queries needed
- Site-level table iterates `siteDataByDate` entries; per-tenant table iterates `tenantDateMaps.get(tenantId)`
- Heatmap cell colouring: interpolate background from white (0 kW) to blue (peak kW) using inline styles
- Raw sample dialog: for a selected tenant + date, pull entries from `rawDataMap[scadaImportId].raw_data` filtered to that date
- Row limit selector (25/50/100/All) to avoid rendering thousands of rows
- CSV export button for the currently visible table

