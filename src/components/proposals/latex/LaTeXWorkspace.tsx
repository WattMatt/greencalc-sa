import { useState, useEffect, useRef, useCallback } from "react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { LaTeXEditor } from "./LaTeXEditor";
import { PDFPreview } from "./PDFPreview";
import { compileLatex, CompileResult, getEngine } from "@/lib/latex/SwiftLaTeXEngine";
import { generateLatexSource, TemplateData } from "@/lib/latex/templates/proposalTemplate";
import { Loader2 } from "lucide-react";

interface LaTeXWorkspaceProps {
  templateData: TemplateData;
  onPdfReady?: (blob: Blob | null) => void;
}

export function LaTeXWorkspace({ templateData, onPdfReady }: LaTeXWorkspaceProps) {
  const [source, setSource] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string | null>(null);
  const [engineReady, setEngineReady] = useState(false);
  const [engineLoading, setEngineLoading] = useState(true);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const latestSourceRef = useRef(source);
  latestSourceRef.current = source;

  // Load engine on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await getEngine();
        if (!cancelled) {
          setEngineReady(true);
          setEngineLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(`Failed to load LaTeX engine: ${err}`);
          setEngineLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Generate initial source from template data
  useEffect(() => {
    const newSource = generateLatexSource(templateData);
    setSource(newSource);
  }, [templateData]);

  // Compile on source change (debounced)
  const compile = useCallback(async (src: string) => {
    if (!engineReady) return;
    setIsCompiling(true);
    setError(null);

    try {
      const result: CompileResult = await compileLatex(src);
      // Only update if this is still the latest source
      if (src === latestSourceRef.current) {
        setPdfUrl(result.pdfUrl);
        setLog(result.log);
        if (!result.success) {
          setError("Compilation failed");
        }
        onPdfReady?.(result.pdf);
      }
    } catch (err: any) {
      if (src === latestSourceRef.current) {
        setError(err.message || "Compilation error");
      }
    } finally {
      setIsCompiling(false);
    }
  }, [engineReady, onPdfReady]);

  useEffect(() => {
    if (!engineReady || !source) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      compile(source);
    }, 800);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [source, engineReady, compile]);

  const handleReset = useCallback(() => {
    const newSource = generateLatexSource(templateData);
    setSource(newSource);
  }, [templateData]);

  if (engineLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading LaTeX engine…</p>
        <p className="text-xs text-muted-foreground">First load may take a moment</p>
      </div>
    );
  }

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full">
      <ResizablePanel defaultSize={45} minSize={25}>
        <LaTeXEditor
          value={source}
          onChange={setSource}
          onReset={handleReset}
        />
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel defaultSize={55} minSize={25}>
        <PDFPreview
          pdfUrl={pdfUrl}
          isCompiling={isCompiling}
          error={error}
          log={log}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
