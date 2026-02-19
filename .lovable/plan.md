
## Fix PDF Preview and Raw Data Display in Tariff Comparison

### Problems Identified

1. **PDF preview shows "PDF preview not supported in this browser"** - The current implementation uses an `<object>` tag with a blob URL to render PDFs. This approach is blocked in sandboxed iframes (the Lovable preview environment). The project already has a working pdf.js canvas-based renderer (`PDFPreview.tsx`) that solves this exact problem.

2. **Raw data shows AI JSON output instead of human-readable text** - When toggling to "Text" mode, the left pane displays the AI's JSON response (e.g., `"municipality": "BAPHALABO"`) because `extractedText` for PDFs contains the AI vision model's structured output, not the raw document text. This is expected for PDFs since we can only get text via AI vision, but the display format is confusing.

3. **Preview loading is slow** - The "Preview" button calls the edge function which re-downloads and re-processes the entire PDF through AI vision just to show the raw data. This is inherently slow for large multi-page PDFs.

### Solution

#### Part 1: Replace `<object>` tag with pdf.js Canvas Renderer

**File: `src/components/tariffs/FileUploadImport.tsx`**

- Remove the `<object>` tag approach for PDF rendering
- Instead, when the user toggles to "PDF" mode, download the PDF from storage as an `ArrayBuffer`/`Uint8Array` and store it in state
- Render it using pdf.js directly (canvas-based), following the same pattern as `PDFPreview.tsx`
- Add basic page navigation (prev/next) since tariff PDFs are multi-page
- This approach works reliably across all browsers including sandboxed iframes

Changes:
1. Replace `pdfBlobUrl` state with `pdfArrayBuffer: Uint8Array | null` state
2. When toggle switches to PDF mode, download the file and convert to `Uint8Array`
3. Replace the `<object>` block with an inline pdf.js canvas renderer (simplified version of `PDFPreview.tsx` with page navigation)
4. Import `pdfjs-dist` and configure the worker (same as existing `PDFPreview.tsx`)

#### Part 2: Improve Raw Text Display for PDFs

**No edge function changes needed.** The extracted text from AI vision is the best we can get for PDFs. However, the current display as single-column rows of JSON is confusing.

In `FileUploadImport.tsx`, when `previewData.isPdf` is true and the data looks like JSON (starts with triple backticks or `[`), clean up the display:
- Strip markdown code fences (the triple backtick lines)
- Display as formatted text rather than a table with row numbers, since this is AI-extracted content not tabular data

### Technical Details

#### pdf.js Inline Renderer (embedded in FileUploadImport.tsx)

```text
State additions:
  - pdfUint8: Uint8Array | null (replaces pdfBlobUrl)
  - pdfPageNum: number (current page, default 1)
  - pdfNumPages: number (total pages)

On toggle to PDF mode:
  1. Download from supabase.storage.from("tariff-uploads").download(pdfFilePath)
  2. Convert blob to Uint8Array
  3. Store in pdfUint8 state

Rendering:
  - useEffect watches pdfUint8 + pdfPageNum
  - Loads document with pdfjsLib.getDocument({ data: pdfUint8 })
  - Renders current page to a canvas element
  - Simple prev/next buttons for page navigation
```

#### Cleanup on resetState / dialog close:
- Set `pdfUint8` to null (no URL.revokeObjectURL needed since we're not using blob URLs)

### Files Changed

| File | Change |
|---|---|
| `src/components/tariffs/FileUploadImport.tsx` | Replace `<object>` PDF rendering with pdf.js canvas renderer; add page navigation; improve raw text display for PDF-extracted JSON content |
