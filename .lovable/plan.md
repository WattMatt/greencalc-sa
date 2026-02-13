

## Download Meter CSV Data from PNP SCADA

### What We Found

The existing `fetch-pnpscada` backend function already logs in successfully and can see all 39 meter accounts. However, navigating to individual meter pages fails because each login creates a new session hash (`memh`) that invalidates URLs from previous calls.

The good news: PNP SCADA has a **direct API endpoint** (`readMeterProfile`) that returns CSV profile data for any meter, using just credentials and a serial number -- no session navigation needed.

### Plan

**1. Update the `fetch-pnpscada` backend function** with two improved actions:

- **`list-meters` (improved)**: Login, fetch overview, properly parse all 39 meters extracting their entity IDs, serial numbers, and names (e.g., "Parkdene Solar DB2.1 -- serial 31198")

- **`download-csv` (new action)**: Use the `readMeterProfile` API endpoint to directly download CSV data for a specific meter and date range:
  ```
  /readMeterProfile?LOGIN=thukela.USERNAME&PWD=PASSWORD&key1=SERIAL&startdate=YYYY-MM-DD&enddate=YYYY-MM-DD
  ```
  No session cookies or page navigation needed -- just a single HTTP GET.

- **`download-all` (new action)**: Loop through a list of meter serials and download CSV for each, returning all data in one response. Useful for bulk monthly downloads.

**2. Update the meter parsing logic**: The current parser misses the actual meters. Fix it to extract entries like:
```
<A href='/overview?...&PNPENTID=109883&PNPENTCLASID=109'> 31198</A>  Parkdene Solar DB2.1
```
This gives us: entity ID = 109883, serial = 31198, name = "Parkdene Solar DB2.1"

**3. Add a UI button** (in the Generation tab or Settings): A "Sync from SCADA" button that:
- Calls `list-meters` to show available meters
- Lets you select which meters to download
- Specify a date range (e.g., last month)
- Downloads the CSV data and pipes it into the existing `process-scada-profile` ingestion pipeline
- Stores results in `generation_readings` for the relevant project

### Technical Details

**File changes:**
- `supabase/functions/fetch-pnpscada/index.ts` -- Rewrite to use `readMeterProfile` API, fix meter parsing from overview HTML
- New UI component (location TBD based on where you want the button) -- "Sync SCADA Data" dialog

**The `readMeterProfile` endpoint format:**
```
GET https://thukela-kadesh.pnpscada.com/readMeterProfile
  ?LOGIN=thukela.power@wmeng_co_za
  &PWD=<password>
  &key1=31198
  &startdate=2026-01-01
  &enddate=2026-02-01
```
Returns CSV data directly (Date, Time, P1 kW readings at 30-min intervals) -- exactly the format your existing CSV parser already handles.

**Credentials**: Already stored as `PNPSCADA_USERNAME` and `PNPSCADA_PASSWORD` secrets. The LOGIN parameter format uses `subdomain.username` with `@` replaced by `_` (based on the PNP SCADA convention seen in the overview: `thukela.power@wmeng_co_za`).

**No new database tables needed** -- data flows into existing `generation_readings` and/or `scada_imports` tables.

