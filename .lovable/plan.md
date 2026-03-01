

## Remote CSV Upload API for Generation Data

### Overview

Create a backend function called `upload-generation-csv` that accepts a CSV file (as text content) along with metadata, parses it server-side using the same column-mapping logic as the UI, and upserts the results into `generation_records`, `generation_daily_records`, `generation_readings`, and `generation_source_guarantees`.

This gives you a single HTTP endpoint you can call from any server script (cron job, Python, Node, curl, etc.).

### API Design

**Endpoint:** `POST /functions/v1/upload-generation-csv`

**Headers:**
- `Authorization: Bearer <your_service_role_key_or_user_jwt>`
- `Content-Type: application/json`

**Request Body:**
```text
{
  "project_id": "uuid-of-the-project",
  "year": 2026,
  "type": "solar" | "council",          // solar = actual generation, council = building load
  "source_label": "Inverter-A",          // name for the data source (used as source tag)
  "csv_content": "Date,Time,kW\n...",    // raw CSV text
  "date_col": 0,                         // column index for date
  "value_col": 2,                        // column index for kW/kWh values
  "time_col": 1,                         // column index for time (optional, -1 to skip)
  "is_kw": true,                         // true = values are kW (convert using interval), false = already kWh
  "mode": "accumulate" | "replace"       // accumulate adds to existing; replace overwrites the month
}
```

**Response:**
```text
{
  "success": true,
  "months_affected": [1, 2, 3],
  "total_kwh_added": 12345.67,
  "readings_count": 8760,
  "daily_records": 90
}
```

### Server-Side Logic

The edge function will:

1. **Validate** the request (project_id exists, columns are in range, CSV has data).
2. **Parse** the CSV using the same date-extraction and interval-detection logic from `CSVPreviewDialog.tsx` — ported to Deno/TypeScript.
3. **Aggregate** into monthly totals, daily totals, and individual timestamp readings.
4. **Upsert** into the four tables using the service role key (bypasses RLS):
   - `generation_records` — monthly totals (actual_kwh or building_load_kwh depending on `type`)
   - `generation_daily_records` — daily totals
   - `generation_readings` — raw timestamped readings
   - `generation_source_guarantees` — auto-create source entry with meter_type = "solar" or "council"
5. **Return** a summary of what was written.

### Authentication

The function will use `verify_jwt = false` in config.toml and validate the caller via `getClaims()`. For server-to-server calls using the service role key, it will check for the `service_role` claim. This means your server script can authenticate with the service role key directly.

### Example Usage (curl)

```text
curl -X POST \
  https://zhhcwtftckdwfoactkea.supabase.co/functions/v1/upload-generation-csv \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "f663da5d-...",
    "year": 2026,
    "type": "solar",
    "source_label": "Inverter-A",
    "csv_content": "Date,Time,kW\n2026-01-01,00:00,150\n2026-01-01,00:30,145\n...",
    "date_col": 0,
    "value_col": 2,
    "time_col": 1,
    "is_kw": true,
    "mode": "accumulate"
  }'
```

### Example Usage (Python)

```text
import requests, json

url = "https://<project-ref>.supabase.co/functions/v1/upload-generation-csv"
headers = {
    "Authorization": "Bearer <SERVICE_ROLE_KEY>",
    "Content-Type": "application/json"
}

with open("inverter_data.csv") as f:
    csv_text = f.read()

resp = requests.post(url, headers=headers, json={
    "project_id": "f663da5d-...",
    "year": 2026,
    "type": "solar",
    "source_label": "Inverter-A",
    "csv_content": csv_text,
    "date_col": 0,
    "value_col": 2,
    "time_col": 1,
    "is_kw": True,
    "mode": "accumulate"
})
print(resp.json())
```

### Implementation Details

**New file:** `supabase/functions/upload-generation-csv/index.ts`

The function will:
- Use `npm:@supabase/supabase-js` with the service role key for DB writes (bypasses RLS)
- Port the date parsing (`extractDateInfo`, `extractTimestamp`, `timeDiffMinutes`) from `CSVPreviewDialog.tsx`
- Batch upserts in groups of 500 rows for `generation_readings` (same as the UI does)
- Support both `accumulate` mode (add to existing values) and `replace` mode (overwrite monthly values)
- Handle the `council` type by writing to `building_load_kwh` columns instead of `actual_kwh`

**Config update:** `supabase/config.toml` — add `[functions.upload-generation-csv]` with `verify_jwt = false`

### Files Changed

| File | Change |
|---|---|
| `supabase/functions/upload-generation-csv/index.ts` | New edge function with CSV parsing and DB upsert logic |
| `supabase/config.toml` | Add function config entry |

