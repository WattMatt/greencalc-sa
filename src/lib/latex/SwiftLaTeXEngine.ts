/**
 * Singleton wrapper around SwiftLaTeX's PdfTeX WASM engine.
 * Loads the engine lazily, provides compile + PDF blob helpers.
 */

declare global {
  interface Window {
    PdfTeXEngine: new () => SwiftLaTeXInstance;
  }
}

interface SwiftLaTeXInstance {
  loadEngine(): Promise<void>;
  isReady(): boolean;
  writeMemFSFile(filename: string, content: string | Uint8Array): void;
  setEngineMainFile(filename: string): void;
  compileLaTeX(): Promise<{
    pdf: Uint8Array | undefined;
    status: number;
    log: string;
  }>;
  flushCache(): void;
}

const CDN_BASE = "https://cdn.jsdelivr.net/gh/SwiftLaTeX/SwiftLaTeX@v20022022/pdftex.wasm/";

let engineInstance: SwiftLaTeXInstance | null = null;
let engineLoading: Promise<SwiftLaTeXInstance> | null = null;
let scriptLoaded = false;

function loadScript(): Promise<void> {
  if (scriptLoaded) return Promise.resolve();

  return new Promise(async (resolve, reject) => {
    try {
      // Fetch both files in parallel
      const [mainResp, workerResp] = await Promise.all([
        fetch(`${CDN_BASE}PdfTeXEngine.js`),
        fetch(`${CDN_BASE}swiftlatexpdftex.js`),
      ]);
      if (!mainResp.ok) throw new Error(`Failed to fetch PdfTeXEngine.js: ${mainResp.status}`);
      if (!workerResp.ok) throw new Error(`Failed to fetch swiftlatexpdftex.js: ${workerResp.status}`);

      let scriptText = await mainResp.text();
      const workerText = await workerResp.text();

      // Create a same-origin blob URL for the worker to avoid CORS restrictions
      const workerBlob = new Blob([workerText], { type: "application/javascript" });
      const workerBlobUrl = URL.createObjectURL(workerBlob);

      // Patch the worker path to use the same-origin blob URL
      scriptText = scriptText.replace(
        /var\s+ENGINE_PATH\s*=\s*['"]swiftlatexpdftex\.js['"]/,
        `var ENGINE_PATH = '${workerBlobUrl}'`
      );

      // Expose PdfTeXEngine on window (the script puts it on a local `exports` var)
      scriptText += `\nwindow.PdfTeXEngine = PdfTeXEngine;\n`;

      // Inject as a blob script
      const blob = new Blob([scriptText], { type: "application/javascript" });
      const blobUrl = URL.createObjectURL(blob);

      const script = document.createElement("script");
      script.src = blobUrl;
      script.onload = () => {
        scriptLoaded = true;
        URL.revokeObjectURL(blobUrl);
        resolve();
      };
      script.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        reject(new Error("Failed to execute patched SwiftLaTeX script"));
      };
      document.head.appendChild(script);
    } catch (err) {
      reject(err);
    }
  });
}

export async function getEngine(): Promise<SwiftLaTeXInstance> {
  if (engineInstance?.isReady()) return engineInstance;

  if (engineLoading) return engineLoading;

  engineLoading = (async () => {
    await loadScript();

    if (!window.PdfTeXEngine) {
      throw new Error("PdfTeXEngine not found on window after script load");
    }

    const engine = new window.PdfTeXEngine();
    await engine.loadEngine();
    engineInstance = engine;
    return engine;
  })();

  return engineLoading;
}

export interface CompileResult {
  pdf: Blob | null;
  pdfUrl: string | null;
  log: string;
  success: boolean;
}

let lastBlobUrl: string | null = null;

export async function compileLatex(source: string): Promise<CompileResult> {
  const engine = await getEngine();

  engine.writeMemFSFile("main.tex", source);
  engine.setEngineMainFile("main.tex");

  const result = await engine.compileLaTeX();

  if (lastBlobUrl) {
    URL.revokeObjectURL(lastBlobUrl);
    lastBlobUrl = null;
  }

  if (result.pdf && result.pdf.length > 0) {
    const blob = new Blob([result.pdf.buffer as ArrayBuffer], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    lastBlobUrl = url;
    return { pdf: blob, pdfUrl: url, log: result.log, success: true };
  }

  return { pdf: null, pdfUrl: null, log: result.log, success: false };
}

export async function writeFile(filename: string, content: string | Uint8Array) {
  const engine = await getEngine();
  engine.writeMemFSFile(filename, content);
}

export function downloadPdf(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
