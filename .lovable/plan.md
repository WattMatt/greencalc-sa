

## Fix: Support Text Month Date Formats ("01 Nov 2022 00:00")

### Root Cause

The uploaded Excel file (`AC_Shop_2.xlsx`) stores dates as **text strings** like:
```
01 Nov 2022 00:00
02 Nov 2022 01:00
```

The `cellDates: true` fix from the previous change only converts **numeric Excel date serial numbers** into readable dates. Text-based dates pass through unchanged.

The `parseDateTime` function in `csvToLoadProfile.ts` has two regex patterns, both expecting **numeric-only** date parts separated by `/` or `-`:

```text
/^(\d{1,4})[-\/](\d{1,2})[-\/](\d{1,4})[\sT]+...   -- fails on "01 Nov 2022"
/^(\d{1,4})[-\/](\d{1,2})[-\/](\d{1,4})/            -- fails on "01 Nov 2022"
```

Neither matches a 3-letter month abbreviation like "Nov", so all 50 rows are rejected.

### Fix

**File: `src/components/loadprofiles/utils/csvToLoadProfile.ts` -- `parseDateTime` function (around line 135)**

Add a new regex branch **before** the existing patterns to catch the "DD MMM YYYY HH:MM" format (and variations like "DD-MMM-YYYY HH:MM:SS"):

```text
Pattern: /^(\d{1,2})[\s\-\/]([A-Za-z]{3,9})[\s\-\/](\d{2,4})(?:[\sT]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/
```

This matches:
- `01 Nov 2022 00:00`
- `1-Nov-2022 00:00:00`
- `15 September 2023 14:30`

The month name is resolved using a lookup map (Jan=0, Feb=1, ..., Dec=11). Two-digit years are expanded (e.g. 22 becomes 2022).

### Technical Detail

The new code block to add inside `parseDateTime`, before the existing numeric-format regex:

```typescript
// Try "DD MMM YYYY HH:MM" or "DD-MMM-YYYY HH:MM:SS" (text month names)
const monthNames: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
};
const textMonthMatch = dateStr.match(
  /^(\d{1,2})[\s\-\/]([A-Za-z]{3,9})[\s\-\/](\d{2,4})(?:[\sT]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/
);
if (textMonthMatch) {
  const day = parseInt(textMonthMatch[1]);
  const monthKey = textMonthMatch[2].toLowerCase().substring(0, 3);
  const monthNum = monthNames[monthKey];
  let year = parseInt(textMonthMatch[3]);
  if (textMonthMatch[3].length === 2) year += year > 50 ? 1900 : 2000;

  if (monthNum !== undefined && day >= 1 && day <= 31) {
    const date = new Date(year, monthNum, day);
    if (!isNaN(date.getTime())) {
      const hour = textMonthMatch[4] ? parseInt(textMonthMatch[4]) : 0;
      const minute = textMonthMatch[5] ? parseInt(textMonthMatch[5]) : 0;
      return { date, hour, minute };
    }
  }
}
```

### Files Modified
- `src/components/loadprofiles/utils/csvToLoadProfile.ts` -- add text-month regex branch in `parseDateTime`

