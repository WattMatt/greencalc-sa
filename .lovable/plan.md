

## 1. Delete Test Upload Data

Remove all records inserted by the Antigravity test upload (source = `Inverter-Test`) across 4 tables:

| Table | Records to Delete |
|-------|-------------------|
| `generation_records` | 1 row (Jan 2026, 286.5 kWh) |
| `generation_daily_records` | 1 row (2026-01-01) |
| `generation_readings` | 4 rows (half-hourly readings) |
| `generation_source_guarantees` | 1 row (Jan 2026) |

All filtered by `project_id = 'f663da5d-...'` AND `source` / `source_label = 'Inverter-Test'`.

---

## 2. API Specification for Antigravity

### Endpoint
```
POST https://zhhcwtftckdwfoactkea.supabase.co/functions/v1/upload-generation-csv
```

### Authentication
```
Authorization: Bearer <Monthly_Generation_Upload key value>
```

### JSON Body Parameters

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `project_id` | UUID string | Yes | -- | The project UUID |
| `type` | `"solar"` or `"council"` | Yes | -- | Solar = inverter/generation data. Council = grid/building load data |
| `csv_content` | string | Yes | -- | Raw CSV text (entire file content as a string) |
| `date_col` | integer | Yes | -- | 0-based column index for the date column |
| `value_col` | integer | Yes | -- | 0-based column index for the kW/kWh value column |
| `time_col` | integer | No | -1 | 0-based column index for a separate time column (if time isn't in the date column) |
| `year` | integer | No | auto-detected | Override year for all rows |
| `source_label` | string | No | `"csv-api"` | Label to tag the upload (e.g. `"Inverter-1"`, `"Council-Meter"`) |
| `is_kw` | boolean | No | `true` | If `true`, values are kW and get multiplied by interval duration to produce kWh. If `false`, values are already kWh |
| `mode` | `"accumulate"` or `"replace"` | No | `"accumulate"` | `accumulate` adds to existing month totals. `replace` deletes existing month data first |

### CSV Format

The CSV is passed as a raw string in `csv_content`. Two formats are supported:

**Format A: SCADA (PnP SCADA style)**
- Row 1: metadata line containing "pnpscada" or "scada" (triggers SCADA detection)
- Row 2: column headers
- Row 3+: data rows

```csv
"pnpscada.com export, Site: Mamaila"
"Date","Time","P1 (per kW)","P2 (per kW)"
"2026-01-15","00:00",150,80
"2026-01-15","00:30",145,78
```

**Format B: Simple CSV**
- Row 1: column headers
- Row 2+: data rows

```csv
Date,Time,kW
2026-01-15,00:00,150
2026-01-15,00:30,145
2026-01-15,01:00,140
```

### Date Formats Supported
- `YYYY-MM-DD` or `YYYY/MM/DD` (preferred)
- `DD-MM-YYYY` or `DD/MM/YYYY`

### Time Format
- `HH:MM` or `HH:MM:SS` (24-hour)
- Can be in the date column itself or a separate time column

### Interval Detection
When `is_kw = true`, the function auto-detects the interval from the first two data rows' time values (e.g. 30 min = 0.5h multiplier). Default is 30 minutes if detection fails.

### Example Python Call
```python
import requests

url = "https://zhhcwtftckdwfoactkea.supabase.co/functions/v1/upload-generation-csv"
headers = {
    "Authorization": f"Bearer {os.environ['Monthly_Generation_Upload']}",
    "Content-Type": "application/json"
}

with open("inverter_data.csv", "r") as f:
    csv_text = f.read()

payload = {
    "project_id": "f663da5d-5558-48c6-b6ad-f5a7a94e5a5e",
    "type": "solar",
    "source_label": "Inverter-1",
    "csv_content": csv_text,
    "date_col": 0,
    "value_col": 2,
    "time_col": 1,
    "is_kw": True,
    "mode": "replace"
}

response = requests.post(url, json=payload, headers=headers)
print(response.json())
```

### Success Response
```json
{
  "success": true,
  "months_affected": [1, 2, 3],
  "total_kwh_added": 12345.67,
  "readings_count": 1440,
  "daily_records": 31
}
```

---

## Technical Steps

1. Run 4 DELETE queries against the database to remove all `Inverter-Test` source data for project `f663da5d-5558-48c6-b6ad-f5a7a94e5a5e`
2. No code changes needed -- this is purely a data cleanup
