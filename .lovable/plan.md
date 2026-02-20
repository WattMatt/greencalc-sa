

## Fix: Store Pre-Processed Data Points Instead of Raw CSV

### Problem

When you upload a CSV through the bulk upload wizard and manually configure columns (date, time, float), your configuration is **completely thrown away** at the storage step. Here is the chain of what happens:

1. You configure columns in the wizard (date, time, float) -- this works correctly
2. The wizard passes results to `TenantManager.handleWizardComplete`
3. That function **ignores your column selections** and stores the raw CSV string:
   ```
   raw_data: [{ csvContent: result.rawContent }]
   ```
4. When displaying the data, the hooks find `csvContent` and try to auto-detect columns from scratch
5. The auto-detection fails because it does not recognise "From" as a date header
6. Result: "No data available"

Your manual configuration is used to generate the load profile averages (weekday/weekend), but the raw data for graphs is stored as an unprocessed CSV dump.

### Solution

Replace the raw CSV storage with pre-processed `[{timestamp, value}]` arrays that use the column selections from the wizard. Also fix the legacy fallback parser as a safety net for any old data.

### Changes

#### 1. `src/components/projects/TenantManager.tsx` (lines 686-689)

Instead of storing `[{ csvContent: rawCSV }]`, build data points from the parsed rows using the user's configured columns:

```
// BEFORE:
const rawData = result.rawContent
  ? [{ csvContent: result.rawContent }]
  : null;

// AFTER:
// Find the date, time, and value columns from the user's configuration
const dateColIdx = result.columns.findIndex(c =>
  c.dataType === 'DateTime' ||
  c.originalName.toLowerCase().includes('date') ||
  c.originalName.toLowerCase() === 'from' ||
  c.originalName.toLowerCase() === 'time'
);
const timeColIdx = result.columns.findIndex((c, i) =>
  i !== dateColIdx && (
    c.originalName.toLowerCase().includes('time') ||
    c.originalName.toLowerCase() === 'to'
  )
);
const valueColIdx = result.columns.findIndex(c =>
  c.dataType === 'Float' || c.dataType === 'Int' ||
  c.originalName.toLowerCase().includes('kwh') ||
  c.originalName.toLowerCase().includes('kw')
);

const rawData = (dateColIdx >= 0 && valueColIdx >= 0)
  ? result.rows.map(row => ({
      timestamp: `${row[dateColIdx] || ''} ${timeColIdx >= 0 ? (row[timeColIdx] || '') : ''}`.trim(),
      value: parseFloat(row[valueColIdx]?.replace(/[^\d.-]/g, '') || '0') || 0
    })).filter(d => d.timestamp)
  : result.rawContent ? [{ csvContent: result.rawContent }] : null;
```

This means when you set a column as "DateTime" and another as "Float", those exact selections determine what gets stored.

#### 2. `src/components/loadprofiles/hooks/useDailyConsumption.ts` (line 147)

Safety net -- add `h === 'from'` to date column detection in the legacy fallback parser:

```
const dateCol = headers.findIndex(h => 
  h.includes('date') || h === 'timestamp' || h === 'time' || h.includes('rdate') || h === 'from'
);
```

#### 3. `src/components/loadprofiles/hooks/useMonthlyConsumption.ts` (lines 104-110)

Safety net -- fix header scanning and add `h === 'from'`:

```
// Replace naive header scanning with keyword-based search
let headerIdx = -1;
for (let i = 0; i < Math.min(lines.length, 10); i++) {
  const line = lines[i].toLowerCase();
  if (line.includes('time') || line.includes('date') || line.includes('rdate') || 
      line.includes('kwh') || line.includes('timestamp') || line.includes('from')) {
    headerIdx = i;
    break;
  }
}
if (headerIdx === -1) return [];
```

And add `h === 'from'` to the dateCol detection.

### Files to Modify

| File | Change |
|------|--------|
| `src/components/projects/TenantManager.tsx` | Use user's column config to store `[{timestamp, value}]` instead of `csvContent` |
| `src/components/loadprofiles/hooks/useDailyConsumption.ts` | Add `'from'` to date column detection (safety net for old data) |
| `src/components/loadprofiles/hooks/useMonthlyConsumption.ts` | Fix header scanning and add `'from'` to date column detection (safety net for old data) |

### Impact

- **New uploads**: Your manual column configuration will be honoured. Data is stored pre-processed and never re-parsed.
- **Existing uploads** (e.g. "Mamalia Bulk 2"): The legacy parser fix ensures they display correctly without needing to re-import.
- **No re-import required** for old data thanks to the fallback fix.

