

## Link Guarantee Sources to CSV Reading Sources

### Problem
The guarantee entries ("Tie-In 1", "Tie-In 2", "Tie-In 3") are separate from the CSV reading sources ("31198 - Parkdene Solar DB2.1", "31193 - Parkdene Solar DB3.1", "31190 - Parkdene Solar Checkers"). Currently the system uses an unreliable index-based fallback to associate them.

### Solution
Add a `reading_source` column to `generation_source_guarantees` so each guarantee can be explicitly linked to the CSV source it represents. The Source Guarantees dialog will show a dropdown for each row letting users pick the associated reading source.

### Changes

**1. Database migration**
- Add `reading_source text` column (nullable) to `generation_source_guarantees`.

**2. Source Guarantees Dialog (`SourceGuaranteesDialog.tsx`)**
- Fetch distinct reading sources from `generation_readings` for the project/month/year.
- Add a dropdown (Select) next to each guarantee row where users can pick which reading source it maps to.
- Save the selected `reading_source` value alongside the existing fields.

**3. Performance table filtering (`PerformanceSummaryTable.tsx`)**
- Fetch `reading_source` in the source guarantees query.
- When building the guarantee map, use `reading_source` (if set) as the key instead of `source_label`. This directly maps "Tie-In 1" guarantee to "31198 - Parkdene Solar DB2.1" readings.
- Keep the display name as the guarantee's `source_label` (e.g., "Tie-In 1").
- Remove the aggressive secondary filter (lines 209-214) that deletes sources with zero guarantees -- council exclusion is already handled by `meter_type`.

### Technical Details

```text
generation_source_guarantees
+-----------------+------------------+----------+----------------+
| source_label    | guaranteed_kwh   | meter_type | reading_source |
+-----------------+------------------+----------+----------------+
| Tie-In 1        | 52,375           | solar    | 31198 - ...    |
| Tie-In 2        | 89,335           | solar    | 31193 - ...    |
| Tie-In 3        | 89,335           | solar    | 31190 - ...    |
| Council Supply  | 0                | council  | NULL           |
+-----------------+------------------+----------+----------------+
```

The guarantee map in `PerformanceSummaryTable` will be keyed by `reading_source` when available, ensuring exact matching to the actual time-series data regardless of label differences.

