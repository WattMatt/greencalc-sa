

## Fix: Timezone Offset Bug in Downtime Calculation

### Root Cause

Timestamps in `generation_readings` are stored as `timestamptz` with `+00` (e.g., `2026-01-01 06:00:00+00`). They represent local South African time but are flagged as UTC. When `new Date()` parses them, the browser applies its local timezone offset (UTC+2), shifting all readings by 2 hours.

This means the `readingLookup` map keys are offset from the downtime loop keys:
- Downtime loop checks key `1-360-source` (06:00 local)
- But the reading for 06:00 local was stored at key `1-480-source` (because `new Date('...06:00:00+00').getHours()` returns 8 in UTC+2)

Result: the first 3 sun-hour slots (06:00, 06:30, 07:00) always look up nighttime readings (0 kWh), producing false downtime on every day.

### Fix

**File:** `src/components/projects/generation/PerformanceSummaryTable.tsx`, lines 249-254

Change the readingLookup key construction to parse hours/minutes directly from the timestamp string, bypassing `new Date()` timezone conversion:

```typescript
// Current (broken):
const ts = new Date(r.timestamp);
const day = ts.getDate();
const minutes = ts.getHours() * 60 + ts.getMinutes();

// Fixed — parse from string to avoid timezone shift:
const tsStr = String(r.timestamp);
const match = tsStr.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
if (!match) continue;
const day = parseInt(match[3], 10);
const minutes = parseInt(match[4], 10) * 60 + parseInt(match[5], 10);
```

This extracts day, hour, and minute directly from the stored string without any timezone conversion, ensuring the lookup keys align with the downtime loop's minute-based keys.

### Scope of Impact

This same `new Date()` timezone issue also affects:
- The `actual` accumulation per day (lines 265-270) — readings may be assigned to the wrong day near midnight
- The interval detection (lines 236-240) — but this only checks the *difference* between two timestamps so the offset cancels out

The primary fix targets the readingLookup key construction. The day extraction should also use string parsing for consistency, though the impact is smaller (only affects readings near midnight boundaries).

### No other files need changes
