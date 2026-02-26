
# Fix Eskom PDF Tariff Import (Batch Skipping Bug)

## Problem

When you upload an Eskom PDF (like the Miniflex booklet), the import AI skips all batches with "0 tariffs extracted" because the batch-matching logic is designed for Excel files only.

The root cause is in `supabase/functions/process-tariff-file/index.ts`, lines 700-717. For Eskom extractions, the code filters `sheetNames` by batch keywords (e.g. `["miniflex nla", "miniflex"]`). But for PDF uploads, `sheetNames` is always an empty array -- PDFs have no sheets. So `batchSheets` is always empty, and every batch immediately returns with `{ inserted: 0 }` without ever sending the PDF text to the AI.

## Solution

Update the Eskom extraction path in the edge function to handle PDFs differently from Excel files:

1. **For PDF files**: Skip the sheet-matching logic entirely. Instead, check if the PDF text content matches the current batch by searching the extracted text for the batch name (e.g. "Miniflex"). If found, pass the full PDF text to the AI for extraction. If not found, skip that batch gracefully.

2. **Fix the municipalityText assembly for Eskom PDFs**: Currently at line 730-732, when it is a PDF, it overwrites `municipalityText` with just the raw text without the batch context. The fix will prepend the batch focus context so the AI knows which tariff family to extract.

## Technical Changes

**File:** `supabase/functions/process-tariff-file/index.ts`

### Change 1: PDF-aware batch matching (lines ~699-732)

Replace the current Eskom batch text building with:

```text
if (isEskomExtraction) {
  const currentBatch = eskomBatches[currentBatchIndex];
  
  if (fileType === "pdf") {
    // For PDFs: check if batch name appears in the extracted text
    const batchNameLower = currentBatch.name.toLowerCase();
    const textLower = extractedText.toLowerCase();
    const hasBatchContent = textLower.includes(batchNameLower);
    
    if (!hasBatchContent) {
      // This PDF doesn't contain this batch's tariff family - skip
      await supabase.from("eskom_batch_status")
        .update({ status: "completed", tariffs_extracted: 0, ... })
        ...
      return ...;
    }
    
    // Pass full PDF text with batch context
    municipalityText = `BATCH FOCUS: ${currentBatch.name}\n${currentBatch.description}\n\n${extractedText.slice(0, 15000)}`;
  } else {
    // Existing Excel sheet-matching logic (unchanged)
    ...
  }
}
```

This ensures that:
- When a Miniflex PDF is uploaded, the "Miniflex" batch finds the text and extracts it
- Other batches (Megaflex, Nightsave, etc.) are correctly skipped because their names don't appear in the PDF
- The AI receives the proper batch context prefix so it knows which tariff family to focus on

### Change 2: Deploy edge function

Redeploy `process-tariff-file` after the code change.

## Files Modified

1. **`supabase/functions/process-tariff-file/index.ts`** -- Fix Eskom PDF batch matching logic
