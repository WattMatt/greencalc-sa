

## SwiftLaTeX-Powered Proposal Builder (Overleaf-Style)

### Overview

Replace the current HTML/PDFShift proposal pipeline with an in-browser LaTeX compiler (SwiftLaTeX) that produces real PDFs directly in the browser. The workspace will feature an Overleaf-style split-pane layout: **LaTeX source editor on the left, live PDF preview on the right**, with the existing sidebar for toggling content blocks, branding, and templates.

### Layout

```text
[Sidebar (content/branding/template)] | [LaTeX Editor] | [PDF Preview]
                                       <-- resizable -->
```

- The sidebar remains unchanged (toggle sections, branding, templates, export buttons)
- The current single A4 HTML preview pane becomes a resizable split using the existing `react-resizable-panels` library
- Left pane: monospace LaTeX source editor with line numbers
- Right pane: rendered PDF displayed via an embedded `<iframe>` or `<object>` showing the compiled PDF blob URL

### How It Works

1. When the user opens the Proposal Workspace, the system **auto-generates a complete `.tex` document** from their project data (simulation results, branding, financial projections, tenant data, etc.)
2. The LaTeX source appears in the editor pane
3. **SwiftLaTeX's WASM engine** compiles the `.tex` source to a PDF binary entirely in-browser -- no server round-trips
4. The compiled PDF is displayed in the preview pane
5. Users can **edit the LaTeX source directly** to customize wording, spacing, or layout
6. A "Reset to Auto-Generated" button regenerates the LaTeX from the current sidebar settings
7. "Export PDF" downloads the compiled PDF blob directly -- no external API needed

### Package Fetching

SwiftLaTeX fetches LaTeX packages (e.g., `geometry`, `graphicx`, `booktabs`, `xcolor`) on demand from CTAN the first time they're used. After the initial fetch, they're cached in the browser. The proposal template will use common packages that compile quickly.

### New Files

| File | Purpose |
|------|---------|
| `src/lib/latex/SwiftLaTeXEngine.ts` | Singleton wrapper around SwiftLaTeX WASM -- handles `loadEngine()`, `writeMemFSFile()`, `compileLaTeX()`, and PDF blob creation |
| `src/lib/latex/templates/proposalTemplate.ts` | Generates a complete `.tex` string from `SimulationData`, `ProposalBranding`, `ContentBlock[]`, project data, and tenants |
| `src/lib/latex/templates/snippets.ts` | Reusable LaTeX snippet generators for each content block (cover page, financial table, cashflow table, site overview, etc.) |
| `src/components/proposals/latex/LaTeXEditor.tsx` | Left pane: `<textarea>` with monospace font, line numbers via CSS counters, and basic editing features |
| `src/components/proposals/latex/PDFPreview.tsx` | Right pane: renders the compiled PDF via `<iframe src={blobUrl}>` with loading/error states |
| `src/components/proposals/latex/LaTeXWorkspace.tsx` | Split-pane container using `ResizablePanelGroup` combining editor + preview, manages compilation lifecycle |

### Modified Files

| File | Change |
|------|--------|
| `src/pages/ProposalWorkspace.tsx` | Replace the current A4 HTML preview section with `<LaTeXWorkspace>`. Wire sidebar data into the template generator. Replace `handleExportPDF` to download the compiled PDF blob directly. |
| `src/components/proposals/ProposalSidebar.tsx` | No structural changes -- "Export PDF" button continues to call the parent's export handler, which now triggers PDF blob download instead of PDFShift |

### Technical Details

**Engine Lifecycle:**
- SwiftLaTeX WASM files (~5MB) are loaded lazily on first use
- A loading spinner is shown during engine initialization
- The engine instance is cached as a module-level singleton
- Compilation is triggered on a 500ms debounce after source changes

**Template Generation:**
- Each enabled content block maps to a LaTeX section function
- When the user toggles a section in the sidebar, the `.tex` source regenerates
- Branding colors are mapped to `\definecolor` commands using the `xcolor` package
- Logo images are embedded as base64 data URIs using `\includegraphics` with a temporary file written to the WASM filesystem via `writeMemFSFile`
- Financial tables use the `booktabs` package for professional styling
- Charts are generated as inline TikZ/pgfplots or as SVG images embedded in the document

**Compilation Flow:**
```text
Sidebar change --> generateLatexSource(data) --> editor updates
                                              --> debounce 500ms
                                              --> engine.writeMemFSFile("main.tex", source)
                                              --> engine.compileLaTeX()
                                              --> PDF blob --> iframe preview
```

**PDF Export:**
- The compiled PDF binary is already available from `compileLaTeX()`
- Export simply creates a Blob and triggers a download -- zero external API calls
- The existing PDFShift integration (`capturePreview.ts`) remains intact for other report types but is bypassed for proposals

**LaTeX Packages Used:**
- `geometry` -- A4 page margins
- `graphicx` -- Logo/image embedding
- `xcolor` -- Brand color definitions
- `booktabs` -- Professional table styling
- `tabularx` -- Flexible column widths
- `fancyhdr` -- Headers and footers with branding
- `hyperref` -- Clickable links
- `tikz`/`pgfplots` -- Charts (payback, energy flow)
- `fontenc`, `inputenc` -- UTF-8 support

**Editor Features (Phase 1):**
- Monospace textarea with line numbers
- Tab key inserts spaces (not focus change)
- Auto-generated source is fully editable
- "Reset" button to regenerate from sidebar settings
- Error display panel showing LaTeX compilation errors/warnings

### SwiftLaTeX Integration

SwiftLaTeX is loaded via a `<script>` tag pointing to the WASM distribution files hosted in the `public/` directory. The files needed are:
- `swiftlatexpdftex.js` (JS glue)
- `swiftlatexpdftex.wasm` (WASM binary)

These will be placed in `public/swiftlatex/` and loaded dynamically.

### No Database Changes

No schema modifications needed. The generated LaTeX source string can optionally be stored in the existing `proposals` table's JSON fields for persistence in a future enhancement.

### Migration Path

- The existing PDFShift pipeline stays intact for sandbox reports and other exports
- Only the Proposal Workspace switches to LaTeX
- If SwiftLaTeX compilation fails, the user sees the error in the editor pane and can fix the LaTeX source directly

