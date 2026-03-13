

## Sync All Data to External Supabase Instance

### What we'll build

An edge function `replicate-to-external` that reads all tables from the current database and upserts them into `https://lyctmmqndqegptzkajhz.supabase.co`.

### Prerequisites (secrets needed)

We need two new secrets:
- **TARGET_SUPABASE_URL** — `https://lyctmmqndqegptzkajhz.supabase.co`
- **TARGET_SUPABASE_SERVICE_ROLE_KEY** — The service role key from the target project (found in the target project's API settings). This is required because the anon key won't have write access.

### How it works

1. The edge function connects to both databases using service role keys
2. For each table, it reads all rows from the local database
3. It upserts them into the target database (matching on `id`)
4. Tables are synced in dependency order to avoid foreign key violations

### Tables to sync (in order)

1. `provinces`
2. `shop_type_categories`
3. `shop_types`
4. `sites`
5. `projects`
6. `project_tenants`
7. `scada_imports`
8. `generation_records`, `generation_readings`, `generation_daily_records`, `generation_source_guarantees`
9. `pv_layouts`, `project_solar_data`
10. `tariff_plans`, `tariff_rates`, `municipalities`
11. `gantt_tasks`, `gantt_milestones`, `gantt_baselines`, `gantt_task_dependencies`
12. `proposals`, `sandbox_simulations`, `stacked_profiles`
13. `project_document_folders`, `project_schematics`, `project_schematic_meter_positions`, `project_meter_connections`
14. `organization_branding`, `profiles`, `report_analytics`
15. Remaining tables: `checklist_template_groups`, `handover_checklist_items`, `checklist_document_links`, `downtime_slot_overrides`, `eskom_batch_status`, `extraction_runs`

### Important caveat

The target Supabase instance must already have matching table schemas. The function only syncs **data**, not schema. You'll need to either:
- Run the same migrations on the target instance, or
- Let me know and I can generate a full schema SQL dump for you to run on the target

### Technical details

- Edge function: `supabase/functions/replicate-to-external/index.ts`
- Pagination: 1000 rows per batch to stay within query limits
- Upsert with `onConflict: 'id'` to handle re-runs safely
- Returns a summary of rows synced per table
- Storage bucket files are NOT synced (only database rows)

