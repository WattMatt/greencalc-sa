
## Fix: Missing 15th Municipality During PDF Extraction

### Problem

The regex-based municipality extraction from Limpopo PDFs only finds 14 of the 15 municipalities present in the document. The regex requires names in ALL CAPS followed by a percentage pattern (e.g., `POLOKWANE - 12.72%`). If a municipality's entry in the PDF has slightly different formatting (no percentage, different casing, line breaks, etc.), it gets missed entirely.

### Root Cause

The extraction relies solely on two regex patterns:
1. `^([A-Z][A-Z\s\-\/]+?)\s*[-–]\s*\d+[\.,]\d+%` (name dash percentage)
2. `^([A-Z][A-Z\s\-\/]+?)\s+\d+[\.,]\d+%` (name space percentage)

If a municipality appears in the document without a trailing percentage, or with different formatting, neither regex catches it.

### Solution

Add a **complementary known-name scan** after the regex pass. Since the database already contains all 22 official Limpopo municipalities, scan the extracted PDF text for occurrences of each known municipality name. Any known name found in the text that was NOT already captured by regex gets added to the list.

### Changes

**File: `supabase/functions/process-tariff-file/index.ts`** (lines ~263-301)

After the regex pass (line 263), before the `municipalityNames = [...regexMatches]` assignment:

1. Fetch the known municipalities for this province from the database (this already happens later at line 315, so we move it earlier or duplicate the lookup).
2. For each known municipality name, check if it appears in `extractedText` (case-insensitive).
3. Add any found names that are not already in the regex matches.
4. This ensures that even if the regex misses a municipality, the known-name scan catches it.

```text
Pseudocode:
  // After regex pass
  const knownForProvince = await fetchKnownMunicipalities(province);
  for (const known of knownForProvince) {
    const upperName = known.name.toUpperCase();
    if (extractedText.toUpperCase().includes(upperName)) {
      regexMatches.add(known.name);  // Use canonical name
    }
  }
```

This is a minimal, safe change:
- It only adds municipalities that actually appear in the document text
- It uses the canonical DB name (not raw text), so fuzzy matching downstream works perfectly
- It does not remove or change the existing regex logic
- It runs before the AI fallback, so the AI path is only used if both regex AND known-name scan find nothing

### Files Modified

- `supabase/functions/process-tariff-file/index.ts` -- add known-name text scan after regex extraction
