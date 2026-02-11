

# Update Down Time Column to Show Time Slot Count

## What Changes

The **Down Time** column will display the number of time intervals (slots) during sun hours (06:00 inclusive to 18:00 exclusive) where there was zero or no PV production, instead of an energy (kWh) value.

For example, if there are 3 half-hour intervals with no generation, the column will show **3** instead of an energy estimate.

## Theoretical Generation

Theoretical Generation will continue to work as an energy value. Internally, the code will still calculate an energy-based downtime estimate (using the daily guarantee spread across sun-hour readings) for the Theoretical Generation formula. Only the **displayed** Down Time column changes to a slot count.

## Technical Details

**File:** `src/components/projects/generation/PerformanceSummaryTable.tsx`

1. Update the `dayMap` to track two values: `downtime` (energy, used internally for Theoretical Gen) and `downtimeSlots` (count, displayed in the column).
2. In the reading loop, increment `downtimeSlots` by 1 for each zero/null reading during sun hours.
3. Add `downtimeSlots` to the `DailyRow` interface and pass it through.
4. Update the Down Time table cells to display the slot count instead of the energy value.
5. Update the totals row accordingly.
6. Rename the column header to "Down Time Slots (06:00-18:00)" or similar for clarity.
