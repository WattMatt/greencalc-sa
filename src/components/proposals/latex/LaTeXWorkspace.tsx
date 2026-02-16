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

/**
 * Assemble a full .tex document from preamble + per-section content,
 * using overrides where the user has manually edited a section.
 */
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

  // Section overrides: user-edited content per block id
  const overridesRef = useRef<Map<string, string>>(
    initialOverrides ? new Map(Object.entries(initialOverrides)) : new Map()
  );
  // The last auto-generated (no-override) section content, for diffing
  const generatedSectionsRef = useRef<Map<string, string>>(new Map());

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const latestSourceRef = useRef(source);
  latestSourceRef.current = source;

  // Track whether the source change came from the user typing vs programmatic
  const isProgrammaticRef = useRef(false);

  // Generate / regenerate source from template data, preserving overrides
  useEffect(() => {
    // Build fresh generated sections map
    const freshMap = new Map<string, string>();
    templateData.contentBlocks
      .filter(b => b.enabled)
      .sort((a, b) => a.order - b.order)
      .forEach(block => {
        freshMap.set(block.id, generateBlockContent(block.id, templateData));
      });
    generatedSectionsRef.current = freshMap;

    // Assemble using overrides
    const newSource = assembleSource(templateData, overridesRef.current);
    isProgrammaticRef.current = true;
    setSource(newSource);
  }, [templateData]);

  // Detect manual edits: when user changes source, diff against generated
  const handleSourceChange = useCallback((newSource: string) => {
    setSource(newSource);

    // Skip override detection for programmatic changes
    if (isProgrammaticRef.current) {
      isProgrammaticRef.current = false;
      return;
    }

    // Parse sections from the edited source
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

    // Notify parent of override changes for persistence
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
    overridesRef.current = new Map();
    onOverridesChange?.({});
    const newSource = generateLatexSource(templateData);
    isProgrammaticRef.current = true;
    setSource(newSource);
  }, [templateData, onOverridesChange]);

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full">
      <ResizablePanel defaultSize={45} minSize={25}>
        <LaTeXEditor
          value={source}
          onChange={handleSourceChange}
          onReset={handleReset}
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
