

## Fix: Add Error Logging to PDF Vision API Call

### Problem
The PDF analysis is failing silently. When the AI vision API returns an error, the edge function just sets `extractedText = "PDF extraction failed"` without logging the HTTP status or error body. This makes it impossible to diagnose why.

### Root Cause
This is NOT caused by the date regex change. The vision API call (line 181-197 of the edge function) is returning a non-200 response, but the error is swallowed silently at line 206-207.

### Changes

**File:** `supabase/functions/process-tariff-file/index.ts`

1. Add error logging when the vision API fails -- log the HTTP status and response body so we can see what went wrong:

```typescript
} else {
  const errBody = await visionRes.text();
  console.error("Vision API failed:", visionRes.status, errBody);
  extractedText = "PDF extraction failed - please try Excel format";
}
```

2. Also log the base64 payload size so we know if the PDF is too large:

```typescript
console.log("PDF base64 size:", base64.length, "bytes");
```

### Expected Outcome
After deploying, re-upload the file. The edge function logs will now show exactly why the vision API is rejecting the request (e.g., payload too large, auth error, model issue). We can then apply the correct fix based on the actual error.

### Files Modified

| File | Change |
|---|---|
| `supabase/functions/process-tariff-file/index.ts` | Add error logging for vision API failures and PDF payload size |

