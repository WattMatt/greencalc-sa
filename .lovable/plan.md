

## Change Solar Sun Hours Window to 6am–6pm

Update the default solar generation window from the current 6-hour range (09:00–15:00) to a 12-hour range (06:00–18:00). This affects blended rate calculations throughout the app.

### Changes

**File: `src/lib/tariffCalculations.ts`**
- Line 51: Change default parameters in `countSolarTOUHours` from `start = 9, end = 15` to `start = 6, end = 18`
- Update the file header comment from "6h window" / "2,190 hours annual" to "12h window" / "4,380 hours annual"

That single default parameter change propagates to all solar blended rate calculations (seasonal, annual, solar hour breakdowns) since every caller uses the defaults.

