

# Plan: Storage-first CSV retrieval with re-upload message

## Changes

### File 1: `src/components/loadprofiles/MeterLibrary.tsx` (lines 862-898)

Reorder `loadMeterForWizard` to check storage **first**:

1. Call `downloadCsvFromStorage(meterId)` immediately after fetching the meter record
2. If storage returns CSV, use it
3. Only if storage returns null, check legacy `rawData[0].csvContent`
4. If neither exists, show error: **"The original CSV file is not available. Please re-upload the file to save and preview the data."**

### File 2: `src/components/loadprofiles/SitesTab.tsx` (lines 1016-1057)

Same reordering:

1. After fetching meter, call `downloadCsvFromStorage(meterId)` first
2. Fall back to the existing legacy `csvContent` extraction logic only if storage returns null
3. If neither exists, update error message to: **"The original CSV file is not available. Please re-upload the file to save and preview the data."**

### No other files change

- `CsvImportWizard` already renders the `wizardError` message — no changes needed there
- `uploadCsvToStorage` already runs on all new imports — no changes needed
- No database changes

