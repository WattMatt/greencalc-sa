
## Rename "Import CSV" to "Import" and Support Excel Files

### Overview
Rename the "Import CSV" button to "Import" and extend the file input to accept Excel files (.xlsx, .xls) alongside CSV. When an Excel file is selected, it will be converted to CSV text using the already-installed `xlsx` library before being passed to the existing CSV Import Wizard.

### Changes

**File: `src/components/projects/TenantManager.tsx`**

1. Add `import * as XLSX from 'xlsx'` at the top
2. Change the file input `accept` attribute from `".csv"` to `".csv,.xlsx,.xls"`
3. Rename button label from `"Import CSV"` to `"Import"`
4. Update `handleFileUpload` to detect Excel files by extension:
   - If `.xlsx` or `.xls`: read as ArrayBuffer, parse with `XLSX.read()`, convert the first sheet to CSV using `XLSX.utils.sheet_to_csv()`, then pass to the wizard
   - If `.csv`: keep current behaviour (read as text)

### No Other Files Affected
The downstream `CsvImportWizard` already works with CSV text content, so no changes are needed there. The `xlsx` package is already installed.
