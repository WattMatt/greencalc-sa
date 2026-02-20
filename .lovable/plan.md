

## Fix: ISO DateTime Format Not Recognised by Parser

### Root Cause

The `cellDates: true` fix from the previous change correctly converts Excel serial numbers into proper dates. However, the XLSX library outputs them in ISO 8601 format: `2024-12-31T23:30:00.000Z`.

The `parseDateTime` function (line 140 of `csvToLoadProfile.ts`) uses this regex:

```text
/^(\d{1,4})[-\/](\d{1,2})[-\/](\d{1,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/
```

The `\s+` between the date and time parts only matches whitespace. The ISO `T` separator is not matched, so all 50 rows fail and the parser returns an empty profile.

### Fix

**File: `src/components/loadprofiles/utils/csvToLoadProfile.ts`** -- `parseDateTime` function (line 140)

1. Update the combined datetime regex to also accept `T` as a separator between date and time (in addition to whitespace).
2. Also handle the trailing `Z` or timezone offset that ISO strings may include.

Change the regex from:
```text
/^(\d{1,4})[-\/](\d{1,2})[-\/](\d{1,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/
```

To:
```text
/^(\d{1,4})[-\/](\d{1,2})[-\/](\d{1,4})[\sT]+(\d{1,2}):(\d{2})(?::(\d{2}))?/
```

This is a single-character change (`\s+` becomes `[\sT]+`) that makes the parser accept both `2024-12-31 23:30:00` and `2024-12-31T23:30:00.000Z`.

### Files Modified
- `src/components/loadprofiles/utils/csvToLoadProfile.ts` -- one regex update on line 140

