

## Add Auto-Match Refresh Button to Tenant Table

### Overview
A small refresh icon will be added immediately to the right of the Load Profile toggle switch. Clicking it will automatically scan all unassigned tenants and match them to the best available SCADA profile based on the current toggle scope (global vs local).

### Matching Rules

**Global scope** (toggle off): For each unassigned tenant, find the SCADA import with the highest name-match confidence (using the existing `getProfileSuggestions` logic). Multiple tenants can share the same global profile, so no deduplication is needed -- just pick the best match per tenant.

**Local scope** (toggle on): Each local SCADA import (project-scoped) can only be assigned to **one** tenant. The matcher will greedily assign the highest-confidence matches first and remove used profiles from the pool to prevent double-assignment.

In both modes, only matches with a confidence score of 60 or above will be auto-assigned. Additionally, `shop_number` will be checked as a secondary match signal (exact match on `shop_number` yields a score of 95).

### UI Change
- Add a `RefreshCw` icon (from lucide-react) as a ghost button, placed right after the `</TooltipProvider>` inside the existing `<div className="flex items-center gap-3">` wrapper on the Load Profile header column.
- Wrapped in a Tooltip showing "Auto-match profiles to tenants".
- While running, the icon gets the `animate-spin` class.

### Technical Details

**File: `src/components/projects/TenantManager.tsx`**

1. **Import**: Add `RefreshCw` to the lucide-react import on line 10.
2. **State**: Add `const [autoMatching, setAutoMatching] = useState(false);`.
3. **Auto-match function** (`autoMatchProfiles`):
   - Filter tenants to only those with `scada_import_id === null`.
   - For each unassigned tenant, call `getProfileSuggestions(tenantName, availableProfiles)` and also check `shop_number` match.
   - Pick the top match with score >= 60.
   - **If local scope**: track used profile IDs and exclude them from subsequent matching (one-to-one).
   - **If global scope**: no deduplication needed (many-to-one is fine).
   - Batch-update all matched tenants via individual `supabase.from("project_tenants").update({ scada_import_id }).eq("id", tenantId)` calls.
   - Invalidate query cache and show a summary toast: "Auto-matched X of Y unassigned tenants".
4. **UI insertion** (around line 902): Add the refresh button right after the closing `</TooltipProvider>` tag, inside the existing flex wrapper.

### Files Modified
- `src/components/projects/TenantManager.tsx` -- add RefreshCw button, auto-match state, and matching logic

