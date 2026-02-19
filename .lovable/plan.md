

## Add Effective Date Fields to TariffBuilder and FileUploadImport Review Step

### Overview

Two gaps were identified after the multi-period feature implementation. The `effective_from` and `effective_to` date columns exist in the database and are supported in the TariffEditDialog and AI extraction, but are missing from:

1. **TariffBuilder** -- manual tariff creation has no way to set effective dates
2. **FileUploadImport review step** -- no UI to view or override the dates that the AI extracted (or to set them if the AI did not find any)

---

### Change 1: TariffBuilder -- Add Effective Date Inputs

**File:** `src/components/tariffs/TariffBuilder.tsx`

- Add two new state variables: `effectiveFrom` and `effectiveTo` (both `string`, default `""`)
- Add two date `<Input type="date">` fields in the "Basic Info" grid (after the existing fields like Amperage Limit), labelled "Effective From" and "Effective To"
- Include both values in the `.insert()` call to `tariff_plans` (lines 91-104), mapping empty strings to `null`
- Add both to the `resetForm()` function

This is a small, self-contained change -- two inputs, two state variables, and a two-field addition to the insert payload.

---

### Change 2: FileUploadImport -- Add Date Fields to Review Step

**File:** `src/components/tariffs/FileUploadImport.tsx`

- Extend the `ExtractedTariffPreview` interface with `effective_from?: string | null` and `effective_to?: string | null`
- In the Phase 3 review UI (the tariff card/accordion where each extracted tariff is shown), add two small date inputs per tariff for effective dates
- These fields should be pre-populated if the AI extracted dates, and editable by the user
- When the user clicks "Save" on an individual tariff (the existing `saveEditedTariff` function), include `effective_from` and `effective_to` in the update payload to `tariff_plans`
- When initially receiving extracted tariffs from the edge function response, map any `effective_from`/`effective_to` fields from the AI response into the preview state

---

### Technical Details

#### TariffBuilder State Additions
```text
const [effectiveFrom, setEffectiveFrom] = useState("");
const [effectiveTo, setEffectiveTo] = useState("");
```

#### TariffBuilder Insert Payload Addition
```text
effective_from: effectiveFrom || null,
effective_to: effectiveTo || null,
```

#### ExtractedTariffPreview Interface Update
```text
interface ExtractedTariffPreview {
  // ...existing fields...
  effective_from?: string | null;
  effective_to?: string | null;
}
```

#### Files Modified

| File | Change |
|---|---|
| `src/components/tariffs/TariffBuilder.tsx` | Add `effectiveFrom`/`effectiveTo` state, date inputs in form grid, include in insert payload and resetForm |
| `src/components/tariffs/FileUploadImport.tsx` | Extend `ExtractedTariffPreview` interface, add date inputs to review card, include in save payload, map from AI response |

