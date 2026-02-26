

# Prepopulate Eskom Tariff Batch Definitions from Official 2025/2026 Booklet

## What We're Fixing

The current `eskomBatches` array in the extraction edge function has 15 batches, but it's missing some tariff families and incorrectly groups others. The official Eskom Tariffs & Charges Booklet 2025/2026 lists the following distinct tariff sections that need individual extraction focus.

## Updated Batch List (from the PDF table of contents)

The following is the complete list of Eskom tariff families, mapped to batches. Changes from the current list are marked.

| # | Batch Name | Category | Description | Change |
|---|-----------|----------|-------------|--------|
| 1 | Megaflex | industrial | Urban TOU for large customers (>1MVA NMD), Non-LA | Unchanged |
| 2 | MunicFlex | bulk_reseller | Bulk TOU for local authorities (>=16kVA NMD) | Unchanged |
| 3 | Megaflex Gen | industrial | Generator variant of Megaflex, Non-LA | **NEW** (was grouped with Megaflex) |
| 4 | Miniflex | industrial | Urban TOU for 25kVA-5MVA NMD, Non-LA | Unchanged |
| 5 | Nightsave Urban | industrial | Urban seasonally differentiated TOU, Non-LA | **SPLIT** (was grouped with Rural) |
| 6 | Businessrate | commercial | Urban commercial up to 100kVA NMD, Non-LA | Unchanged |
| 7 | Municrate | bulk_reseller | Bulk tariff for local authorities up to 100kVA | Unchanged |
| 8 | Public Lighting | public_lighting | Non-metered urban tariff, Non-LA and LA | Unchanged |
| 9 | Homepower | domestic | Standard and Bulk residential, Non-LA (up to 100kVA) | Unchanged (covers Standard + Bulk variants) |
| 10 | Homeflex | domestic | Residential TOU for grid-tied generation, Non-LA | Unchanged |
| 11 | Homelight | domestic | Subsidised tariff for low-usage households, Non-LA | Unchanged |
| 12 | Ruraflex | agricultural | Rural TOU from 16kVA NMD, Non-LA | Unchanged |
| 13 | Ruraflex Gen | agricultural | Generator variant of Ruraflex, Non-LA | **NEW** (was grouped with Ruraflex) |
| 14 | Nightsave Rural | agricultural | Rural seasonally differentiated TOU, Non-LA | **SPLIT** (was grouped with Urban) |
| 15 | Landrate | agricultural | Conventional rural tariff up to 100kVA, Non-LA | Unchanged |
| 16 | Landlight | domestic | Rural lighting tariff for low-usage, Non-LA | **NEW** (was missing entirely) |
| 17 | Generator Tariffs | industrial | TUoS/DUoS network charges, ancillary services, gen-wheeling/offset/purchase | Unchanged |

**Removed**: "WEPS" (Wholesale Electricity Pricing System -- not a standard retail tariff, rarely extracted from PDFs) and "Excess NCC" (not in the booklet as a standalone tariff family).

## Technical Changes

### File: `supabase/functions/process-tariff-file/index.ts`

**Lines ~636-652**: Replace the `eskomBatches` array with the updated 17-batch list derived from the official booklet. Each batch gets:
- Accurate `name` matching the PDF heading
- Updated `sheets` search terms for text matching
- Correct `description` from the booklet
- A `category` field to drive `eskomFamilyCategory()` mapping directly

**Category mapping**: Update `eskomFamilyCategory()` to handle the new families (Landlight -> domestic, Megaflex Gen -> industrial, Ruraflex Gen -> agricultural, Nightsave Urban -> industrial, Nightsave Rural -> agricultural).

### Deployment

Re-deploy the `process-tariff-file` edge function after the update.

## Impact

- No database changes needed
- No frontend changes needed
- Existing extraction logic and batch status tracking continues to work
- The next Eskom extraction will use the corrected 17-batch list, producing more accurate and complete tariff coverage
