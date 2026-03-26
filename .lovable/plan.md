

## Fix Build Errors

There are 3 categories of build errors preventing the app from loading:

### 1. `TariffList.tsx` — `eskomMuni` used before declaration (line 251)
The `useEffect` referencing `eskomMuni` was added at line 232, but `eskomMuni` is declared at line 430. **Fix**: Move the `useEffect` block to after the `eskomMuni` declaration (~after line 438).

### 2. `ProjectLocationMap.tsx` — `updateMarker` used before declaration (line 241)
`geocodeLocation` callback references `updateMarker` in its dependency array at line 241, but `updateMarker` is declared at line 299. **Fix**: Move `updateMarker` declaration before `geocodeLocation`, or remove it from the dependency array and use a ref pattern.

### 3. `organization_members` / `organizations` tables missing from Supabase types
Multiple files (`useUserRole.ts`, `useOrganizationBranding.ts`, `OrgMembersList.tsx`, `AcceptInvite.tsx`) query these tables, but they're not in the auto-generated `types.ts`. Since we cannot edit `types.ts` directly, **fix** by casting through `.from("organization_members" as any)` in each affected query call. This suppresses the type errors while keeping runtime behavior correct.

### Files to modify
1. **`src/components/tariffs/TariffList.tsx`** — Move the Eskom auto-load `useEffect` after `eskomMuni` declaration
2. **`src/components/projects/ProjectLocationMap.tsx`** — Reorder `updateMarker` before `geocodeLocation`
3. **`src/hooks/useUserRole.ts`** — Cast table names with `as any` (3 `.from()` calls)
4. **`src/hooks/useOrganizationBranding.ts`** — Cast `"organization_members" as any`
5. **`src/components/settings/OrgMembersList.tsx`** — Cast `"organization_members" as any`
6. **`src/pages/AcceptInvite.tsx`** — Cast `"organization_members" as any`

