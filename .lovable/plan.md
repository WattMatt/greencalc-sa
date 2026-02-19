

## Fix: PDF Extraction — Single Approach with pdf-parse

### Problem
The pdf-parse code was written but **never actually deployed** — the logs still show the old vision API version running, which is now returning 500 errors from the gateway. On top of that, the current code has unnecessary fallback logic that makes things complicated.

### Evidence
- Logs say: `"Processing PDF file - using AI vision..."` 
- Code says: `"Processing PDF file - extracting text with pdf-parse..."`  
- The deployed version is stale. The vision API is returning `500 {"type":"internal_server_error","message":"","details":""}`.

### Solution
Rewrite the PDF section to use **only** `pdf-parse` — a library that extracts text directly from the PDF bytes. No API call, no gateway, no fallback chain. One approach.

### Changes

**File:** `supabase/functions/process-tariff-file/index.ts` (lines 175-228)

Replace the entire PDF block with:

```typescript
} else if (fileType === "pdf") {
  console.log("Processing PDF file...");
  const uint8Array = new Uint8Array(await fileData.arrayBuffer());
  console.log("PDF size:", uint8Array.length, "bytes");
  
  const pdfParse = (await import("npm:pdf-parse@1.1.1")).default;
  const pdfData = await pdfParse(Buffer.from(uint8Array));
  extractedText = pdfData.text || "";
  console.log("PDF text extracted, length:", extractedText.length);
  
  if (!extractedText.trim()) {
    return new Response(
      JSON.stringify({ error: "Could not extract text from this PDF. It may be a scanned image — please try Excel format instead." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
```

Key points:
- No vision API, no fallback, no fallback-of-fallback
- If the PDF is a scanned image with no text, it tells the user clearly instead of silently failing
- Wrapping the whole thing in a try/catch at the outer level already handles unexpected errors

### Deployment
After editing, explicitly deploy the function and verify the logs show the new `"Processing PDF file..."` message (not the old one).

### Files Modified

| File | Change |
|---|---|
| `supabase/functions/process-tariff-file/index.ts` | Replace PDF extraction block with single pdf-parse approach, remove all vision API fallback code |

