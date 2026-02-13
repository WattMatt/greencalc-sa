

# Fix: Downtime Calculation Must Account for Missing Timestamps

## The Problem

The daily downtime calculation only counts slots where a database row exists with a zero or null value. When a timestamp slot is completely **absent** from the data, it is silently ignored -- meaning the downtime energy is underreported.

**Example from Day 1:**
- Yield Guarantee: 7,453.11 kWh
- Metered Generation: 0.27 kWh (essentially zero -- the whole day was down)
- Down Time kWh: 7,297.85 (should be ~7,452.84 to make Theoretical match Guarantee)
- Gap: **155.26 kWh unaccounted for** -- these are missing timestamp slots

## Root Cause

In `PerformanceSummaryTable.tsx`, the downtime loop iterates over **existing readings only**:

```text
for (const r of readings) {
  // only counts downtime if a row exists with actual_kwh == 0 or null
}
```

If a sun-hour slot (e.g., 06:30, 07:00) has no row in the database at all, it is never evaluated and never counted as downtime.

## The Fix

**File:** `src/components/projects/generation/PerformanceSummaryTable.tsx`

Replace the current "iterate over readings" approach with a "generate expected slots, then check for data" approach:

1. **For each day**, generate all expected sun-hour timestamps (06:00 to 17:30 at the detected interval -- e.g., 24 slots for 30-min data).

2. **Build a lookup** of existing readings keyed by (day, minuteOfDay, source).

3. **For each expected slot per source**: if no reading exists OR the reading has zero/null actual_kwh, count it as a downtime slot and add the per-slot downtime energy.

This ensures that a fully offline day (no data rows at all) produces downtime kWh equal to the daily yield guarantee, which is the mathematically correct result.

## Technical Detail

```text
Current flow:
  readings[] --> for each reading --> if zero during sun hours --> add downtime

Fixed flow:
  for each day (1..totalDays):
    for each source in distinctSources:
      for each sun-hour slot (06:00, 06:30, ..., 17:30):
        lookup reading at (day, slot, source)
        if missing OR zero --> count as downtime
```

The per-slot downtime energy formula stays the same: `sourceDailyGuarantee / sunHourSlots`.

## Expected Result After Fix

For Day 1 with near-zero generation:
- Down Time kWh will be approximately equal to the Yield Guarantee
- Theoretical Generation = Metered + Down Time will match the Guarantee
- Surplus/Deficit will correctly reflect the shortfall against metered (not theoretical)

No database changes required. This is a front-end calculation fix only.

