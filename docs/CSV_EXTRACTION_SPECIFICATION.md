# CSV Load Profile Extraction Specification

> **Version:** 1.0  
> **Last Updated:** 2026-01-15  
> **Repository:** docs/CSV_EXTRACTION_SPECIFICATION.md

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Format Detection](#format-detection)
4. [Column Detection](#column-detection)
5. [Delimiter Detection](#delimiter-detection)
6. [Date/Time Parsing](#datetime-parsing)
7. [Unit Conversion](#unit-conversion)
8. [Data Processing](#data-processing)
9. [Load Profile Generation](#load-profile-generation)
10. [Multi-Site / Multi-Meter Handling](#multi-site--multi-meter-handling)
11. [Edge Cases & Error Handling](#edge-cases--error-handling)
12. [Configuration Reference](#configuration-reference)

---

## Overview

This document defines the complete extraction rules for parsing CSV meter data into load profiles. The system supports:

- **Multiple sites** with hundreds of meters each
- **Various CSV formats** (PnP SCADA, generic, multi-meter, cumulative)
- **Different units** (kW, kWh, kVA, Amps, MW, etc.)
- **Flexible date formats** (ISO, DD/MM/YYYY, MM/DD/YYYY, DD-MMM-YY)
- **Interval data** from 1-minute to 4-hour resolution

---

## Architecture

The system uses a **two-tier processing architecture**:

### Client-Side (Browser)
**File:** `src/components/loadprofiles/utils/csvToLoadProfile.ts`

- Quick parsing for preview and small files (<10,000 rows)
- Format/delimiter auto-detection
- Column mapping UI
- Real-time preview during wizard configuration

### Server-Side (Edge Function)
**File:** `supabase/functions/process-scada-profile/index.ts`

- Large file processing (10,000+ rows)
- Multi-meter splitting
- Cumulative value calculations
- Complex aggregation and validation

---

## Format Detection

The system identifies the following formats:

### 1. PnP SCADA Format
**Detection Pattern:**
```
Line 1: ,"MeterName",2024-01-01,2024-12-31
Line 2: rdate,rtime,kwh,kva,status
Line 3+: 2024-01-01,00:00,123.45,130.50,OK
```

**Detection Rules:**
- First line matches: `^,?"([^"]+)"?,(\d{4}-\d{2}-\d{2}),(\d{4}-\d{2}-\d{2})`
- Second line contains: `rdate`, `rtime`, `kwh`
- Header row is set to **row 2**
- Confidence: **95%**

**Current Treatment:**
- Meter name extracted from first line
- Date range extracted from first line
- Headers parsed from row 2
- Data starts at row 3

### 2. Standard Format
**Detection:**
- First column is non-numeric (header row)
- Has identifiable date/value columns
- Values are interval readings (not cumulative)

**Current Treatment:**
- Header row auto-detected (first row with non-numeric first cell)
- Columns detected by header patterns

### 3. Multi-Meter Format
**Detection:**
- Contains a meter ID column with multiple unique values
- Column header matches: `meter`, `device`, `channel`, `point`

**Current Treatment:**
- Each meter processed separately
- Individual load profiles generated per meter
- Raw data stored with `meterId` field

### 4. Cumulative Format
**Detection:**
- 90%+ of consecutive readings are increasing
- Values represent total energy rather than interval consumption

**Current Treatment:**
- Delta calculated between consecutive readings
- Meter rollover handled (when current < previous)
- Delta formula: `current - previous` (or just `current` on rollover)

---

## Column Detection

### Priority Order (Highest to Lowest)

1. **Explicit Configuration** - User-selected columns in wizard Step 4
2. **Wizard Step 3 Settings** - Column type assignments
3. **Header Pattern Matching** - Automatic detection by column name
4. **Data Analysis** - Numeric/date pattern detection in sample rows

### Header Patterns

| Column Type | Detection Patterns |
|-------------|-------------------|
| **Date** | `rdate`, `date`, `datetime`, `timestamp`, `day`, `datum` |
| **Time** | `rtime`, `time`, `hour`, `zeit` |
| **Value** | `kwh+`, `kwh-`, `kwh`, `kw`, `energy`, `consumption`, `reading`, `value`, `power`, `load`, `demand`, `active` |
| **Meter ID** | `meter`, `meter_id`, `meterid`, `device`, `channel`, `point`, `site` |

### Data-Based Detection (Fallback)

When header patterns fail, the system analyzes sample data:

```typescript
For each column:
  - Count date patterns: /\d{1,4}[-\/]\d{1,2}[-\/]\d{1,4}/
  - Count numeric values
  - Check for variation (not all same value)
  - Calculate score: numericCount + (hasVariation ? 10 : 0) + (sum > 0 ? 5 : 0)
  
Highest-scoring column becomes value column
```

---

## Delimiter Detection

**Supported Delimiters:**
- Tab (`\t`)
- Semicolon (`;`)
- Comma (`,`)
- Pipe (`|`)
- Space (` `) - with consecutive grouping option

**Detection Method:**
```typescript
// Sample first 10 lines
// Count occurrences of each delimiter
// Select most common (minimum 1 occurrence)
// Default to comma if none detected
```

**Excel Metadata Handling:**
- Lines starting with `sep=` are automatically stripped
- BOM (`\uFEFF`) characters are removed

---

## Date/Time Parsing

### Supported Formats

| Format | Example | Priority |
|--------|---------|----------|
| ISO | `2024-12-31T23:30:00` | 1 (native) |
| YYYY-MM-DD HH:mm:ss | `2024-12-31 23:30:00` | 2 |
| YYYY/MM/DD HH:mm:ss | `2024/12/31 23:30:00` | 2 |
| DD/MM/YYYY HH:mm:ss | `31/12/2024 23:30:00` | 3 |
| DD-MM-YYYY HH:mm:ss | `31-12-2024 23:30:00` | 3 |
| MM/DD/YYYY HH:mm:ss | `12/31/2024 23:30:00` | 3 (MDY format) |
| DD-MMM-YY HH:mm:ss | `31-Dec-24 23:30:00` | 4 |

### Two-Digit Year Handling
```typescript
if (year < 100) {
  year += (year > 50) ? 1900 : 2000;
}
// Examples: 24 → 2024, 99 → 1999
```

### Combined vs Separate Date/Time

**Combined Field:** `31/12/2024 23:30:00` in single column
**Separate Fields:** Date column + Time column

The system handles both automatically.

---

## Unit Conversion

### Supported Units

| Unit | Type | Conversion to kW | Conversion to kWh |
|------|------|-----------------|-------------------|
| **kW** | Power | `value` | N/A |
| **W** | Power | `value / 1000` | N/A |
| **MW** | Power | `value * 1000` | N/A |
| **kVA** | Power | `value * powerFactor` | N/A |
| **A** (3-phase) | Power | `√3 × V × I × PF / 1000` | N/A |
| **kWh** | Energy | N/A | `value` |
| **Wh** | Energy | N/A | `value / 1000` |
| **MWh** | Energy | N/A | `value * 1000` |
| **kVAh** | Energy | N/A | `value * powerFactor` |

### Conversion Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `voltageV` | 400 V | 3-phase voltage for Amps conversion |
| `powerFactor` | 0.9 | Power factor for kVA/kVAh conversion |

### Auto-Detection from Headers

```typescript
// Priority order for unit detection:
"mwh" → MWh
"mw" (not mwh) → MW
"kvah" → kVAh
"kva" (not kvah) → kVA
"kwh" or "energy" or "consumption" → kWh
"kw" (not kwh) → kW
"wh" (not kwh, not mwh) → Wh
/\bw\b/ or "watt" → W
"amp" or /\ba\b/ or "current" → A
(default) → kWh
```

---

## Data Processing

### Interval Detection

The system auto-detects data intervals by analyzing consecutive timestamps:

**Standard Intervals (minutes):** 1, 5, 10, 15, 30, 60, 120, 180, 240

```typescript
// Calculate intervals between consecutive readings
// Round to nearest standard interval
// Return mode (most common)
```

### Negative Value Handling

| Strategy | Behavior |
|----------|----------|
| `filter` (default) | Discard negative values |
| `absolute` | Convert to absolute value |
| `keep` | Keep negative values as-is |

### Cumulative Value Handling

When `isCumulative = true`:

```typescript
delta = calculateDelta(currentValue, previousValue);

function calculateDelta(current, previous) {
  if (current < previous) {
    // Meter rollover - assume current is the delta
    return current;
  }
  return current - previous;
}
```

---

## Load Profile Generation

### Output Structure

```typescript
interface ProcessedLoadProfile {
  weekdayProfile: number[];  // 24 hourly values in kW
  weekendProfile: number[];  // 24 hourly values in kW
  weekdayDays: number;       // Count of weekdays in data
  weekendDays: number;       // Count of weekend days in data
  totalKwh: number;          // Total energy consumption
  dateRangeStart: string;    // First date in data
  dateRangeEnd: string;      // Last date in data
  dataPoints: number;        // Total parsed rows
  peakKw: number;            // Maximum hourly value
  avgKw: number;             // Average hourly value
  detectedInterval: number;  // Data interval in minutes
}
```

### Aggregation Rules

**For Power Units (kW, W, MW, kVA, A):**
```typescript
// Average the power values for each hour
hourlyValue = sum(hourValues) / count(hourValues)
```

**For Energy Units (kWh, Wh, MWh, kVAh):**
```typescript
// Sum the energy readings for each hour, then average across days
// This represents "typical energy consumption per hour"
hourlyEnergy = sum(allReadingsForThisHour) / numberOfDays
hourlyKw = hourlyEnergy  // Already represents hourly consumption
```

### Weekend Detection

```typescript
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;  // Sunday = 0, Saturday = 6
}
```

---

## Multi-Site / Multi-Meter Handling

### Data Model

```
Site (sites table)
  └── Meter 1 (scada_imports table)
  │     ├── site_id: references sites
  │     ├── shop_name: meter identifier
  │     ├── load_profile_weekday: number[24]
  │     ├── load_profile_weekend: number[24]
  │     └── raw_data: JSON (optional, for specific-date analysis)
  └── Meter 2
  └── Meter N...
```

### Key Fields in `scada_imports` Table

| Field | Type | Description |
|-------|------|-------------|
| `site_id` | UUID | Reference to site |
| `site_name` | string | Name of site/building |
| `shop_name` | string | Specific meter/shop name |
| `shop_number` | string | Meter number/ID |
| `meter_label` | string | User-friendly label |
| `load_profile_weekday` | number[24] | Hourly kW values (weekday) |
| `load_profile_weekend` | number[24] | Hourly kW values (weekend) |
| `raw_data` | JSON | Raw data points for detailed analysis |
| `data_points` | integer | Count of parsed data points |
| `date_range_start` | date | First date in data |
| `date_range_end` | date | Last date in data |
| `detected_interval_minutes` | integer | Data interval (15, 30, 60, etc.) |
| `category_id` | UUID | Optional shop type category |

### Processing Flow for Large Imports

1. **Upload CSV file**
2. **Format detection** (client-side)
3. **Column mapping** (user wizard or auto-detect)
4. **Server processing** (edge function for large files)
5. **Profile generation** (aggregation by hour)
6. **Database storage** (one row per meter)
7. **Optional: Store raw data** for specific-date analysis

---

## Edge Cases & Error Handling

### Empty/Invalid Data

| Condition | Handling |
|-----------|----------|
| No date column found | Fallback to column 0 |
| No value column found | Fallback to column 1 |
| Unparseable date | Skip row, log error |
| Non-numeric value | Skip row |
| Missing required columns | Return empty profile |

### Data Validation

```typescript
// Profiles are validated against:
- allZeros: Entire profile is 0
- flatLine: All non-zero hourly values are identical
- extremeOutliers: Hourly kW > 10,000,000 (usually unit error)
- tooFewPoints: Less than 48 data points (minimum 2 days of hourly data)

// Critical Failure:
- Profile is rejected/marked invalid if all zeros or extreme unit error
```

// Error logging:
- Parse errors accumulated in stats.parseErrors
- Maximum 100 errors stored to prevent memory issues


### Performance Considerations

| Scenario | Processing Location |
|----------|-------------------|
| < 10,000 rows | Client-side |
| ≥ 10,000 rows | Server-side (edge function) |
| Multi-meter file | Server-side (split by meter ID) |
| Cumulative data | Server-side (delta calculations) |

---

## Configuration Reference

### WizardParseConfig Interface

```typescript
interface WizardParseConfig {
  fileType: "delimited" | "fixed";
  startRow: number;                    // 1-indexed header row
  delimiters: {
    tab: boolean;
    semicolon: boolean;
    comma: boolean;
    space: boolean;
    other: boolean;
    otherChar: string;
  };
  treatConsecutiveAsOne: boolean;      // Combine multiple delimiters
  textQualifier: string;               // Quote character (", ', none)
  columns: ColumnConfig[];             // Column type assignments
  detectedFormat?: "pnp-scada" | "generic";
  meterName?: string;                  // Extracted from PnP format
  dateRange?: { start: string; end: string };
  
  // Step 4 explicit selections (highest priority)
  valueColumnIndex?: number;
  dateColumnIndex?: number;
  timeColumnIndex?: number;
  valueUnit?: "kW" | "kWh" | "W" | "Wh" | "MW" | "MWh" | "kVA" | "kVAh" | "A" | "auto";
  voltageV?: number;                   // For Amps conversion
  powerFactor?: number;                // For kVA conversion
}

interface ColumnConfig {
  index: number;
  name: string;
  dataType: "general" | "text" | "date" | "skip";
  dateFormat?: string;                 // "YMD", "DMY", "MDY"
}
```

### Edge Function Parameters

```typescript
{
  csvContent: string;                  // Raw CSV content
  action: "detect" | "process";        // Detection or full processing
  separator?: "tab" | "semicolon" | "comma" | "space" | string;
  headerRowNumber?: number;
  dateColumn?: number;
  timeColumn?: number;
  valueColumn?: number;
  meterIdColumn?: number;
  kvaColumn?: number;
  autoDetect?: boolean;                // Default: true
  handleNegatives?: "filter" | "absolute" | "keep";
  handleCumulative?: boolean;
  dateFormat?: "DMY" | "MDY" | "YMD";
}
```

---

## Summary of Current Issues

### Known Limitations

1. **Placeholder profiles**: Meters with `data_points = 0` may have stored default profiles (e.g., `[4.17, 4.17, ...]`) - these should be treated as "no data"

2. **Column detection confidence**: Generic CSV files may require manual column selection

3. **Memory limits**: Very large files (>500MB) may require chunked processing

### Recommended Improvements

1. **Clear data_points = 0 profiles** - Don't store placeholder load profiles for empty imports
2. **Add "has_data" flag** - Explicit boolean for meters with actual extracted data
3. **Validation on save** - Reject profiles where all values are identical (indicates extraction failure)

---

## Related Files

| File | Purpose |
|------|---------|
| `src/components/loadprofiles/CsvImportWizard.tsx` | User interface for CSV configuration |
| `src/components/loadprofiles/utils/csvToLoadProfile.ts` | Client-side processing |
| `src/components/loadprofiles/utils/sharedParsingUtils.ts` | Shared utilities |
| `src/components/loadprofiles/types/csvImportTypes.ts` | Type definitions |
| `supabase/functions/process-scada-profile/index.ts` | Server-side processing |
| `src/components/loadprofiles/MeterLibrary.tsx` | Meter display and management |
