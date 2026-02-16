

## Fix SwiftLaTeX Script Loading

### Problem

The SwiftLaTeX engine fails to load because the CDN URL points to a **non-existent GitHub repository** (`nicoglennon/swiftlatex-dist`). This is the root cause of the "Failed to load SwiftLaTeX script" error.

Additionally, the current code assumes `PdfTeXEngine` is attached to `window` after the script loads, but the actual SwiftLaTeX `PdfTeXEngine.js` file puts it on a local `exports` object and uses a **Web Worker** architecture -- it spawns a separate worker file (`swiftlatexpdftex.js`) that contains the actual WASM engine.

### Root Cause Summary

1. **Invalid CDN URL**: `nicoglennon/swiftlatex-dist` does not exist on GitHub
2. **Wrong script file**: The code tries to load `swiftlatexpdftex.js` as a `<script>` tag, but that file is the Web Worker (not the main API)
3. **Wrong global access**: `PdfTeXEngine` is not placed on `window` by the script

### Solution

The correct CDN base is:
```
https://cdn.jsdelivr.net/gh/SwiftLaTeX/SwiftLaTeX@v20022022/pdftex.wasm/
```

This directory contains:
- `PdfTeXEngine.js` -- the main API class (12KB) -- this is what we load as a `<script>`
- `swiftlatexpdftex.js` -- the Web Worker that `PdfTeXEngine.js` spawns internally

However, there's a complication: `PdfTeXEngine.js` uses `var exports = {}` and puts the class on that local variable, not `window`. And the Web Worker path is hardcoded as `ENGINE_PATH = 'swiftlatexpdftex.js'` (relative), meaning the worker file must be accessible at the same origin path.

### Implementation Plan

**File: `src/lib/latex/SwiftLaTeXEngine.ts`** -- Complete rewrite of the loading logic:

1. Change the CDN base URL to the correct one: `https://cdn.jsdelivr.net/gh/SwiftLaTeX/SwiftLaTeX@v20022022/pdftex.wasm/`

2. Instead of loading `PdfTeXEngine.js` as a script tag (which doesn't export to `window`), fetch it as text and modify it to work:
   - Fetch `PdfTeXEngine.js` from the CDN
   - Replace the hardcoded `ENGINE_PATH = 'swiftlatexpdftex.js'` with the full CDN URL so the Web Worker can be loaded cross-origin
   - Append `window.PdfTeXEngine = PdfTeXEngine;` so the class is accessible
   - Create a Blob URL from the modified script and inject it as a `<script>` tag

3. Keep the rest of the engine wrapper (compile, blob management, download) the same -- those parts work correctly once the engine loads.

### Technical Details

The modified script injection will look like:

```text
1. Fetch PdfTeXEngine.js from CDN as text
2. Replace: var ENGINE_PATH = 'swiftlatexpdftex.js'
   With:    var ENGINE_PATH = '<full CDN URL>/swiftlatexpdftex.js'
3. Append:  window.PdfTeXEngine = PdfTeXEngine;
4. Create Blob URL from modified text
5. Inject as <script src="blob:...">
6. On load, window.PdfTeXEngine is available
```

The Web Worker (`swiftlatexpdftex.js`) will be loaded by `PdfTeXEngine.js` internally using `new Worker(ENGINE_PATH)`, and since we patch the path to the full CDN URL, it will fetch correctly.

### Files to Modify

| File | Change |
|------|--------|
| `src/lib/latex/SwiftLaTeXEngine.ts` | Fix CDN URL, rewrite `loadScript()` to fetch + patch + inject the script properly |

No other files need changes -- the editor, preview, workspace, and template components are all working correctly. The only issue is the engine script failing to load.

