

## Fix: Load Profile Shows Zero When Tenants Have area_sqm = 0

### Problem
All tenants in this project have `area_sqm = 0`. The load profile calculation in `useLoadProfileData.ts` has early-return guards (`if (tenantArea <= 0) return;`) at two locations (lines 198 and 273) that skip every tenant entirely -- even those with valid SCADA profiles assigned. The chart shows 0 kW because no tenant data is ever processed.

### Root Cause
The code was designed around area-based scaling (kW/m2 intensity), but when a tenant has a directly assigned SCADA profile, the raw kW values from that profile should be used as-is without requiring area data.

### Fix

**File: `src/components/projects/load-profile/hooks/useLoadProfileData.ts`**

At both guard locations (lines 197-198 in the daily kWh calculation, and lines 272-273 in the chart data calculation), change the logic so that:

1. If `tenantArea <= 0` **and** the tenant has no SCADA data (no `scada_imports` and no `tenant_meters` with profiles), skip the tenant (no data to show).
2. If `tenantArea <= 0` **but** the tenant has SCADA data assigned, use the raw kW values directly from the SCADA profile without area scaling.

**Specific changes:**

**Location 1 -- Daily kWh totals (around line 196-248):**
- Remove the blanket `if (tenantArea <= 0) return;` guard.
- In the multi-meter branch: skip if `tenantArea <= 0` (multi-meter averaging requires area).
- In the single SCADA branch: when `tenantArea <= 0`, use raw kW values directly (sum profile = daily kWh) instead of scaling by area ratio.
- In the shop type fallback branch: skip if `tenantArea <= 0` (estimation requires area).

**Location 2 -- Chart data / baseChartData (around line 271-314):**
- Remove the blanket `if (tenantArea <= 0) return;` guard.
- In the multi-meter branch: skip if `tenantArea <= 0`.
- In the single SCADA branch: when `tenantArea <= 0`, use raw kW values directly (`hourlyKw = scadaProfile[h] * dayMultiplier`) with `areaScale = 1`.
- In the shop type fallback branch: skip if `tenantArea <= 0`.

### Technical Detail

The key insight: when a SCADA profile is directly assigned to a tenant (via `scada_import_id`), the profile already contains actual kW readings from that specific meter. Area scaling is only needed when you're adapting a profile from a differently-sized reference facility. When `area_sqm = 0`, we treat it as "use the raw SCADA data as-is" rather than "this tenant has no load".

### Files Modified
- `src/components/projects/load-profile/hooks/useLoadProfileData.ts` -- remove blanket area guards, allow SCADA data pass-through for zero-area tenants

