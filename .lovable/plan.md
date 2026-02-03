
# Fix: PnP SCADA Header Detection in OneClickBatchProcessor

## Problem Summary
The batch processor fails to parse PnP SCADA CSV files because the header detection logic doesn't recognize the newer PnP SCADA format. This causes empty load profiles with the error message "Empty profile - check column mapping".

## Root Cause Analysis
Looking at the console logs:
```
[processCSV] Headers: ["pnpscada.com", "36791889"]
[processCSV] Missing required columns. Date: -1, kWh: 0
```

The PnP SCADA detection in `autoParseCSV` expects:
```
"MeterName",2024-01-01,2024-12-31
rdate,rtime,kwh,...
```

But the actual format is:
```
pnpscada.com,36791889
Time,P1 (kWh),Q1 (kvarh),...
```

The regex `^,?"([^"]+)"?,(\d{4}-\d{2}-\d{2}),(\d{4}-\d{2}-\d{2})` doesn't match this pattern, so `startRow` stays at 1 instead of 2.

## Solution

Update the `autoParseCSV` function in `OneClickBatchProcessor.tsx` to use a smarter header detection approach similar to what was added to `ColumnSelectionDialog.tsx` and `useDailyConsumption.ts`:

1. **Add header keyword validation** - Scan the first 10 lines to find the actual header row containing keywords like "time", "date", "kwh", "p1", etc.

2. **Skip metadata rows** - Any row that doesn't contain valid header keywords should be skipped (e.g., `pnpscada.com,36791889`)

3. **Improve PnP SCADA detection** - Recognize the domain-based format (`pnpscada.com` or `scada.com` in first line) as a trigger to look for headers in subsequent rows

---

## Technical Implementation

### File: `src/components/loadprofiles/OneClickBatchProcessor.tsx`

**Changes to `autoParseCSV` function (around lines 114-196):**

```text
1. Add header keyword list (after line 127):
   const headerKeywords = ['time', 'date', 'rdate', 'rtime', 'kwh', 'kw', 
     'power', 'energy', 'value', 'p1', 'p14', 'active', 'timestamp'];

2. Add header validation helper:
   const isValidHeaderRow = (line: string): boolean => {
     const lowerLine = line.toLowerCase();
     return headerKeywords.some(kw => lowerLine.includes(kw));
   };

3. Replace the current PnP SCADA detection (lines 129-141) with:
   - Check if first line contains "pnpscada" or "scada.com" → mark as PnP format
   - Scan through initial lines until finding one with valid header keywords
   - Set startRow to headerIndex + 1 (for data rows)

4. Update headerIdx calculation (lines 194-196):
   - Use the new dynamic header detection instead of fixed startRow - 1
```

**Specific code replacement:**

Replace lines 129-141 with logic that:
```typescript
// Detect PnP SCADA format by checking for domain in first line
const firstLineLower = lines[0]?.toLowerCase() || "";
const isPnPScada = firstLineLower.includes('pnpscada') || 
                   firstLineLower.includes('scada.com');

// Find actual header row by scanning for valid column keywords
let headerRow = 0;
for (let i = 0; i < Math.min(lines.length, 10); i++) {
  if (isValidHeaderRow(lines[i])) {
    headerRow = i;
    break;
  }
}

// If PnP format, try to extract meter name from first line
if (isPnPScada && headerRow > 0) {
  const parts = lines[0].split(',');
  meterName = parts[1]?.trim() || undefined;
  // Try to find date range in metadata
  const dateMatch = lines[0].match(/(\d{4}-\d{2}-\d{2})/g);
  if (dateMatch && dateMatch.length >= 2) {
    dateRange = { start: dateMatch[0], end: dateMatch[1] };
  }
}

const startRow = headerRow + 1;
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/loadprofiles/OneClickBatchProcessor.tsx` | Update `autoParseCSV` function with smart header detection |

## Expected Outcome

After this fix:
- Console will show: `[processCSV] Headers: ["Time", "P1 (kWh)", "Q1 (kvarh)", ...]`
- Column detection will find: `date=0, value=1`
- Load profiles will be correctly parsed and saved

## Testing Steps
1. Navigate to Load Profiles page
2. Select one or more meters with PnP SCADA data
3. Click the batch process button
4. Verify meters process successfully (green checkmarks)
5. Open a meter preview to confirm the load profile chart displays data
