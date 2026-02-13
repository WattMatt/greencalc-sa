

## Fix: Council Demand CSV Source Uses Filename Instead of Hardcoded "csv"

### Problem

When uploading a Council Demand CSV, the source is hardcoded as `"csv"` (line 143 in `BuildingLoadCard.tsx`). The solar/actual generation upload correctly uses the original filename (e.g., `31190 - Parkdene Solar Checkers`), but the council upload does not.

This causes:
- The "csv" entry appearing in the Source Guarantees dropdown
- Inability to map council readings to a meaningful source label

### Fix

**File: `src/components/projects/generation/BuildingLoadCard.tsx`**

1. Add a `pendingFileName` state variable (same pattern as `ActualGenerationCard.tsx`)
2. Capture the filename when the user selects a file in `handleCSVUpload` (line 193)
3. Pass the filename through to `saveCSVTotals`
4. Replace the hardcoded `source: "csv"` (line 143) with the sanitized filename: `pendingFileName.replace(/\.csv$/i, "").trim() || "csv"`
5. Update the auto-created source guarantee label (line 156) to also use the filename instead of defaulting to `"Council Supply"` or `"csv"`

### Technical Details

```text
Current flow:
  file selected -> text extracted -> CSV dialog -> saveCSVTotals(totals, ...) 
                                                    -> source: "csv" (hardcoded)

Fixed flow:
  file selected -> filename stored in state -> CSV dialog -> saveCSVTotals(totals, ..., fileName)
                                                              -> source: "31190 - Parkdene..." (from file)
```

Changes:
- Add state: `const [pendingFileName, setPendingFileName] = useState("")`
- In `handleCSVUpload` (line 193): add `setPendingFileName(files[0].name)`
- In `saveCSVTotals`, use filename as source for upsert (line 143) and for the guarantee label (line 156/175)
- The source guarantee `source_label` will still default to "Council Supply" as the display name, but the `reading_source` on the guarantee row will store the actual filename for mapping

This makes council uploads consistent with solar uploads and removes the stale "csv" entry from the source dropdown.
