

## Per-Source Downtime Calculation

### Problem
Currently, all CSV uploads are additively merged into a single `actual_kwh` value per timestamp. Downtime is then evaluated on this combined total, which is incorrect -- a zero in the aggregate only occurs when ALL sources are simultaneously off. Individual source downtime is invisible.

### Solution Overview
Store generation readings per source (per uploaded CSV), then evaluate downtime independently for each source against its own guarantee value.

### Database Changes

**1. Update unique index on `generation_readings`**
- Drop the existing unique index `idx_generation_readings_project_ts` on `(project_id, timestamp)`
- Create a new unique index on `(project_id, timestamp, source)` so each source gets its own row per timeslot
- Default `source` to `'csv'` for backward compatibility

**2. No new tables needed** -- the existing `generation_source_guarantees` table already maps source labels to guarantee values.

### Upload Logic Changes (ActualGenerationCard.tsx)

- Stop additively merging readings. Instead, store each CSV's readings with `source = sourceLabel` (the filename-derived label)
- Upsert using the new unique constraint `(project_id, timestamp, source)` so re-uploading the same file overwrites rather than doubles
- The monthly total in `generation_records.actual_kwh` remains the sum across all sources

### Downtime Calculation Changes (PerformanceSummaryTable.tsx)

- Fetch readings with the `source` column included
- Fetch `generation_source_guarantees` for the month to get per-source guarantee values
- For each source, independently:
  - Calculate daily guarantee = source's `guaranteed_kwh / totalDays`
  - Count downtime slots: sun-hour readings (06:00-18:00) where that source's `actual_kwh` is zero/null
  - Calculate downtime energy = `(source daily guarantee / sun-hour readings) * downtime slots`
- Aggregate across sources for the daily totals displayed in the table
- The "Down Time Slots" column will show the total count across all sources
- "Theoretical Generation" = Metered Generation + total downtime energy from all sources

### Summary of File Changes

| File | Change |
|------|--------|
| Database migration | Drop old unique index, create new one on `(project_id, timestamp, source)` |
| `ActualGenerationCard.tsx` | Store readings with `source = sourceLabel` instead of merging additively |
| `PerformanceSummaryTable.tsx` | Fetch source guarantees; calculate downtime per source independently; aggregate for display |

### Technical Details

**Reading storage (upload)**:
```text
Before: All CSVs merged -> one row per (project_id, timestamp) with summed actual_kwh
After:  Each CSV stored separately -> one row per (project_id, timestamp, source) with that source's actual_kwh
```

**Downtime calculation**:
```text
For each source S with guarantee G_s:
  daily_guarantee_s = G_s / days_in_month
  For each 30-min slot in sun hours (06:00-18:00):
    If S.actual_kwh == 0 or null -> downtime_slot
    downtime_energy += daily_guarantee_s / 24  (24 slots in 12 sun hours at 30-min intervals)
  
Total downtime energy for the day = sum of all sources' downtime energy
```

**Monthly total sync**: The `generation_records.actual_kwh` will be recalculated as the sum of all per-source readings for the month, maintaining consistency with the existing summary cards.
