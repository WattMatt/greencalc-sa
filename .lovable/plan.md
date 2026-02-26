

# Fix AI Model and Eskom Tariff List UI

## 1. Change AI Model Back to Gemini 2.5 Pro

**File:** `supabase/functions/process-tariff-file/index.ts` (line 882)

Change the Eskom extraction model from `google/gemini-2.5-flash-lite` to `google/gemini-2.5-pro`:

```typescript
// Before
const aiModel = isEskomExtraction ? "google/gemini-2.5-flash-lite" : "google/gemini-2.5-flash";

// After
const aiModel = isEskomExtraction ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash";
```

This restores the more capable model for complex Eskom table extraction (Miniflex zone/voltage grids).

## 2. Remove "Eskom Direct" Municipality Bounding Box

**Problem:** When you expand the "Eskom" province accordion, it shows an inner "Eskom Direct" municipality accordion with its own bounding box, Preview button, and delete button. Since Eskom is always direct (there's only ever one "municipality" under Eskom), this extra nesting is redundant and causes confusion.

**Solution:** In `src/components/tariffs/TariffList.tsx`, detect when the province is "Eskom" and skip the municipality-level accordion entirely. Instead, render the `EskomTariffMatrix` directly inside the province accordion content, with the family tabs (Miniflex, Megaflex, etc.) acting as the second level -- matching the visual hierarchy of "Province -> Municipality" used by other provinces like "Limpopo -> Ba-Phalaborwa".

**File:** `src/components/tariffs/TariffList.tsx` (lines 603-686)

In the `AccordionContent` for each province, add a check:

```
if province is Eskom:
  - Auto-load tariffs for the single Eskom Direct municipality
  - Render EskomTariffMatrix directly (no municipality accordion wrapper)
  - Keep the delete button at the province level (already exists)
else:
  - Render the existing municipality-level accordion (unchanged)
```

The `EskomTariffMatrix` component already groups tariffs by family (Miniflex, Megaflex, etc.) using tabs and shows them with proper headers, so it naturally provides the second level of hierarchy without needing the "Eskom Direct" wrapper.

**Changes to `EskomTariffMatrix`** are not needed -- it already renders family groups with the right styling (Card with Zap icon + family name + description + tariff count badge). This matches the style of municipality headers in other provinces.

## 3. Fix Collapsible Not Working on Miniflex Box

The collapse issue is likely caused by the `EskomTariffMatrix` component wrapping each family in a `Card` inside `TabsContent`. Since the family tabs handle navigation, the individual tariff cards within each family use `Collapsible` correctly. The real issue is the outer "Eskom Direct" municipality accordion intercepting click events. Removing that wrapper (step 2) should fix this.

## Summary of Edits

| File | Change |
|------|--------|
| `supabase/functions/process-tariff-file/index.ts` | Change Eskom AI model to `google/gemini-2.5-pro` |
| `src/components/tariffs/TariffList.tsx` | Skip municipality accordion for Eskom; render EskomTariffMatrix directly |

Redeploy the edge function after changes.

