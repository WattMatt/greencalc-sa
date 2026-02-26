

# Restructure Eskom to Match Province/Municipality Hierarchy

## Current State
- Eskom has a single municipality "Eskom Direct"
- Special `isEskom` branch in TariffList.tsx renders `EskomTariffMatrix` directly (family tabs like Miniflex/Megaflex)
- This looks different from other provinces (e.g. Limpopo -> Ba-Phalaborwa -> period groups)

## Desired State
Eskom should follow the same visual hierarchy as other provinces:

```text
Eskom (province level)
├── Non-Local Authority (municipality level, like "Ba-Phalaborwa")
│   ├── 1 Jun 2024 – 31 May 2025 (period group)
│   │   ├── Miniflex <= 300km < 500V
│   │   ├── Miniflex <= 300km >= 500V & < 66kV
│   │   └── ...
│   └── other periods...
└── Local Authority (municipality level)
    └── periods...
```

## Changes

### 1. Rename municipality in database
Rename "Eskom Direct" to "Non-Local Authority" and create a "Local Authority" municipality under Eskom for future use.

### 2. Remove special Eskom rendering in TariffList.tsx
**File:** `src/components/tariffs/TariffList.tsx` (lines 604-642)

Remove the entire `isEskom` branch that auto-loads tariffs and renders `EskomTariffMatrix`. Instead, let Eskom fall through to the standard municipality accordion code path (same as Limpopo, Gauteng, etc.). This gives Eskom:
- Municipality-level accordion (Non-Local Authority / Local Authority)
- Period subgroups within each municipality (Calendar icon + date range)
- Standard tariff cards with expand/collapse for rate details

### 3. Update extraction pipeline batch descriptions
**File:** `supabase/functions/process-tariff-file/index.ts`

Update the Eskom batch configurations to tag tariffs with their authority type. Non-local authority tariffs should be assigned to the "Non-Local Authority" municipality, and local authority variants (when extracted) to "Local Authority".

### Summary
| Item | Change |
|------|--------|
| Database | Rename "Eskom Direct" -> "Non-Local Authority"; create "Local Authority" municipality |
| `TariffList.tsx` | Remove `isEskom` special branch (lines 604-642); use standard municipality accordion |
| `process-tariff-file/index.ts` | Update municipality name references in Eskom batches |

