

## Fix PDF Preview Blocked by MS Edge

### Problem
The LaTeX compilation via texlive.net is working correctly (returns valid PDF). However, Microsoft Edge blocks `blob:` URLs from rendering inside iframes, especially within nested iframe contexts like the Lovable preview window. This causes the "blocked" icon you see.

### Solution
Convert the PDF blob to a **base64 data URL** (`data:application/pdf;base64,...`) instead of using `URL.createObjectURL()`. Data URLs are treated as inline content and are not blocked by Edge's security policies.

### Files to Change

| File | Change |
|------|--------|
| `src/lib/latex/SwiftLaTeXEngine.ts` | Replace `URL.createObjectURL(blob)` with a base64 data URL conversion |
| `src/components/proposals/latex/PDFPreview.tsx` | Use `<object>` tag instead of `<iframe>` for better cross-browser PDF rendering |

### Technical Details

**1. `SwiftLaTeXEngine.ts`** -- Convert blob to data URL

- Add a helper function `blobToDataUrl(blob: Blob): Promise<string>` using `FileReader`
- Replace `URL.createObjectURL(blob)` with `await blobToDataUrl(blob)`
- Remove the `lastBlobUrl` tracking and `URL.revokeObjectURL()` calls (data URLs don't need revoking)

**2. `PDFPreview.tsx`** -- Use `<object>` tag

- Replace `<iframe src={pdfUrl}>` with `<object data={pdfUrl} type="application/pdf">`
- The `<object>` tag has better cross-browser support for embedded PDFs
- Add a fallback link inside `<object>` for browsers that still can't render it

### Why This Works

- `blob:` URLs are treated as cross-origin resources by Edge in nested iframe contexts and get blocked
- `data:` URLs are treated as inline content and bypass this restriction
- The `<object>` tag is the W3C-recommended way to embed PDFs and has fewer security restrictions than `<iframe>`

