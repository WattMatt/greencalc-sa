

## Fix AI Tariff Extraction for PDFs + Add PDF Preview Toggle

### Problem Summary

Two issues need to be addressed:

1. **AI tariff extraction produces 0 results for PDF municipalities** - When extracting tariffs for a specific municipality from a PDF (e.g., POLOKWANE), the edge function passes the entire PDF text to the AI without instructing it to focus on the specific municipality's section. For multi-municipality PDFs, the AI gets overwhelmed by data from 14+ municipalities and may fail to isolate the correct one. Additionally, the `municipalityText` for PDFs is the full `extractedText` which can be very large.

2. **Comparison dialog shows 0 raw data rows for PDFs** - The "preview" action in the edge function (line 385-394) only handles Excel files. For PDFs, it returns empty `previewData`, so the left pane shows "0 rows". The user wants to toggle between the raw extracted text and the actual PDF image on the left pane.

### Solution

#### Part 1: Fix PDF Tariff Extraction

**File: `supabase/functions/process-tariff-file/index.ts`**

Update the PDF branch in the extract-tariffs action (lines 564-566) to:

1. Instead of passing the entire `extractedText` to the AI, filter the text to only the section relevant to the target municipality
2. Use a regex/heuristic to find the municipality's section boundaries in the extracted text (municipality names in SA tariff PDFs are typically uppercase headers like `POLOKWANE - 14.59%`)
3. Pass only the relevant section (plus some surrounding context) to the extraction prompt
4. Add the municipality name prominently in the extraction prompt so the AI focuses on it

The current code:
```
} else {
  municipalityText = extractedText;
}
```

Will become logic that:
- Searches `extractedText` for the municipality name as a section boundary
- Extracts text from that municipality header until the next municipality header
- Falls back to the full text if no section boundary is found, but adds explicit instructions to focus on the named municipality

#### Part 2: Fix PDF Preview (Raw Data) in Comparison Dialog

**File: `supabase/functions/process-tariff-file/index.ts`** - Update the `preview` action:

For PDFs, instead of returning empty data, return the extracted text split into rows for display. Also return a flag indicating this is a PDF so the UI knows to offer the PDF image toggle.

Add to the preview response:
- `isPdf: true` flag
- `extractedTextRows`: The AI-extracted text split by newlines for table display
- `pdfFilePath`: The storage path so the UI can render the actual PDF

#### Part 3: Add PDF/Text Toggle in Comparison Dialog

**File: `src/components/tariffs/FileUploadImport.tsx`** - Update the left pane:

Add a toggle switch next to the "Raw Document Data" header:
- **Text mode** (default): Shows the AI-extracted text as rows (current table view)
- **PDF mode**: Renders the actual PDF using the existing pdf.js canvas renderer or an iframe/object embed

This requires:
1. Adding a `viewMode` state: `"text" | "pdf"`
2. Adding a `Switch` toggle component next to the "Raw Document Data" title
3. In PDF mode, downloading the file from storage and rendering it (similar to `FilePreviewDialog.tsx`)
4. Updating `PreviewData` interface to include `isPdf`, `extractedTextRows`, and `pdfFilePath`

### Technical Details

#### Edge Function Changes (`process-tariff-file/index.ts`)

**Preview action (~line 377)**:
- Add PDF handling: when `fileType === "pdf"`, return `{ isPdf: true, extractedTextRows: extractedText.split('\n'), pdfFilePath: filePath, municipality, sheetTitle: municipality, rowCount: lineCount }`

**Extract-tariffs action (~line 564)**:
- For PDFs, find the municipality section using regex: `/MUNICIPALITY_NAME.*?(?=\n[A-Z]{3,}.*?\d+[\.,]\d+%|\Z)/s`
- Pass only the relevant section (up to 15,000 chars) to the AI
- Add explicit instruction: `"Focus ONLY on tariffs for ${municipality}. Ignore data for other municipalities."`

#### UI Changes (`FileUploadImport.tsx`)

1. Update `PreviewData` interface to add `isPdf?: boolean` and `pdfFilePath?: string`
2. Add state: `const [leftPaneMode, setLeftPaneMode] = useState<"text" | "pdf">("text")`
3. Add a `Switch` import from shadcn/ui
4. In the left pane header, add: `{previewData?.isPdf && <Switch checked={leftPaneMode === "pdf"} onCheckedChange={...} />}` with labels "Text" / "PDF"
5. When in PDF mode, download the file from `tariff-uploads` storage and render via `<object>` tag (same pattern as `FilePreviewDialog.tsx`)

### Files Changed

| File | Change |
|---|---|
| `supabase/functions/process-tariff-file/index.ts` | Fix PDF preview action to return extracted text; fix PDF extract-tariffs to filter by municipality section |
| `src/components/tariffs/FileUploadImport.tsx` | Add PDF/Text toggle switch on left pane; handle PDF preview data; render PDF inline |

