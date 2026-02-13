

## Fix SCADA CSV Download -- Use Correct HTTP Flow

### Problem
The current `fetch-pnpscada` edge function tries guessed CSV endpoints (`/profilecsv`, `/exportcsv`) which don't exist. Based on exploring the actual PNP SCADA website, we now know the exact sequence of HTTP requests needed to download CSV data.

### The Correct HTTP Request Chain

For each meter, the backend function needs to:

1. **Login** -- POST to `/_Login` with credentials (already working)
2. **Get overview** -- Follow redirects to get `memh` session token (already working)
3. **Search for meter** -- POST to `/browseopen.jsp` with `searchStr=SERIAL&memh=...&clas=%` to find the meter
4. **Select meter** -- Navigate to `/overview?PNPENTID=ENTITY_ID&PNPENTCLASID=CLASS_ID&memh=...` to load the meter into the session
5. **Set date range** -- Submit date parameters via the overview page (the date range is embedded in URL parameters)
6. **Download CSV** -- GET `/_DataDownload?CSV=Yes&TEMPPATH=../temp/&LOCALTEMPPATH=docroot/temp/&GSTARTH=0&GSTARTN=0&GENDH=0&GENDN=0&GSTARTD={day}&GSTARTY={year}&GSTARTM={month}&GENDD={day}&GENDY={year}&GENDM={month}&selGNAME_UTILITY={serial}$Electricity&TGIDX=0&memh=...`

The key insight from the HTML: the CSV download URL contains all date parameters inline (no separate form submit needed) and uses `selGNAME_UTILITY={serial}$Electricity` to identify the meter.

### Changes

**1. Rewrite `supabase/functions/fetch-pnpscada/index.ts`**

Replace the `downloadMeterCSV` function with the correct flow:

- Keep the existing login/session logic (it works)
- For `list-meters`: Also use `browseopen.jsp` search to find meters, since the overview page parsing may miss some. Support a `searchStr` parameter to filter.
- For `download-csv`: After login + getting `memh`:
  - Load the meter into session: GET `/overview?PNPENTID={entityId}&PNPENTCLASID={classId}&memh={memh}`
  - Extract the new `memh` from the response (it changes per page load)
  - Construct the `_DataDownload` URL with date parameters parsed from `startDate`/`endDate` strings
  - GET the CSV data directly
- For `download-all`: Loop through meters, doing a fresh login per meter (since `memh` is invalidated when loading a new entity)

**2. Update `list-meters` action**

Add a `browseopen.jsp` search approach alongside the overview parsing:
- POST to `/browseopen.jsp` with `memh`, `clas=%`, `searchStr=*` (or a specific search term)
- Parse the `<option>` elements: `value="51990,107"` gives entityId and classId; the text contains serial, location, and name
- Return structured meter list with entityId, classId, serial, and name

**3. No UI changes needed**

The `SyncScadaDialog.tsx` already has the correct structure -- it calls `list-meters`, shows checkboxes, and calls `download-all`. The only change is making the backend actually return real CSV data.

### Technical Details

**`_DataDownload` URL construction:**
Given `startDate = "2026-01-01"` and `endDate = "2026-02-01"` and `serial = "31177"`:
```
/_DataDownload?CSV=Yes
  &TEMPPATH=../temp/
  &LOCALTEMPPATH=docroot/temp/
  &GSTARTH=0&GSTARTN=0
  &GENDH=0&GENDN=0
  &GSTARTD=1&GSTARTY=2026&GSTARTM=1
  &GENDD=1&GENDY=2026&GENDM=2
  &selGNAME_UTILITY=31177$Electricity
  &TGIDX=0
  &memh={memh}
```

**Browse page option parsing:**
```
<option value="51990,107">Elster A1140: E0085 ; LT Room 1 ; Kuruman Mall ; Kuruman (98124008)</option>
```
Extract: entityId=51990, classId=107, full label for display.

**Per-meter login:** Since each meter selection changes the session context, the safest approach is to login fresh for each meter download. This avoids session conflicts when downloading multiple meters sequentially.

**Files modified:**
- `supabase/functions/fetch-pnpscada/index.ts` -- Rewrite `downloadMeterCSV` and update `list-meters` to use the correct endpoints

