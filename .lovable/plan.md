
## Add Outlier Detection to SCADA Data Validation

### Problem
Individual tenant meters can have faulty readings (e.g., stuck meters reporting 1,200 kW flat for an entire day). These single-day anomalies inflate the envelope "Max" line and distort averages.

### Approach: Per-Tenant IQR-Based Outlier Removal

Outlier detection will be applied **per tenant** in `useValidatedSiteData.ts` (Pass 2.5, between building per-tenant date maps and computing site-level totals). This catches bad data at the source before it propagates.

**Algorithm:**
1. For each tenant, compute the **median daily total kWh** across all their dates
2. Compute the **IQR** (interquartile range) of daily totals
3. Flag any date where the daily total exceeds **Q3 + 3x IQR** as an outlier (a generous threshold to only catch truly anomalous days like the 1,200 kW spike)
4. Remove flagged dates from that tenant's date map
5. Expose an `outlierCount` in the return value so the UI can inform the user

### File Changes

**1. Edit: `src/components/projects/load-profile/hooks/useValidatedSiteData.ts`**
- After Pass 1 (building per-tenant date maps), add a new **Pass 1.5: Outlier Removal**
- For each tenant in `tenantDateMaps`:
  - Collect daily totals (sum of 24 hourly values) for all dates
  - Sort and compute Q1, Q3, IQR
  - Calculate upper fence = Q3 + 3 * IQR
  - Delete any date entry where the daily total exceeds the upper fence
- Track total outlier dates removed across all tenants
- Add `outlierCount: number` to the `ValidatedSiteData` interface and return value

**2. Edit: `src/components/projects/load-profile/index.tsx`**
- Destructure `outlierCount` from `useValidatedSiteData`
- Display a small info badge near the chart header when outliers were removed (e.g., "2 outlier days excluded")

### Technical Detail

```text
Per-tenant outlier detection (IQR method):

  dailyTotals = [sum of 24h for each date]
  sorted = dailyTotals.sort()
  Q1 = sorted[25th percentile]
  Q3 = sorted[75th percentile]
  IQR = Q3 - Q1
  upperFence = Q3 + 3 * IQR

  If dailyTotal > upperFence --> remove that date for this tenant
```

The 3x IQR multiplier is deliberately generous -- it will only catch extreme spikes (like a 1,200 kW reading on a 20 kW meter) while preserving normal seasonal variation.

### What Stays the Same
- All downstream hooks (`useLoadProfileData`, `useEnvelopeData`) are unaffected -- they consume the already-cleaned `siteDataByDate`
- The site-level outage threshold (75 kW) remains as a separate filter
- Chart components, export handlers, and PV/battery logic are untouched
