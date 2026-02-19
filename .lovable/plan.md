

## Fix: Duplicate Municipalities with Trailing Dashes

### What Happened

The PDF text extraction (now using `pdf-parse`) is splitting lines differently than the previous method. A line like `MAKHADO - 12.72%` gets split so that the municipality name comes through as `MAKHADO -` (without the percentage). The clean-up regex on line 329 only removes `- 12.72%` patterns (dash + percentage), so the trailing ` -` survives and gets saved as a new municipality.

This created 8 duplicate municipalities:
- BELABELA / BELABELA -
- BLOUBERG / BLOUBERG -
- ELIAS MOTSOALEDI / ELIAS MOTSOALEDI -
- GREATER LETABA / GREATER LETABA -
- LEPHALALE / LEPHALALE -
- LIMPOPO PROVINCE BAPHALABORWA / LIMPOPO PROVINCE BAPHALABORWA -
- MAKHADO / MAKHADO -
- THABAZIMBI / THABAZIMBI -

### Fix (Two Parts)

**Part 1 — Clean up existing data**

Move all tariff plans from the duplicate municipalities to the originals, then delete the duplicates. This is a data operation:
- UPDATE tariff_plans to point to the original municipality ID where they currently point to a duplicate
- DELETE the duplicate municipality rows

**Part 2 — Prevent it from happening again**

In `supabase/functions/process-tariff-file/index.ts`, strengthen the name clean-up regex at line 329 to also strip any trailing dashes/whitespace after removing percentages:

```
Before: muniName.replace(/\s*-\s*\d+[\.,]\d*%$/, '').trim()
After:  muniName.replace(/\s*[-–]\s*(\d+[\.,]\d*%)?$/, '').trim()
```

This catches both `MAKHADO - 12.72%` and `MAKHADO -` (trailing dash with no percentage).

### Technical Details

| Change | Location |
|---|---|
| Data cleanup: reassign tariffs + delete duplicates | Database (8 UPDATE + 8 DELETE operations) |
| Fix regex in municipality name cleaning | `supabase/functions/process-tariff-file/index.ts` line 329 |
| Redeploy edge function | Automatic |

