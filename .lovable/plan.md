

## Auto-Extract Province and Dates from File Name

### Overview

When a user selects a file like `Limpopo_Province_Tariffs_20250601_20260531.pdf`, the system will automatically pre-fill the province dropdown and two new date fields. All values remain fully editable.

---

### File Name Pattern

Based on the example `Limpopo_Province_Tariffs_20250601_20260531.pdf`, the parser will:

1. **Province**: Match any known province name in the filename (underscores/hyphens treated as spaces, case-insensitive). The word "Province" is stripped. So `Limpopo_Province` matches "Limpopo".
2. **Dates**: Look for `YYYYMMDD` patterns (8-digit sequences). The first match becomes `effective_from`, the second becomes `effective_to`. Dates are formatted as `YYYY-MM-DD` for the date inputs.

### Example Parsing Results

```text
"Limpopo_Province_Tariffs_20250601_20260531.pdf"
  -> province: "Limpopo", effectiveFrom: "2025-06-01", effectiveTo: "2026-05-31"

"KwaZulu-Natal_Tariffs_20240701_20250630.xlsx"
  -> province: "KwaZulu-Natal", effectiveFrom: "2024-07-01", effectiveTo: "2025-06-30"

"Eskom_Schedule_20250101.pdf"
  -> province: "Eskom", effectiveFrom: "2025-01-01"

"random_file.pdf"
  -> no matches, user selects manually as before
```

---

### Changes

**File:** `src/components/tariffs/FileUploadImport.tsx`

1. Add a `parseFileNameMetadata(fileName)` function that:
   - Normalises the filename (replace underscores/hyphens with spaces, remove extension)
   - Matches against `SOUTH_AFRICAN_PROVINCES` (case-insensitive, ignoring the word "Province")
   - Extracts `YYYYMMDD` date patterns and converts to `YYYY-MM-DD`
   - Returns `{ province?, effectiveFrom?, effectiveTo? }`

2. Add two state variables: `effectiveFrom` and `effectiveTo` (strings, default `""`)

3. In `handleFileSelect`, after setting the file, call the parser and auto-fill:
   - Province dropdown (if matched)
   - `effectiveFrom` and `effectiveTo` fields (if dates found)

4. Add two `<Input type="date">` fields in the Phase 1 UI, below the Province selector, labelled "Effective From" and "Effective To". Disabled once extraction begins.

5. Pass `effectiveFrom` and `effectiveTo` to the edge function in `handleExtractTariffs` and `handleReextractTariffs` body payloads, so the AI uses them as defaults when no dates are found in the document.

**File:** `supabase/functions/process-tariff-file/index.ts`

6. Accept optional `effectiveFrom` and `effectiveTo` in the request body for the `extract-tariffs` action.
7. When inserting tariff plans, use these as fallback values if the AI did not extract dates from the document content.

---

### Technical Detail: Parser Function

```text
function parseFileNameMetadata(fileName: string) {
  const nameOnly = fileName.replace(/\.[^.]+$/, "");        // strip extension
  const normalised = nameOnly.replace(/[_\-]/g, " ");       // underscores/hyphens to spaces

  // Province: match against known list, ignoring "Province"
  const cleaned = normalised.replace(/\bProvince\b/gi, "").trim();
  const province = SOUTH_AFRICAN_PROVINCES.find(p =>
    cleaned.toLowerCase().includes(p.toLowerCase())
  );

  // Dates: find YYYYMMDD patterns
  const dateMatches = nameOnly.match(/\b(\d{8})\b/g) || [];
  const dates = dateMatches
    .map(d => `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`)
    .filter(d => !isNaN(new Date(d).getTime()));

  return {
    province: province || undefined,
    effectiveFrom: dates[0] || undefined,
    effectiveTo: dates[1] || undefined,
  };
}
```

### Files Modified

| File | Change |
|---|---|
| `src/components/tariffs/FileUploadImport.tsx` | Add parser function, state variables, date inputs in Phase 1 UI, pass dates to edge function |
| `supabase/functions/process-tariff-file/index.ts` | Accept and use fallback dates from request body |

