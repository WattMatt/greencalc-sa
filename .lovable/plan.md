
# Fix: Auto-Skip Non-Matching Eskom PDF Batches in Single Call

## Problem

When extracting from an Eskom PDF that only contains one tariff family (e.g. Miniflex), the system processes batches one-at-a-time across multiple function calls. The first batch is "Megaflex" (index 0), which isn't in the PDF, so it returns `{inserted: 0}`. The user must click "Extract" repeatedly (up to 15 times) to cycle through all batches until reaching the one that actually matches.

## Solution

In the `process-tariff-file` edge function, when processing Eskom PDF batches, wrap the batch-skip logic in a **loop**. If the current batch name is not found in the PDF text, mark it as completed and immediately move to the next batch -- all within the same function call. Only return when either:
1. A matching batch is found (proceed to AI extraction), or
2. All batches are exhausted (return the "all complete" summary)

## Technical Change

**File:** `supabase/functions/process-tariff-file/index.ts`

### Current Flow (lines ~663-720)
```text
1. Find next pending batch
2. If PDF doesn't contain batch name → mark complete, return {inserted: 0}
3. If PDF contains batch name → proceed to AI extraction
```

### New Flow
```text
1. LOOP: Find next pending batch
2.   If no pending batch → return "all complete" summary
3.   If PDF doesn't contain batch name → mark complete with 0, CONTINUE LOOP
4.   If PDF contains batch name → BREAK loop, proceed to AI extraction
```

Specifically, after the batch status insert (line ~660) and the `nextBatch` query (line ~663), wrap the PDF batch-matching check (lines ~702-718) inside a `while` loop that:
- Marks non-matching batches as completed (0 tariffs)
- Queries for the next pending batch
- Continues until a match is found or all batches are done

This keeps the Excel path unchanged (Excel files typically contain all batch sheets, so single-batch-per-call is fine there).

## Files Modified

1. **`supabase/functions/process-tariff-file/index.ts`** -- Add loop around PDF batch skipping logic
2. Redeploy edge function
