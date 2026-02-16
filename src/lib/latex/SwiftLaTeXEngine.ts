/**
 * Singleton wrapper around SwiftLaTeX's PdfTeX WASM engine.
 * Loads the engine lazily, provides compile + PDF blob helpers.
 */

// SwiftLaTeX exposes PdfTeXEngine on the window after the script loads
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

const SWIFTLATEX_CDN = "https://cdn.jsdelivr.net/gh/nicoglennon/swiftlatex-dist@0.0.3/";

let engineInstance: SwiftLaTeXInstance | null = null;
let engineLoading: Promise<SwiftLaTeXInstance> | null = null;
let scriptLoaded = false;

function loadScript(): Promise<void> {
  if (scriptLoaded) return Promise.resolve();

  return new Promise((resolve, reject) => {
    // SwiftLaTeX needs to know where the WASM file lives
    const existing = document.querySelector('script[data-swiftlatex]');
    if (existing) {
      scriptLoaded = true;
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = `${SWIFTLATEX_CDN}swiftlatexpdftex.js`;
    script.setAttribute("data-swiftlatex", "true");
    script.onload = () => {
      scriptLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error("Failed to load SwiftLaTeX script"));
    document.head.appendChild(script);
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

  // Revoke previous blob URL to prevent memory leaks
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
