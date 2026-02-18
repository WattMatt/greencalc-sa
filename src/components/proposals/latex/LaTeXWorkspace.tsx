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
  sectionPrefixes: Map<string, string>,
): string {
  const enabled = data.contentBlocks
    .filter(b => b.enabled)
    .sort((a, b) => a.order - b.order);

  const sections = enabled.map(block => {
    const content = overrides.has(block.id)
      ? overrides.get(block.id)!
      : generateBlockContent(block.id, data);
    const prefix = sectionPrefixes.get(block.id) ?? "";
    return `${prefix}${SECTION_BEGIN(block.id)}\n${content}\n${SECTION_END(block.id)}`;
  }).join("\n");

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
    initialOverrides
      ? new Map(Object.entries(initialOverrides).filter(([k]) => !k.startsWith("__prefix__")))
      : new Map()
  );
  const generatedSectionsRef = useRef<Map<string, string>>(new Map());
  const sectionPrefixesRef = useRef<Map<string, string>>(
    initialOverrides
      ? new Map(
          Object.entries(initialOverrides)
            .filter(([k]) => k.startsWith("__prefix__"))
            .map(([k, v]) => [k.replace("__prefix__", ""), v])
        )
      : new Map()
  );
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

    const newSource = assembleSource(templateData, overridesRef.current, sectionPrefixesRef.current);
    isProgrammaticRef.current = true;
    setSource(newSource);
    setNeedsSync(true);
  }, [templateData]);

  // Detect manual edits — captures both section content AND inter-section prefixes
  const handleSourceChange = useCallback((newSource: string) => {
    setSource(newSource);
    setNeedsSync(true);

    if (isProgrammaticRef.current) {
      isProgrammaticRef.current = false;
      return;
    }

    // Save ALL section content as overrides — whatever is between BEGIN/END markers
    // gets persisted exactly as-is, no comparison with generated content
    const editedSections = parseSections(newSource);

    // Clear old overrides for sections no longer in source, keep all current ones
    const newOverrides = new Map<string, string>();
    editedSections.forEach((content, id) => {
      newOverrides.set(id, content);
    });
    overridesRef.current = newOverrides;

    // Parse inter-section prefixes (content between END of previous section and BEGIN of next)
    // This captures \newpage, \pagebreak, \clearpage etc. that users add between sections
    const beginRegex = /%%-- BEGIN:(\w+) --%%/g;
    const endRegex = /%%-- END:(\w+) --%%/g;
    const newPrefixes = new Map<string, string>();

    // Find all BEGIN positions
    const beginPositions: { id: string; index: number }[] = [];
    let bm;
    while ((bm = beginRegex.exec(newSource)) !== null) {
      beginPositions.push({ id: bm[1], index: bm.index });
    }

    // Find all END positions
    const endPositions: { id: string; endIndex: number }[] = [];
    let em;
    while ((em = endRegex.exec(newSource)) !== null) {
      endPositions.push({ id: em[1], endIndex: em.index + em[0].length });
    }

    for (let i = 0; i < beginPositions.length; i++) {
      const bp = beginPositions[i];
      // Find the text between the previous END and this BEGIN
      let prefixStart = 0;
      if (i > 0) {
        // Find the END that corresponds to the previous section
        const prevEnd = endPositions.find(e => e.id === beginPositions[i - 1].id);
        if (prevEnd) prefixStart = prevEnd.endIndex;
      } else {
        // For the first section, find where \begin{document} ends
        const docBegin = newSource.indexOf("\\begin{document}");
        if (docBegin >= 0) prefixStart = docBegin + "\\begin{document}".length;
      }

      const between = newSource.substring(prefixStart, bp.index);
      // Only store if there's meaningful content (not just whitespace/newlines)
      const trimmed = between.replace(/^\n+|\n+$/g, "").trim();
      if (trimmed.length > 0) {
        // Preserve the leading newline + content + trailing newline
        newPrefixes.set(bp.id, trimmed + "\n");
      }
    }

    sectionPrefixesRef.current = newPrefixes;

    // Include prefixes in the persisted overrides with a special key prefix
    const allOverrides: Record<string, string> = {};
    overridesRef.current.forEach((v, k) => { allOverrides[k] = v; });
    newPrefixes.forEach((v, k) => { allOverrides[`__prefix__${k}`] = v; });

    onOverridesChange?.(allOverrides);
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
