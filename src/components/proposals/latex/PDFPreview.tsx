import { Loader2, AlertCircle, FileText } from "lucide-react";

interface PDFPreviewProps {
  pdfUrl: string | null;
  isCompiling: boolean;
  error: string | null;
  log: string | null;
}

export function PDFPreview({ pdfUrl, isCompiling, error, log }: PDFPreviewProps) {
  if (isCompiling && !pdfUrl) {
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

  if (!pdfUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-muted/20 gap-3">
        <FileText className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">PDF preview will appear here</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Compilation indicator */}
      {isCompiling && (
        <div className="flex items-center gap-2 px-3 py-1 border-b bg-muted/50">
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Recompiling…</span>
        </div>
      )}
      <iframe
        src={pdfUrl}
        className="flex-1 w-full border-none"
        title="PDF Preview"
      />
    </div>
  );
}
