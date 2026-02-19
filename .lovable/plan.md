

## Fix: Import `Buffer` for Deno Compatibility

### What Broke
`Buffer` is a Node.js global that doesn't exist in the Deno edge runtime. The previous edit used `Buffer.from(uint8Array)` without importing it, causing an immediate `ReferenceError`.

### Fix
Add one line before the `Buffer.from()` call:

```typescript
const { Buffer } = await import("node:buffer");
```

### File Changed

| File | Change |
|---|---|
| `supabase/functions/process-tariff-file/index.ts` | Add `Buffer` import from `node:buffer` inside the PDF block, before `pdfParse(Buffer.from(...))` |

### After
Redeploy the function and verify logs show successful text extraction instead of the `Buffer is not defined` error.

