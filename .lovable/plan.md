

# Fix: Eskom Re-extraction Deletes Data But Doesn't Reset Batch State

## Root Cause

The extraction actually works -- 16 Miniflex tariffs were successfully inserted into the database (confirmed by logs and `extraction_runs` table). However, the data disappears because of a state management bug in the re-extraction flow:

1. User clicks "Re-extract" (in `FileUploadImport.tsx`)
2. Frontend **deletes all `tariff_plans`** for Eskom Direct (lines 323-328)
3. Frontend calls `process-tariff-file` edge function
4. Edge function checks `eskom_batch_status` table -- all 15 batches are still marked **"completed"** from the previous run
5. The auto-skip loop finds no pending batches, returns `{ allComplete: true, totalTariffs: 16 }` (stale count from batch_status)
6. Result: 0 tariffs in the database, UI shows "0 tariffs"

## Fix (Two Changes)

### Change 1: Edge function -- auto-reset stale batch statuses

In `supabase/functions/process-tariff-file/index.ts`, after finding existing batch records, check if all batches are "completed" but the municipality has 0 tariff plans. If so, reset all batches to "pending" so extraction can run again.

```text
// After line ~663 (existingBatches check)
if (existingBatches && existingBatches.length > 0) {
  const allCompleted = existingBatches.every(b => b.status === "completed");
  
  if (allCompleted) {
    // Check if tariff_plans actually exist -- if not, batches are stale
    const { count: actualTariffCount } = await supabase
      .from("tariff_plans")
      .select("*", { count: "exact", head: true })
      .eq("municipality_id", muniData.id);
    
    if (!actualTariffCount || actualTariffCount === 0) {
      // Stale batch state: tariffs were deleted but batches weren't reset
      console.log("Resetting stale Eskom batch statuses -- tariffs were deleted");
      await supabase.from("eskom_batch_status")
        .update({ status: "pending", tariffs_extracted: 0, updated_at: new Date().toISOString() })
        .eq("municipality_id", muniData.id);
    }
  }
}
```

This ensures that if tariffs were deleted (by re-extract or manual deletion), the batch status automatically resets so extraction can proceed.

### Change 2: FileUploadImport -- reset batch status on re-extract

In `src/components/tariffs/FileUploadImport.tsx`, inside `handleReextractTariffs`, after deleting tariff plans, also delete the `eskom_batch_status` records so the edge function starts fresh:

```text
// After line 327 (delete tariff_plans)
if (muni.name.toLowerCase().includes("eskom")) {
  await supabase.from("eskom_batch_status").delete().eq("municipality_id", muniData.id);
}
```

### Change 3: Deploy and reset current stale data

1. Reset the current `eskom_batch_status` records to "pending" so the user can immediately retry
2. Deploy the updated edge function

## Files Modified

1. **`supabase/functions/process-tariff-file/index.ts`** -- Add stale batch detection and auto-reset
2. **`src/components/tariffs/FileUploadImport.tsx`** -- Reset batch status on re-extract
3. Deploy edge function + reset DB state
