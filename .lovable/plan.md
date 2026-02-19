

## Improve Fuzzy Matcher and Show All Expected Municipalities

### Problem

1. **Fuzzy matching is too rigid**: The known-name scan uses exact `includes()` which misses spelling variations like "MOOKGOPHOONG" (document) vs "Modimolle-Mookgophong" (database). The `findBestMatch` function only does basic contains/starts-with checks.

2. **No visibility into missing municipalities**: The extraction response only returns municipalities that were found in the document. There is no way to see which municipalities from the database were NOT found, making it hard to spot gaps.

### Solution

**1. Enhance fuzzy matching with Levenshtein distance and normalisation**

Update `supabase/functions/process-tariff-file/index.ts`:

- Improve the known-name scan (lines 275-284) to use normalised fuzzy matching instead of exact `includes()`:
  - Strip common suffixes like "Local Municipality", hyphens, spaces
  - Collapse consecutive duplicate vowels (e.g., "oo" matches "o")  
  - Use a simple Levenshtein-based similarity check (threshold ~80%) for short names
  - Check individual words from multi-word municipality names

- Improve the `findBestMatch` function (lines 353-374) to add:
  - Levenshtein distance calculation with a similarity threshold
  - Word-level matching for compound names (e.g., "MODIMOLLE" found in text should match "Modimolle-Mookgophong")

**2. Return all known municipalities in the response**

Update the response at line 427-430 to include the full list of known municipalities for the province, each marked as `found: true/false`. This way the UI can display:
- Found municipalities (matched from document)
- Missing municipalities (expected but not found in document)

**3. Update the frontend to display all expected municipalities**

Update `src/components/tariffs/FileUploadImport.tsx` to show:
- A list of matched municipalities (as currently, ready for extraction)
- A separate section showing municipalities NOT found in the document, so the user can see what is missing

### Technical Details

**Edge function changes** (`supabase/functions/process-tariff-file/index.ts`):

- Add a `levenshteinDistance` function and a `similarity` helper
- Update `normaliseName` to also strip hyphens and collapse repeated vowels
- In the known-name scan, for each known municipality, check fuzzy similarity against each line/word-group in the extracted text (not just exact includes)
- In `findBestMatch`, add a Levenshtein similarity step (>=80% threshold) before returning null
- Change the response shape to include `allKnown` alongside `municipalities`:

```text
Response shape:
{
  success: true,
  province: "Limpopo",
  provinceId: "...",
  municipalities: [...found ones...],
  allKnown: [
    { id, name, found: true },
    { id, name, found: false },
    ...
  ],
  total: 15,
  totalKnown: 22,
  errors: []
}
```

**Frontend changes** (`src/components/tariffs/FileUploadImport.tsx`):

- After extraction, display the `allKnown` list grouped into "Found in Document" and "Not Found in Document"
- The "Not Found" section uses a muted/warning style so the user can quickly see which municipalities are missing
- Only the "Found" municipalities proceed to the tariff extraction phase

### Files Modified

- `supabase/functions/process-tariff-file/index.ts` -- improved fuzzy matching + return all known municipalities
- `src/components/tariffs/FileUploadImport.tsx` -- display all expected vs found municipalities
