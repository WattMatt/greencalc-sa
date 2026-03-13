

## Delete Today's Tariff Upload

There are **120 tariff plans** and **385 associated tariff rates** uploaded today (2026-03-13) for municipalities including Rand West City, Mogale City, Merafong City, and City of Johannesburg.

### Plan

Create a small edge function (or use a database migration) to delete the data in the correct order:

1. **Delete tariff_rates first** (child rows) — 385 rows where `tariff_plan_id` belongs to today's upload
2. **Delete tariff_plans** — 120 rows where `created_at::date = '2026-03-13'`

The SQL to execute:

```sql
DELETE FROM tariff_rates 
WHERE tariff_plan_id IN (
  SELECT id FROM tariff_plans WHERE created_at::date = '2026-03-13'
);

DELETE FROM tariff_plans 
WHERE created_at::date = '2026-03-13';
```

Also check and clean up any related `extraction_runs` or `eskom_batch_status` records from today if applicable.

### File changes
- No permanent code changes needed — this is a one-time data deletion operation executed via the database tools.

