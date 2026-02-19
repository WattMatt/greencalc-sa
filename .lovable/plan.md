

## Seed All South African Municipalities and Improve Extraction Matching

### Problem

Currently, only Limpopo has municipalities in the database (16 entries, some with incorrect names like "LIMPOPO PROVINCE BAPHALABORWA"). All other provinces have zero municipalities. During tariff extraction, the AI creates municipality names on the fly from whatever text it finds in the PDF, leading to inconsistent and incorrect entries.

### What Changes

**1. Seed all 213 municipalities (205 local + 8 metropolitan) into the database**

A database migration will insert all official South African municipalities mapped to their correct provinces. This includes:
- 8 Metropolitan municipalities (Buffalo City, Cape Town, Ekurhuleni, Johannesburg, Tshwane, eThekwini, Mangaung, Nelson Mandela Bay)
- 205 Local municipalities across all 9 provinces

The existing 16 Limpopo entries will be cleaned up -- duplicates removed (e.g. "BELA-BELA" and "BELABELA"), incorrect entries fixed (e.g. "LIMPOPO PROVINCE BAPHALABORWA" to "Ba-Phalaborwa").

**2. Update the tariff extraction edge function to use known municipality names**

The `process-tariff-file` edge function will be updated so that during the "extract-municipalities" phase, instead of blindly trusting regex/AI-extracted names, it:
- Fetches the pre-seeded municipality list for the selected province from the database
- Uses fuzzy matching to map extracted names to known municipalities
- Only creates new entries if there is genuinely no match (with a warning)
- Passes the canonical municipality names to downstream extraction steps

**3. Feed known municipality names into AI extraction prompts**

When the AI extracts tariff data, the prompt will include the list of known municipality names for that province, so the AI can match against them rather than inventing its own.

### Technical Details

**Database Migration: Seed municipalities**
- INSERT all 213 municipalities with correct `province_id` references
- Use ON CONFLICT to avoid duplicating any that already exist
- Clean up the existing Limpopo entries (rename malformed ones, remove duplicates)
- Each municipality uses its official name (e.g. "Polokwane", "Ba-Phalaborwa", "City of Tshwane")

**File: `supabase/functions/process-tariff-file/index.ts`**

In the `extract-municipalities` action (lines 229-358):
- After extracting raw names from regex/AI, fetch all known municipalities for the province from DB
- Implement a `findBestMatch(extractedName, knownMunicipalities)` function that uses normalised string comparison (lowercase, strip "local municipality", strip province codes, Levenshtein-like contains matching)
- Map each extracted name to its canonical DB entry where possible
- Return matched municipalities with a `matched: true/false` flag so the UI can show which ones were auto-matched vs newly created

In the `extract-tariffs` action (lines 397+):
- Add the list of known municipality names for the province to the AI prompt context
- This helps the AI correctly attribute tariff data to the right municipality name

**Province-to-Municipality Count (approximate):**

```text
Eastern Cape:      31 local + 2 metro = 33
Free State:        18 local + 1 metro = 19
Gauteng:            6 local + 3 metro =  9
KwaZulu-Natal:     37 local + 1 metro = 38
Limpopo:           22 local           = 22
Mpumalanga:        17 local           = 17
North West:        18 local           = 18
Northern Cape:     26 local           = 26
Western Cape:      20 local + 1 metro = 21
Eskom:              1 (Eskom Direct)  =  1
```

### Files Modified

- **Database migration** -- seed ~213 municipality records, clean up existing Limpopo data
- **`supabase/functions/process-tariff-file/index.ts`** -- add known-name matching logic and prompt enhancement

