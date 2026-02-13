

## Fix: Load _Graph with Full Parameters Before CSV Download

### Root Cause
The `_DataDownload` endpoint returns 0 bytes because the server hasn't prepared any data. The `_Graph` page must be loaded with the **full set of parameters** (date range, meter serial, display toggles, TIMEMODE, etc.) before `_DataDownload` will work. Our current code only loads `_Graph?memh={memh}` -- missing all the context parameters.

### What the Browser Does (Working Flow)
1. Login -> overview -> select meter -> load `_Graph?memh=...` (initial load)
2. User clicks "Choose Dates" -> sets date range -> clicks Submit
3. Submit triggers `newDateRange()` -> `generatePressed()` which reloads `_Graph` with ALL parameters:
   ```
   /_Graph?hasTariffs=true&hasBills=false&hasCustomers=false
     &memh={memh}&hasTOU=$hasTOU&doBill=1
     &GSTARTH=0&GSTARTN=0&GENDH=0&GENDN=0
     &TRIGHT0=False&TLEFT0=True&...
     &GINCY=2026&GINCM=1&GINCD=1
     &TIMEMODE=2
     &selGNAME_UTILITY=31177$Electricity
     &TGIDX=0
   ```
4. This prepares the data on the server. THEN `_DataDownload` works.

### The Fix

Update the `selectMeter` function to load `_Graph` with the full parameter set including the date range and meter serial. This means the `selectMeter` function needs to accept `serial`, `startDate`, and `endDate` parameters.

### Changes to `supabase/functions/fetch-pnpscada/index.ts`

**1. Update `selectMeter` signature and _Graph URL**

Change `selectMeter` to accept date range and serial, then construct the full `_Graph` URL:

```typescript
async function selectMeter(
  jar: CookieJar, memh: string, 
  entityId: string, classId: string, 
  serial: string, startDate: string, endDate: string
): Promise<{ memh: string; graphHtml: string }>
```

Step 2 (load graph page) changes from:
```
_Graph?memh={memh}
```
To the full URL matching what the browser sends:
```
_Graph?hasTariffs=true&hasBills=false&hasCustomers=false
  &memh={memh}&hasTOU=$hasTOU&doBill=1
  &GSTARTH=0&GSTARTN=0&GENDH=0&GENDN=0
  &TRIGHT0=False&TLEFT0=True&TRIGHT1=False&TLEFT1=True
  &TRIGHT2=False&TLEFT2=True&TRIGHT3=False&TLEFT3=True
  &TRIGHT4=False&TLEFT4=True&TRIGHT5=False&TLEFT5=True
  &TLEFT6=False&TRIGHT6=True
  &GINCY={year}&GINCM={month}&GINCD=1
  &TIMEMODE=2
  &selGNAME_UTILITY={serial}$Electricity
  &TGIDX=0
```

The date parameters `GINCY/GINCM/GINCD` represent the "Including" period (set to the start of the requested month). The actual From/To dates are set via `GSTARTD/GSTARTM/GSTARTY` and `GENDD/GENDM/GENDY` which appear in the `_DataDownload` URL.

**2. Update `downloadMeterCSV` to pass serial and dates to `selectMeter`**

Update the call from:
```typescript
selectMeter(session.jar, session.memh, entityId, classId)
```
To:
```typescript
selectMeter(session.jar, session.memh, entityId, classId, serial, startDate, endDate)
```

**3. Add a small delay after loading the graph**

The user mentioned the graph "updates after five seconds" -- the server may need a moment to prepare data. Add a 2-3 second delay after loading the full `_Graph` page before hitting `_DataDownload`.

### Files Modified
- `supabase/functions/fetch-pnpscada/index.ts` -- Update `selectMeter` to build full `_Graph` URL with all parameters, update callers, add delay before download

