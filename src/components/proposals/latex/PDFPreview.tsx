import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, AlertCircle, FileText, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as pdfjsLib from "pdfjs-dist";

// Use the full worker (not .mjs) for broader browser compatibility including Safari on Mac
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
  const [pageInput, setPageInput] = useState("1");
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  // 0 = fit-to-width
  const [userScale, setUserScale] = useState(0);
  const [displayScale, setDisplayScale] = useState(1);

  // Drag-to-pan state
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  const renderPage = useCallback(async (doc: pdfjsLib.PDFDocumentProxy, num: number) => {
    try {
      const page = await doc.getPage(num);
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const unscaledViewport = page.getViewport({ scale: 1 });

      let scale: number;
      if (userScale === 0) {
        // fit-to-width
        scale = (container.clientWidth - 32) / unscaledViewport.width;
      } else {
        scale = userScale;
      }

      setDisplayScale(scale);
      const viewport = page.getViewport({ scale });

      // Use devicePixelRatio for sharp rendering on Retina/HiDPI displays (Mac)
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      await page.render({ canvasContext: ctx, viewport }).promise;
    } catch (err) {
      console.error("Error rendering PDF page:", err);
    }
  }, [userScale]);

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
        setPageInput("1");
        await renderPage(doc, 1);
      } catch (err) {
        console.error("pdf.js render error:", err);
      }
    }

    render();
    return () => { cancelled = true; };
  }, [pdfData]);

  useEffect(() => {
    if (pdfDocRef.current && pageNum > 0) {
      renderPage(pdfDocRef.current, pageNum);
    }
  }, [pageNum, userScale]);

  // Re-render on container resize when in fit-to-width mode
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      if (userScale === 0 && pdfDocRef.current && pageNum > 0) {
        renderPage(pdfDocRef.current, pageNum);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [userScale, pageNum, renderPage]);



  const zoomIn = () => setUserScale(prev => {
    const current = prev === 0 ? displayScale : prev;
    return Math.min(current + 0.25, 5);
  });

  const zoomOut = () => setUserScale(prev => {
    const current = prev === 0 ? displayScale : prev;
    return Math.max(current - 0.25, 0.25);
  });

  const fitToWidth = () => setUserScale(0);

  // Ctrl+Scroll (or Cmd+Scroll on Mac) to zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setUserScale(prev => {
          const current = prev === 0 ? displayScale : prev;
          return Math.min(Math.max(current + delta, 0.25), 5);
        });
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [displayScale]);

  // Middle-click drag OR left-click drag to pan
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Middle button (1) or left button (0) for drag panning
    if (e.button === 1 || e.button === 0) {
      const container = containerRef.current;
      if (!container) return;
      isDragging.current = true;
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        scrollLeft: container.scrollLeft,
        scrollTop: container.scrollTop,
      };
      container.style.cursor = "grabbing";
      // Prevent middle-click auto-scroll on Windows
      if (e.button === 1) e.preventDefault();
    }
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const container = containerRef.current;
    if (!container) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    container.scrollLeft = dragStart.current.scrollLeft - dx;
    container.scrollTop = dragStart.current.scrollTop - dy;
  }, []);

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
    const container = containerRef.current;
    if (container) container.style.cursor = "grab";
  }, []);

  const handlePageInputCommit = () => {
    const n = parseInt(pageInput, 10);
    if (!isNaN(n) && n >= 1 && n <= numPages) {
      setPageNum(n);
    } else {
      setPageInput(String(pageNum));
    }
  };

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
        <p className="text-sm text-muted-foreground">Click Sync to compile and preview PDF</p>
      </div>
    );
  }

  const zoomPercent = Math.round((userScale === 0 ? displayScale : userScale) * 100);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1 border-b bg-muted/30 gap-2 flex-shrink-0">
        {/* Pagination */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { const p = Math.max(1, pageNum - 1); setPageNum(p); setPageInput(String(p)); }} disabled={pageNum <= 1}>
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <input
            type="text"
            value={pageInput}
            onChange={e => setPageInput(e.target.value)}
            onBlur={handlePageInputCommit}
            onKeyDown={e => e.key === "Enter" && handlePageInputCommit()}
            className="w-8 h-6 text-center text-xs bg-background border rounded"
          />
          <span className="text-xs text-muted-foreground">/ {numPages}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { const p = Math.min(numPages, pageNum + 1); setPageNum(p); setPageInput(String(p)); }} disabled={pageNum >= numPages}>
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-1">
          {isCompiling && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground mr-1" />}
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={zoomOut}><ZoomOut className="h-3 w-3" /></Button>
          <span className="text-xs text-muted-foreground w-10 text-center">{zoomPercent}%</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={zoomIn}><ZoomIn className="h-3 w-3" /></Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={fitToWidth} title="Fit to width"><Maximize className="h-3 w-3" /></Button>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-muted/10"
        style={{ cursor: "grab" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <div className="min-w-fit flex justify-center p-4">
          <canvas ref={canvasRef} className="shadow-lg pointer-events-none" />
        </div>
      </div>
    </div>
  );
}
