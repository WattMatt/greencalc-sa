
# Smart Profile Suggestions for Tenant Load Profile Assignment

## Overview
Enhance the Load Profile dropdown in the tenant table to show intelligent suggestions based on tenant name matching first, with the option to toggle to area-based sorting instead.

## Current Behavior
- The dropdown shows all profiles sorted by area similarity to the tenant
- No name-based matching or suggestions are provided
- Users must manually search through all profiles to find relevant ones

## Proposed Solution

### User Experience
When opening the Load Profile dropdown for a tenant:
1. **Default: Name-Based Suggestions** - Profiles are sorted with best name matches at the top
   - Exact name matches shown first with a "Suggested" badge
   - Fuzzy/partial matches shown next with a "Similar" badge
   - Remaining profiles sorted by area similarity
2. **Toggle Option** - A button/toggle at the top of the dropdown to "Sort by Area" instead
   - When enabled, all profiles are sorted purely by area similarity (closest match first)
3. **Visual Indicators** - Suggested profiles are highlighted with colored badges showing match confidence

### Implementation Details

#### File: `src/components/projects/TenantManager.tsx`

**1. Create a profile matching helper function:**
```tsx
// Match tenant name to profiles and calculate confidence scores
function getProfileSuggestions(tenantName: string, profiles: ScadaImport[]) {
  const normalizedTenant = tenantName.toLowerCase().trim();
  
  return profiles.map(profile => {
    const shopName = profile.shop_name?.toLowerCase() || '';
    const meterLabel = profile.meter_label?.toLowerCase() || '';
    
    // Exact match
    if (shopName === normalizedTenant || meterLabel === normalizedTenant) {
      return { profile, matchType: 'exact' as const, score: 100 };
    }
    
    // Contains match (either direction)
    if (shopName.includes(normalizedTenant) || normalizedTenant.includes(shopName) ||
        meterLabel.includes(normalizedTenant) || normalizedTenant.includes(meterLabel)) {
      const longerLen = Math.max(shopName.length || 0, normalizedTenant.length);
      const shorterLen = Math.min(shopName.length || 0, normalizedTenant.length);
      return { profile, matchType: 'similar' as const, score: 60 + (shorterLen / longerLen) * 30 };
    }
    
    // No name match
    return { profile, matchType: 'none' as const, score: 0 };
  });
}
```

**2. Create a sorted profiles function with mode:**
```tsx
function getSortedProfilesWithSuggestions(
  tenantName: string, 
  tenantArea: number, 
  profiles: ScadaImport[], 
  sortByArea: boolean
) {
  if (sortByArea) {
    // Pure area-based sorting
    return profiles
      .map(p => ({ profile: p, matchType: 'none' as const, score: 0 }))
      .sort((a, b) => getAreaDifference(a.profile.area_sqm, tenantArea) - getAreaDifference(b.profile.area_sqm, tenantArea));
  }
  
  // Name-based with area as tiebreaker
  const suggestions = getProfileSuggestions(tenantName, profiles);
  return suggestions.sort((a, b) => {
    // Primary: match score (highest first)
    if (a.score !== b.score) return b.score - a.score;
    // Secondary: area similarity
    return getAreaDifference(a.profile.area_sqm, tenantArea) - getAreaDifference(b.profile.area_sqm, tenantArea);
  });
}
```

**3. Add state for sort mode toggle per tenant:**
```tsx
const [sortByAreaMap, setSortByAreaMap] = useState<Record<string, boolean>>({});
```

**4. Update the dropdown UI:**
- Add a toggle button at the top of the Command component: "By Name" | "By Area"
- Show badges on CommandItems: "Suggested" (green) for exact matches, "Similar" (amber) for fuzzy matches
- Display match type alongside the profile label

```tsx
<PopoverContent className="w-[340px] p-0" align="start">
  <div className="flex items-center justify-between px-3 py-2 border-b">
    <span className="text-xs text-muted-foreground">Sort by:</span>
    <div className="flex gap-1">
      <Button 
        variant={sortByArea ? "ghost" : "secondary"} 
        size="sm" 
        className="h-6 text-xs"
        onClick={() => setSortByAreaMap(prev => ({ ...prev, [tenant.id]: false }))}
      >
        Name
      </Button>
      <Button 
        variant={sortByArea ? "secondary" : "ghost"} 
        size="sm" 
        className="h-6 text-xs"
        onClick={() => setSortByAreaMap(prev => ({ ...prev, [tenant.id]: true }))}
      >
        Area
      </Button>
    </div>
  </div>
  <Command>
    <CommandInput placeholder="Search profiles..." />
    <CommandList>
      <CommandEmpty>No profile found.</CommandEmpty>
      <CommandGroup>
        {sortedSuggestions.map(({ profile, matchType }) => (
          <CommandItem key={profile.id} ...>
            <Check className={...} />
            <div className="flex items-center gap-2 flex-1">
              {formatProfileOption(profile)}
              {matchType === 'exact' && (
                <Badge className="bg-green-100 text-green-700 text-[10px]">Suggested</Badge>
              )}
              {matchType === 'similar' && (
                <Badge variant="secondary" className="text-[10px]">Similar</Badge>
              )}
            </div>
          </CommandItem>
        ))}
      </CommandGroup>
    </CommandList>
  </Command>
</PopoverContent>
```

## Technical Summary

| Change | Description |
|--------|-------------|
| New helper function | `getProfileSuggestions()` - matches tenant name against profile shop_name/meter_label |
| New helper function | `getSortedProfilesWithSuggestions()` - sorts profiles by name match or area |
| New state | `sortByAreaMap` - tracks sort preference per tenant |
| UI enhancement | Toggle buttons for "Name" vs "Area" sorting in dropdown header |
| UI enhancement | "Suggested" (green) and "Similar" (amber) badges on matching profiles |

## Files to Modify
- `src/components/projects/TenantManager.tsx` - Add matching logic and updated dropdown UI

## Benefits
- Users immediately see the most relevant profile suggestions based on tenant name
- Clear visual distinction between exact matches, similar matches, and other options
- Easy toggle to switch to area-based sorting when name matching isn't useful
- Maintains existing searchability within the dropdown
