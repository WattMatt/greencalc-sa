

# Fix CSV Parser for Quoted SCADA Files

## Root Cause

The CSV file has all values wrapped in double quotes:
- Row 1: `"pnpscada.com", "36506661"`
- Row 2: `"P1 (per kW)", "Q1 (per kvar)", ..., "DATE", "TIME", "STATUS"`

The parser splits by comma and trims whitespace, but never removes the surrounding quotes. So:
- `"pnpscada.com"` (with quotes) doesn't match `.includes("pnpscada")` -- actually it does since the quotes are part of the string. But `"DATE"` won't match `/^date$/i` because the string is `"date"` (with literal quote characters).
- The column header `P1 (per kW)` has a `1` which the regex `/p\s*\(per\s*kw\)/i` doesn't account for.

## Changes

### File: `src/components/projects/generation/csvUtils.ts`

1. **Strip quotes from all parsed values**: After splitting each line by comma, strip surrounding double quotes from every cell (in addition to trimming whitespace). Apply this to headers, date values, time values, and numeric values.

2. **Update the SCADA value column regex** to also match headers like `P1 (per kW)`, `P2 (per kW)`, etc. Change the fallback pattern from:
   - `/p\s*\(per\s*kw\)/i` 
   - to `/p\d*\s*\(per\s*kw\)/i`

   This allows an optional digit after "P".

3. **Apply quote stripping universally** by adding a small helper:
   ```
   function stripQuotes(s: string): string {
     return s.replace(/^"|"$/g, "").trim();
   }
   ```
   Use it when processing header arrays and data cells.

### Files: `ActualGenerationCard.tsx` and `BuildingLoadCard.tsx`

Update the regex patterns passed to `parseCSVFiles` to include the `p1` variant:
- ActualGenerationCard: `/kwh|energy|generation|actual|p\d*\s*\(per\s*kw\)/i`
- BuildingLoadCard: `/kwh|energy|load|consumption|building|p\d*\s*\(per\s*kw\)/i`

### No database changes needed.

