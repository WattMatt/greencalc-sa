

## Add Up/Down Arrows to 30-Min Interval Cells in Down Time Tab

### What Changes

Each "30-Min Intervals" cell in the Down Time tab will get small up/down arrow buttons beside the number. Clicking up increments by 1, clicking down decrements by 1 (minimum 0). This lets you manually adjust downtime intervals beyond the auto-calculated values.

### New Database Table

A `downtime_slot_overrides` table will persist manual adjustments:

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | Auto-generated |
| project_id | text | Project reference |
| year | integer | e.g. 2026 |
| month | integer | 1-12 |
| day | integer | 1-31 |
| reading_source | text | The source key (e.g. Tie-In identifier) |
| slot_override | integer | The user's adjusted value |
| created_at | timestamptz | Auto-set |

Unique constraint on (project_id, year, month, day, reading_source). RLS: open read/write (consistent with existing downtime_comments).

### UI Approach

- Replace the plain number in each "30-Min Intervals" cell with a compact inline widget: the number flanked by tiny up/down chevron buttons (stacked vertically to the right)
- Clicking up/down immediately updates the displayed value and upserts to the database
- The displayed value defaults to the calculated `downtimeSlots` but switches to the override once the user adjusts it
- Totals row recalculates based on overridden values

### New Component

**`src/components/projects/generation/DowntimeSlotCell.tsx`**
- Props: `projectId`, `year`, `month`, `day`, `readingSource`, `calculatedSlots`, `overrideValue`, `onChanged`
- Local state tracks the current value (override or calculated)
- Up/down buttons use `ChevronUp` / `ChevronDown` icons from lucide-react
- On click, upserts to `downtime_slot_overrides` table

### Changes to PerformanceSummaryTable.tsx

- Fetch overrides for the current project/year/month via `useQuery`
- Pass override values to the new `DowntimeSlotCell` component in each source's 30-Min Intervals column
- Adjust totals computation to use overridden values when present
- The total row and the aggregated "Down Time" Lost Production column will also reflect overrides (recalculating lost energy as `overriddenSlots * perSlotEnergy`)

### Technical Details

- Database migration: create `downtime_slot_overrides` with unique constraint and open RLS policies
- Query key: `["downtime-slot-overrides", projectId, year, month]`
- Override map: `Map<string, number>` keyed by `${day}-${readingSource}`
- The cell component will use `queryClient.invalidateQueries` after upserting to refresh data
- Minimum value clamped to 0; no maximum cap (user can go above calculated value)
