

## Replace SwiftLaTeX with texlive.net Server-Side Compilation

### Problem
The in-browser SwiftLaTeX WASM engine fails to load (404 on CDN files, CORS issues with Web Workers). Overleaf cloud doesn't expose a public compilation API.

### Solution
Use **texlive.net** for LaTeX compilation via a backend function proxy. This gives access to the full TeX Live distribution with zero setup.

### Architecture

```text
Browser                    Edge Function              texlive.net
  |                            |                          |
  |-- POST /compile-latex ---->|                          |
  |   { source: "..." }       |-- POST multipart/form -->|
  |                            |   filecontents[]=source  |
  |                            |   filename[]=document.tex|
  |                            |   engine=pdflatex        |
  |                            |   return=pdf             |
  |                            |<---- PDF binary ---------|
  |<---- PDF blob -------------|                          |
```

### Files to Change

| File | Action | Description |
|------|--------|-------------|
| `supabase/functions/compile-latex/index.ts` | **Create** | Edge function that proxies compilation to texlive.net |
| `src/lib/latex/SwiftLaTeXEngine.ts` | **Rewrite** | Remove all WASM/script code; call edge function instead |
| `src/components/proposals/latex/LaTeXWorkspace.tsx` | **Simplify** | Remove engine loading state and spinner |

### Implementation Details

**1. Edge Function (`supabase/functions/compile-latex/index.ts`)**

- CORS headers for browser access
- Accepts `POST` with `{ source: string }`
- Builds `multipart/form-data` with fields: `filecontents[]`, `filename[]`, `engine=pdflatex`, `return=pdf`
- Sends to `https://texlive.net/cgi-bin/latexcgi`
- If response is `application/pdf`, returns PDF binary
- If response is text (compilation error), returns `{ error: true, log: "..." }`

**2. Rewrite `SwiftLaTeXEngine.ts`**

- Remove: `getEngine()`, `loadScript()`, `writeFile()`, all WASM globals, CDN constants, `Window` type augmentation
- Keep: `CompileResult` interface, `downloadPdf()` helper
- New `compileLatex(source)`: POST to edge function, return `{ pdf, pdfUrl, log, success }`

**3. Simplify `LaTeXWorkspace.tsx`**

- Remove `engineReady`, `engineLoading` state variables
- Remove engine-loading `useEffect` and the loading spinner
- The debounced compile calls `compileLatex()` directly on mount
- Editor and PDF preview panels stay exactly the same

### What Stays Unchanged

- LaTeX editor component
- PDF preview component (iframe-based)
- Template generation (proposalTemplate.ts, snippets)
- 800ms debounce behavior
- Download/export functionality

