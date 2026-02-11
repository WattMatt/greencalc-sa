
# Update Theoretical Generation Calculation

## Current Behavior
Theoretical Generation is set to a fixed value: `dailyGuarantee` (monthly guarantee divided by days in month), ignoring actual readings and downtime.

## New Behavior
Theoretical Generation = **Metered Generation + Down Time**

This reflects the idea that theoretical output is what was actually generated plus what *would have been* generated during downtime periods.

## Technical Change

**File: `src/components/projects/generation/PerformanceSummaryTable.tsx`** (line 106)

Change:
```typescript
const theoretical = dailyGuarantee;
```
To:
```typescript
const theoretical = metered + entry.downtime;
```

This single-line change will also automatically update **Over Production** (`max(0, metered - theoretical)`) and keep the rest of the table consistent. Note that with this formula, Over Production will always be 0 since `metered` can never exceed `metered + downtime`.

The **Surplus/Deficit** column remains unchanged as it compares metered generation against the yield guarantee, not theoretical generation.
