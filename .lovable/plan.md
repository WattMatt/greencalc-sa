

## Fix: Auto-Match Should Extract Numbers from Profile Names

### Problem
The SCADA import is named "AC Shop 2" with **no `shop_number` field**. All tenants are named "AC Shop" with different shop numbers (2, 18, 30, etc.). The current logic only compares `tenant.shop_number` against `profile.shop_number` -- but the profile's `shop_number` is null. It falls through to the fuzzy name matcher, which gives **equal scores to all "AC Shop" tenants** since they all substring-match "AC Shop 2". The greedy sort then arbitrarily picks shop 30 instead of shop 2.

### Fix

**File: `src/components/projects/TenantManager.tsx` -- `autoMatchProfiles` function (around line 465)**

Add a new matching step: when the profile has no explicit `shop_number`, extract trailing numbers from the profile's `shop_name` or `site_name` and compare them against the tenant's `shop_number`.

The logic (inserted right after the existing `shop_number` check at line 476, before the `getProfileSuggestions` fallback):

```typescript
// If profile has no shop_number, try extracting a number from the profile name
// e.g. "AC Shop 2" -> "2", "Shop 23A" -> "23A"
if (score === 0 && tenant.shop_number) {
  const profileLabel = profile.shop_name || profile.site_name || '';
  // Extract trailing number/alphanumeric identifier from profile name
  const profileTrailingMatch = profileLabel.match(/[\s_\-](\d+[A-Za-z]?)$/);
  if (profileTrailingMatch) {
    const extractedId = profileTrailingMatch[1];
    const tenantShopTrimmed = tenant.shop_number.trim();
    // Exact string match (case-insensitive)
    if (extractedId.toLowerCase() === tenantShopTrimmed.toLowerCase()) {
      score = 93; // High confidence, slightly below explicit shop_number match
    } else {
      // Try numeric comparison (e.g. "2" == "2.0")
      const extractedNum = parseFloat(extractedId);
      const tenantNum = parseFloat(tenantShopTrimmed);
      if (!isNaN(extractedNum) && !isNaN(tenantNum) && extractedNum === tenantNum) {
        score = 93;
      }
    }
  }
}
```

This ensures "AC Shop 2" matches tenant with `shop_number = "2"` at score 93, while "AC Shop 30" would only match tenant `shop_number = "30"`.

### Files Modified
- `src/components/projects/TenantManager.tsx` -- add number-extraction matching step in `autoMatchProfiles`

