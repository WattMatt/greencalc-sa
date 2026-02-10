

# Update CSV Parser for PnP SCADA Format

## What Changes

The CSV parser needs to understand the PnP SCADA file format, where:
- Row 1 is metadata (contains "pnpscada.com" and a meter number) -- skip it
- Row 2 is the header row with columns like "P (per kW)", "DATE", "TIME", "STATUS"
- Row 3 onward contains half-hourly power readings in kW (not kWh)

The parser currently expects a simple "month" + "kWh" format, which won't work with these files.

## How It Will Work

1. **Detect format**: Check if row 1 contains "pnpscada.com" -- if so, treat row 2 as headers and row 3+ as data
2. **Find columns**: Locate the "DATE" column and the power value column (e.g., "P (per kW)") using the provided regex pattern
3. **Convert kW to kWh**: Detect the time interval between readings (30 minutes = 0.5 hours) and multiply each kW value by 0.5 to get kWh
4. **Group by month**: Extract the month from the DATE column (e.g., 2026-01-15 = month 1) and sum all kWh values per month
5. **Fallback**: If the file doesn't match the SCADA format, fall back to the existing simple "month + kWh" parsing

The simple format (month column with direct kWh values) will continue to work as before.

## Technical Details

### File: `src/components/projects/generation/csvUtils.ts`

Rewrite `parseCSVFiles` to handle both formats:

```text
For each file:
  1. Read lines
  2. If line 0 contains "pnpscada" -> SCADA format:
     a. Use line 1 as headers
     b. Find DATE column and value column (matching provided regex or "p (per kw)")
     c. Find TIME column to calculate interval (default 0.5 hours for 30-min data)
     d. For each data row (line 2+):
        - Parse DATE to get month (1-12)
        - Multiply kW value by interval hours to get kWh
        - Add to month total
  3. Else -> simple format (existing logic):
     a. Use line 0 as headers
     b. Find "month" and value columns
     c. Sum direct kWh values per month
```

### File: `src/components/projects/generation/ActualGenerationCard.tsx`

Update the regex pattern passed to `parseCSVFiles` to also match SCADA power headers:
- Pattern: `/kwh|energy|generation|actual|p \(per kw\)/i`

### File: `src/components/projects/generation/BuildingLoadCard.tsx`

Same regex update:
- Pattern: `/kwh|energy|load|consumption|building|p \(per kw\)/i`

### No database changes required.

