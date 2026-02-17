import { useState, useEffect, useRef, useCallback } from "react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { LaTeXEditor } from "./LaTeXEditor";
import { PDFPreview } from "./PDFPreview";
import { compileLatex, CompileResult } from "@/lib/latex/SwiftLaTeXEngine";
import { generateLatexSource, generateBlockContent, generatePreamble, TemplateData } from "@/lib/latex/templates/proposalTemplate";
import { parseSections, SECTION_BEGIN, SECTION_END, ContentBlockId } from "@/components/proposals/types";

interface LaTeXWorkspaceProps {
  templateData: TemplateData;
  onPdfReady?: (blob: Blob | null) => void;
  initialOverrides?: Record<string, string>;
  onOverridesChange?: (overrides: Record<string, string>) => void;
}

function assembleSource(
  data: TemplateData,
  overrides: Map<string, string>,
): string {
  const enabled = data.contentBlocks
    .filter(b => b.enabled)
    .sort((a, b) => a.order - b.order);

  const sections = enabled.map(block => {
    const content = overrides.has(block.id)
      ? overrides.get(block.id)!
      : generateBlockContent(block.id, data);
    return `${SECTION_BEGIN(block.id)}\n${content}\n${SECTION_END(block.id)}`;
  }).join("\n\\newpage\n");

  return `${generatePreamble(data)}

\\begin{document}

${sections}

\\end{document}
`;
}

export function LaTeXWorkspace({ templateData, onPdfReady, initialOverrides, onOverridesChange }: LaTeXWorkspaceProps) {
  const [source, setSource] = useState("");
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string | null>(null);
  const [needsSync, setNeedsSync] = useState(false);

  const overridesRef = useRef<Map<string, string>>(
    initialOverrides ? new Map(Object.entries(initialOverrides)) : new Map()
  );
  const generatedSectionsRef = useRef<Map<string, string>>(new Map());
  const latestSourceRef = useRef(source);
  latestSourceRef.current = source;
  const isProgrammaticRef = useRef(false);

  // Generate / regenerate source from template data, preserving overrides
  useEffect(() => {
    const freshMap = new Map<string, string>();
    templateData.contentBlocks
      .filter(b => b.enabled)
      .sort((a, b) => a.order - b.order)
      .forEach(block => {
        freshMap.set(block.id, generateBlockContent(block.id, templateData));
      });
    generatedSectionsRef.current = freshMap;

    const newSource = assembleSource(templateData, overridesRef.current);
    isProgrammaticRef.current = true;
    setSource(newSource);
    setNeedsSync(true);
  }, [templateData]);

  // Detect manual edits
  const handleSourceChange = useCallback((newSource: string) => {
    setSource(newSource);
    setNeedsSync(true);

    if (isProgrammaticRef.current) {
      isProgrammaticRef.current = false;
      return;
    }

    const editedSections = parseSections(newSource);
    const generated = generatedSectionsRef.current;

    editedSections.forEach((content, id) => {
      const gen = generated.get(id);
      if (gen !== undefined && content !== gen) {
        overridesRef.current.set(id, content);
      } else if (gen !== undefined && content === gen) {
        overridesRef.current.delete(id);
      }
    });

    onOverridesChange?.(Object.fromEntries(overridesRef.current));
  }, [onOverridesChange]);

  // Compile
  const compile = useCallback(async (src: string) => {
    setIsCompiling(true);
    setError(null);

    try {
      const result: CompileResult = await compileLatex(src);
      if (src === latestSourceRef.current) {
        if (result.pdf) {
          const arrayBuf = await result.pdf.arrayBuffer();
          setPdfData(new Uint8Array(arrayBuf));
        } else {
          setPdfData(null);
        }
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

  // Sync handler — only compiles when user clicks Sync
  const handleSync = useCallback(() => {
    if (!source) return;
    setNeedsSync(false);
    compile(source);
  }, [source, compile]);

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full">
      <ResizablePanel defaultSize={45} minSize={25}>
        <LaTeXEditor
          value={source}
          onChange={handleSourceChange}
          onSync={handleSync}
          needsSync={needsSync}
          isCompiling={isCompiling}
        />
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel defaultSize={55} minSize={25}>
        <PDFPreview
          pdfData={pdfData}
          isCompiling={isCompiling}
          error={error}
          log={log}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
