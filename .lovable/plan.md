

## Fix: Down Time kWh Calculation Off by One Slot

### Problem

The "Down Time kWh" values are too high -- when a source has zero production for the entire day, the downtime kWh exceeds the daily yield guarantee (7,777.16 vs 7,453.11).

**Root cause**: There's an off-by-one error in the sun-hour slot count.

- The code counts readings from 06:00 to 17:30 inclusive at 30-minute intervals: 06:00, 06:30, 07:00, ..., 17:00, 17:30 = **24 data points**
- But the divisor `sunHourSlots` is calculated as `11.5 / 0.5 = 23`
- Each downtime slot adds `sourceDailyGuarantee / 23`, so when all 24 slots are down, total = `24/23 * dailyGuarantee` -- about 4.3% too high

### Fix

Change the `sunHourSlots` formula to correctly count the number of measurement intervals in the sun-hour window:

```
sunHourSlots = ((1050 - 360) / (intervalHours * 60)) + 1
```

For 30-min data: `(690 / 30) + 1 = 24`

### File Changed

- `src/components/projects/generation/PerformanceSummaryTable.tsx` -- Update line 144 to use the corrected slot count formula

### Verification

After the fix, when all sources are fully down for a day, Down Time kWh should equal the Yield Guarantee value (7,453.11). Theoretical Generation should also equal 7,453.11 (0 metered + 7,453.11 downtime), and Surplus/Deficit should be -7,453.11 (0 - 7,453.11).

