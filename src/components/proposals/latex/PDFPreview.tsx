import { useEffect, useRef, useState } from "react";
import { Loader2, AlertCircle, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface PDFPreviewProps {
  pdfData: Uint8Array | null;
  isCompiling: boolean;
  error: string | null;
  log: string | null;
}

export function PDFPreview({ pdfData, isCompiling, error, log }: PDFPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  // Load and render PDF from raw bytes
  useEffect(() => {
    if (!pdfData) return;

    let cancelled = false;

    async function render() {
      try {
        const doc = await pdfjsLib.getDocument({ data: pdfData }).promise;
        if (cancelled) return;
        pdfDocRef.current = doc;
        setNumPages(doc.numPages);
        setPageNum(1);
        await renderPage(doc, 1);
      } catch (err) {
        console.error("pdf.js render error:", err);
      }
    }

    render();
    return () => { cancelled = true; };
  }, [pdfData]);

  // Re-render on page change
  useEffect(() => {
    if (pdfDocRef.current && pageNum > 0) {
      renderPage(pdfDocRef.current, pageNum);
    }
  }, [pageNum]);

  async function renderPage(doc: pdfjsLib.PDFDocumentProxy, num: number) {
    const page = await doc.getPage(num);
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const containerWidth = container.clientWidth;
    const unscaledViewport = page.getViewport({ scale: 1 });
    const scale = containerWidth / unscaledViewport.width;
    const viewport = page.getViewport({ scale });

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    await page.render({ canvasContext: ctx, viewport }).promise;
  }

  if (isCompiling && !pdfData) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-muted/20 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Compiling LaTeX…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-3 py-2 border-b bg-destructive/10">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <span className="text-xs font-medium text-destructive">Compilation Error</span>
        </div>
        <pre className="flex-1 p-4 text-xs font-mono overflow-auto text-destructive/80 whitespace-pre-wrap">
          {log || error}
        </pre>
      </div>
    );
  }

  if (!pdfData) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-muted/20 gap-3">
        <FileText className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">PDF preview will appear here</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {isCompiling && (
        <div className="flex items-center gap-2 px-3 py-1 border-b bg-muted/50">
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Recompiling…</span>
        </div>
      )}
      {numPages > 1 && (
        <div className="flex items-center justify-center gap-2 px-3 py-1 border-b bg-muted/30">
          <button onClick={() => setPageNum(p => Math.max(1, p - 1))} disabled={pageNum <= 1} className="p-1 disabled:opacity-30">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs text-muted-foreground">{pageNum} / {numPages}</span>
          <button onClick={() => setPageNum(p => Math.min(numPages, p + 1))} disabled={pageNum >= numPages} className="p-1 disabled:opacity-30">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
      <div ref={containerRef} className="flex-1 overflow-auto bg-muted/10 flex justify-center p-4">
        <canvas ref={canvasRef} className="shadow-lg" />
      </div>
    </div>
  );
}
