import { useState, useEffect, useRef, useCallback } from "react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { LaTeXEditor } from "./LaTeXEditor";
import { PDFPreview } from "./PDFPreview";
import { compileLatex, CompileResult } from "@/lib/latex/SwiftLaTeXEngine";
import { generateLatexSource, TemplateData } from "@/lib/latex/templates/proposalTemplate";

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

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const latestSourceRef = useRef(source);
  latestSourceRef.current = source;

  // Generate initial source from template data
  useEffect(() => {
    const newSource = generateLatexSource(templateData);
    setSource(newSource);
  }, [templateData]);

  // Compile
  const compile = useCallback(async (src: string) => {
    setIsCompiling(true);
    setError(null);

    try {
      const result: CompileResult = await compileLatex(src);
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
  }, [onPdfReady]);

  // Debounced compile on source change
  useEffect(() => {
    if (!source) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      compile(source);
    }, 800);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [source, compile]);

  const handleReset = useCallback(() => {
    const newSource = generateLatexSource(templateData);
    setSource(newSource);
  }, [templateData]);

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
