

## Fix CORS Error for SwiftLaTeX Web Worker

### Problem

The patched `PdfTeXEngine.js` tries to create a Web Worker using `new Worker('https://cdn.jsdelivr.net/gh/..../swiftlatexpdftex.js')`. Browsers block cross-origin Worker construction -- the worker script must come from the same origin.

### Solution

Instead of patching `ENGINE_PATH` to point at the CDN URL, we need to **fetch the worker script as well**, wrap it in a Blob URL (which is same-origin), and patch `ENGINE_PATH` to use that Blob URL.

### Implementation

**File: `src/lib/latex/SwiftLaTeXEngine.ts`** -- Update `loadScript()`:

1. Fetch **both** files from the CDN in parallel:
   - `PdfTeXEngine.js` (the main API)
   - `swiftlatexpdftex.js` (the Web Worker)

2. Create a Blob URL for the worker script (`swiftlatexpdftex.js`)

3. Patch `PdfTeXEngine.js` to set `ENGINE_PATH` to the worker's Blob URL instead of the CDN URL

4. Append `window.PdfTeXEngine = PdfTeXEngine;` as before

5. Inject the patched main script as a Blob `<script>` tag

The key change is just two extra lines: fetch the worker file, create a blob URL for it, and use that blob URL as the `ENGINE_PATH`. Everything else stays the same.

### Technical Detail

```text
Current (broken):
  ENGINE_PATH = 'https://cdn.jsdelivr.net/.../swiftlatexpdftex.js'
  --> new Worker(ENGINE_PATH) --> CORS error

Fixed:
  1. fetch('https://cdn.jsdelivr.net/.../swiftlatexpdftex.js') --> workerText
  2. workerBlobUrl = URL.createObjectURL(new Blob([workerText]))
  3. ENGINE_PATH = workerBlobUrl  (blob: URL = same origin)
  --> new Worker(ENGINE_PATH) --> works
```

Note: The worker blob URL should NOT be revoked since `PdfTeXEngine` may re-create workers during its lifecycle.

### Files to Modify

| File | Change |
|------|--------|
| `src/lib/latex/SwiftLaTeXEngine.ts` | Fetch worker script, create blob URL for it, patch ENGINE_PATH to blob URL |

