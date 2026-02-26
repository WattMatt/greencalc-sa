

# Always Show All Provinces and Municipalities (Placeholders)

## Problem
The Tariff List currently hides provinces and municipalities that have no tariffs. Since provinces and Eskom are permanent fixtures, they should always appear as accordion items -- acting as placeholders until tariffs are uploaded.

## Changes

### File: `src/components/tariffs/TariffList.tsx`

**1. Remove municipality filter that hides empty ones (line 394)**

Currently: `muniList.filter(m => m.tariffCount > 0)` -- this excludes municipalities with 0 tariffs.

Change to: Remove the `.filter(m => m.tariffCount > 0)` so all municipalities under each province are listed.

**2. Remove province guard that hides empty provinces (line 402)**

Currently: `if (municipalityList.length > 0)` -- this skips provinces with no municipalities that have tariffs.

Change to: Always push the province into the result, even if it has no municipalities with tariffs. Since all provinces have municipalities pre-populated, this guard is redundant once the municipality filter is removed.

**3. Remove early return when no tariffs exist (lines 475-485)**

Currently: When `totalTariffCount` is 0, a "No tariffs configured" message is shown and the accordion is never rendered.

Change to: Remove this early return so the province/municipality accordion always renders. The header will show "0 tariffs across 10 provinces" and each municipality will simply show "0 tariffs" until data is uploaded.

**4. Show "No tariffs" message inside empty municipality accordions**

When a municipality accordion is expanded and has 0 tariffs, show a subtle placeholder message like "No tariffs uploaded yet" instead of an empty space.

## Result
- All 10 provinces (9 SA provinces + Eskom) always visible as collapsed accordions
- All municipalities under each province always visible
- Provinces/municipalities with no tariffs show "0 tariffs" in their badges
- Expanding an empty municipality shows a placeholder message

