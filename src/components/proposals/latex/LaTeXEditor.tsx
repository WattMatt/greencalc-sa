import { useState, useRef, useCallback, useMemo, useLayoutEffect, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2, ChevronRight, ChevronDown, WrapText } from "lucide-react";

const COMMENT_RE = /^\s*%/;
const FOLD_MARKER_RE = /^%%--\s*(BEGIN|END):\w+\s*--%%$/;
const HIDDEN_PLACEHOLDER_RE = /^\s*\.\.\.\s*\(\d+\s*lines?\s*hidden\)$/;
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";

interface LaTeXEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSync?: () => void;
  needsSync?: boolean;
  isCompiling?: boolean;
  disabled?: boolean;
}

interface FoldRegion {
  sectionId: string;
  beginLine: number;
  endLine: number;
}

const BEGIN_RE = /^%%--\s*BEGIN:(\w+)\s*--%%$/;
const END_RE = /^%%--\s*END:(\w+)\s*--%%$/;
const DOCUMENTCLASS_RE = /^\\documentclass/;
const BEGIN_DOCUMENT_RE = /^\\begin\{document\}/;

function parseFoldRegions(source: string): FoldRegion[] {
  const lines = source.split("\n");
  const regions: FoldRegion[] = [];
  const stack: { sectionId: string; beginLine: number }[] = [];

  // Detect prologue: from \documentclass to \begin{document}
  let prologueStart = -1;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (prologueStart === -1 && DOCUMENTCLASS_RE.test(trimmed)) {
      prologueStart = i;
    } else if (prologueStart !== -1 && BEGIN_DOCUMENT_RE.test(trimmed)) {
      if (i - prologueStart > 1) {
        regions.push({ sectionId: "_prologue", beginLine: prologueStart, endLine: i - 1 });
      }
      break;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const beginMatch = lines[i].trim().match(BEGIN_RE);
    if (beginMatch) {
      stack.push({ sectionId: beginMatch[1], beginLine: i });
      continue;
    }
    const endMatch = lines[i].trim().match(END_RE);
    if (endMatch && stack.length > 0 && stack[stack.length - 1].sectionId === endMatch[1]) {
      const { sectionId, beginLine } = stack.pop()!;
      regions.push({ sectionId, beginLine, endLine: i });
    }
  }
  return regions;
}

function computeDisplayLines(
  source: string,
  collapsedSections: Set<string>,
) {
  const sourceLines = source.split("\n");
  const regions = parseFoldRegions(source);

  const hiddenLines = new Set<number>();
  const collapsedInfo = new Map<number, { sectionId: string; hiddenCount: number }>();

  for (const region of regions) {
    if (collapsedSections.has(region.sectionId)) {
      const hiddenStart = region.beginLine + 1;
      const hiddenEnd = region.endLine;
      for (let i = hiddenStart; i <= hiddenEnd; i++) {
        hiddenLines.add(i);
      }
      collapsedInfo.set(region.beginLine, {
        sectionId: region.sectionId,
        hiddenCount: hiddenEnd - hiddenStart + 1,
      });
    }
  }

  const displayLines: string[] = [];
  const lineMap: number[] = [];

  for (let i = 0; i < sourceLines.length; i++) {
    if (hiddenLines.has(i)) continue;

    displayLines.push(sourceLines[i]);
    lineMap.push(i);

    const info = collapsedInfo.get(i);
    if (info) {
      displayLines.push(`  ... (${info.hiddenCount} lines hidden)`);
      lineMap.push(-1);
    }
  }

  return { displayLines, lineMap, regions };
}

function reconstructSource(
  newDisplayText: string,
  originalSource: string,
  lineMap: number[],
  collapsedSections: Set<string>,
): string {
  const originalLines = originalSource.split("\n");
  const newDisplayLines = newDisplayText.split("\n");
  const result = [...originalLines];

  let displayIdx = 0;
  for (let i = 0; i < lineMap.length && displayIdx < newDisplayLines.length; i++) {
    if (lineMap[i] === -1) {
      displayIdx++;
      continue;
    }
    result[lineMap[i]] = newDisplayLines[displayIdx];
    displayIdx++;
  }

  if (displayIdx < newDisplayLines.length) {
    const lastSourceIdx = lineMap.filter(x => x >= 0).pop() ?? originalLines.length - 1;
    const extra = newDisplayLines.slice(displayIdx);
    result.splice(lastSourceIdx + 1, 0, ...extra);
  }

  return result.join("\n");
}

export function LaTeXEditor({ value, onChange, onSync, needsSync, isCompiling, disabled }: LaTeXEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [wordWrap, setWordWrap] = useState(false);
  const [lineHeights, setLineHeights] = useState<number[]>([]);

  const highlightRef = useRef<HTMLDivElement>(null);
  const textOverlayRef = useRef<HTMLDivElement>(null);

  const handleTextareaScroll = useCallback(() => {
    const ta = textareaRef.current;
    const gutter = gutterRef.current;
    const highlight = highlightRef.current;
    const textOverlay = textOverlayRef.current;
    if (ta) {
      if (gutter) gutter.scrollTop = ta.scrollTop;
      if (highlight) {
        highlight.scrollTop = ta.scrollTop;
        highlight.scrollLeft = ta.scrollLeft;
      }
      if (textOverlay) {
        textOverlay.scrollTop = ta.scrollTop;
        textOverlay.scrollLeft = ta.scrollLeft;
      }
    }
  }, []);

  const { displayLines, lineMap, regions } = useMemo(
    () => computeDisplayLines(value, collapsedSections),
    [value, collapsedSections],
  );

  const displayText = displayLines.join("\n");

  const foldableLines = useMemo(() => {
    const map = new Map<number, string>();
    for (const r of regions) {
      map.set(r.beginLine, r.sectionId);
    }
    return map;
  }, [regions]);

  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newDisplayText = e.target.value;
    if (collapsedSections.size === 0) {
      onChange(newDisplayText);
    } else {
      const newSource = reconstructSource(newDisplayText, value, lineMap, collapsedSections);
      onChange(newSource);
    }
  }, [value, onChange, lineMap, collapsedSections]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const current = displayText;
      const newDisplay = current.substring(0, start) + "  " + current.substring(end);

      if (collapsedSections.size === 0) {
        onChange(newDisplay);
      } else {
        onChange(reconstructSource(newDisplay, value, lineMap, collapsedSections));
      }

      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      });
    }
  }, [displayText, value, onChange, lineMap, collapsedSections]);

  const insertAtCursor = useCallback((text: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const scrollTop = ta.scrollTop;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const current = displayText;
    const newDisplay = current.substring(0, start) + text + current.substring(end);

    if (collapsedSections.size === 0) {
      onChange(newDisplay);
    } else {
      onChange(reconstructSource(newDisplay, value, lineMap, collapsedSections));
    }

    requestAnimationFrame(() => {
      ta.focus();
      ta.scrollTop = scrollTop;
      const newPos = start + text.length;
      ta.selectionStart = ta.selectionEnd = newPos;
    });
  }, [displayText, value, onChange, lineMap, collapsedSections]);

  // Measure line heights from mirror div when word wrap is on
  const measureLineHeights = useCallback(() => {
    if (!wordWrap || !mirrorRef.current) {
      setLineHeights([]);
      return;
    }
    const children = mirrorRef.current.children;
    const heights: number[] = [];
    for (let i = 0; i < children.length; i++) {
      heights.push((children[i] as HTMLElement).offsetHeight);
    }
    setLineHeights(heights);
  }, [wordWrap]);

  // Re-measure on content or wrap change
  useLayoutEffect(() => {
    measureLineHeights();
  }, [displayLines, wordWrap, measureLineHeights]);

  // ResizeObserver to re-measure when textarea width changes
  useEffect(() => {
    if (!wordWrap) return;
    const ta = textareaRef.current;
    if (!ta) return;

    const ro = new ResizeObserver(() => {
      // Sync mirror width to textarea width before measuring
      if (mirrorRef.current) {
        mirrorRef.current.style.width = `${ta.clientWidth}px`;
      }
      measureLineHeights();
    });
    ro.observe(ta);
    // Set initial width
    if (mirrorRef.current) {
      mirrorRef.current.style.width = `${ta.clientWidth}px`;
    }
    return () => ro.disconnect();
  }, [wordWrap, measureLineHeights]);

  const gutterEntries = useMemo(() => {
    return displayLines.map((_, displayIdx) => {
      const sourceIdx = lineMap[displayIdx];
      if (sourceIdx === -1) {
        return { type: "placeholder" as const, lineNum: null, sectionId: null };
      }
      const sectionId = foldableLines.get(sourceIdx);
      if (sectionId) {
        const isCollapsed = collapsedSections.has(sectionId);
        return { type: "foldable" as const, lineNum: sourceIdx + 1, sectionId, isCollapsed };
      }
      return { type: "normal" as const, lineNum: sourceIdx + 1, sectionId: null };
    });
  }, [displayLines, lineMap, foldableLines, collapsedSections]);

  const getLineHeight = (idx: number) => {
    if (!wordWrap || lineHeights.length === 0) return 20;
    return lineHeights[idx] || 20;
  };

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
        <span className="text-xs font-medium text-muted-foreground">main.tex</span>
        <div className="flex items-center gap-1">
          <Button
            variant={wordWrap ? "default" : "ghost"}
            size="sm"
            onClick={() => setWordWrap(w => !w)}
            className="h-6 text-xs gap-1"
            title={wordWrap ? "Disable word wrap" : "Enable word wrap"}
          >
            <WrapText className="h-3 w-3" />
            Wrap
          </Button>
          <span className="text-xs text-muted-foreground mr-2">
            {value.split("\n").length} lines
          </span>
          {onSync && (
            <Button
              variant={needsSync ? "default" : "ghost"}
              size="sm"
              onClick={onSync}
              disabled={isCompiling}
              className={`h-6 text-xs ${needsSync ? "animate-pulse" : ""}`}
            >
              {isCompiling ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1" />
              )}
              Sync
            </Button>
          )}
        </div>
      </div>

      {/* Hidden mirror div for measuring wrapped line heights */}
      {wordWrap && (
        <div
          ref={mirrorRef}
          aria-hidden="true"
          style={{
            position: "absolute",
            visibility: "hidden",
            overflow: "hidden",
            pointerEvents: "none",
            // Match textarea styles exactly
            fontFamily: "monospace",
            fontSize: "12px",
            lineHeight: "20px",
            padding: "8px",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            overflowWrap: "break-word",
            boxSizing: "border-box",
          }}
        >
          {displayLines.map((line, idx) => (
            <div key={idx} style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", overflowWrap: "break-word" }}>
              {line || "\u00A0"}
            </div>
          ))}
        </div>
      )}

      {/* Editor with line numbers */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="flex-1 flex overflow-hidden">
            {/* Gutter */}
            <div
              ref={gutterRef}
              className="bg-muted/30 text-muted-foreground select-none overflow-hidden border-r py-2 font-mono text-xs leading-[20px]"
              style={{ minWidth: "3.5rem" }}
            >
              {gutterEntries.map((entry, idx) => {
                const h = getLineHeight(idx);
                if (entry.type === "placeholder") {
                  return (
                    <div key={`p-${idx}`} className="flex items-center justify-end pr-2 text-muted-foreground/40" style={{ height: h }}>
                      ⋯
                    </div>
                  );
                }
                if (entry.type === "foldable") {
                  return (
                    <div key={`f-${idx}`} className="flex items-start" style={{ height: h }}>
                      <button
                        type="button"
                        className="flex items-center justify-center w-4 h-5 hover:bg-muted/60 rounded-sm ml-0.5"
                        onClick={() => toggleSection(entry.sectionId!)}
                        title={entry.isCollapsed ? "Expand section" : "Collapse section"}
                      >
                        {entry.isCollapsed ? (
                          <ChevronRight className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </button>
                      <span className="flex-1 text-right pr-2">{entry.lineNum}</span>
                    </div>
                  );
                }
                return (
                  <div key={`n-${idx}`} className="text-right pr-2 pl-5" style={{ height: h }}>
                    {entry.lineNum}
                  </div>
                );
              })}
            </div>

            {/* Textarea + highlight overlay wrapper */}
            <div className="flex-1 relative overflow-hidden">
              {/* Syntax highlight overlay */}
              <div
                ref={highlightRef}
                aria-hidden="true"
                className="absolute inset-0 font-mono text-xs leading-[20px] p-2 pointer-events-none overflow-hidden"
                style={{
                  tabSize: 2,
                  ...(wordWrap
                    ? { whiteSpace: "pre-wrap" as const, wordBreak: "break-all" as const, overflowWrap: "break-word" as const }
                    : { whiteSpace: "pre" as const, overflowX: "auto" as const }),
                }}
              >
                {displayLines.map((line, idx) => {
                  const trimmed = line.trim();
                  let color: string | undefined;
                  if (HIDDEN_PLACEHOLDER_RE.test(trimmed)) {
                    color = "hsl(var(--muted-foreground) / 0.5)";
                  } else if (FOLD_MARKER_RE.test(trimmed)) {
                    color = "hsl(25, 70%, 55%)";
                  } else if (COMMENT_RE.test(line)) {
                    color = "hsl(140, 50%, 45%)";
                  }
                  return (
                    <div key={idx} style={{ color, height: getLineHeight(idx), visibility: color ? "visible" : "hidden" }}>
                      {line || "\u00A0"}
                    </div>
                  );
                })}
              </div>
              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={displayText}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onScroll={handleTextareaScroll}
                disabled={disabled}
                spellCheck={false}
                className="absolute inset-0 w-full h-full resize-none border-none outline-none bg-transparent font-mono text-xs leading-[20px] p-2 overflow-auto"
                style={{
                  tabSize: 2,
                  caretColor: "hsl(var(--foreground))",
                  color: "transparent",
                  ...(wordWrap
                    ? { whiteSpace: "pre-wrap", wordBreak: "break-all", overflowWrap: "break-word" }
                    : { whiteSpace: "pre", overflowX: "auto" as const }),
                }}
              />
              {/* Visible text layer for non-highlighted lines */}
              <div
                ref={textOverlayRef}
                aria-hidden="true"
                className="absolute inset-0 font-mono text-xs leading-[20px] p-2 pointer-events-none overflow-hidden"
                style={{
                  tabSize: 2,
                  ...(wordWrap
                    ? { whiteSpace: "pre-wrap" as const, wordBreak: "break-all" as const, overflowWrap: "break-word" as const }
                    : { whiteSpace: "pre" as const, overflowX: "auto" as const }),
                }}
              >
                {displayLines.map((line, idx) => {
                  const trimmed = line.trim();
                  const isSpecial = HIDDEN_PLACEHOLDER_RE.test(trimmed) || FOLD_MARKER_RE.test(trimmed) || COMMENT_RE.test(line);
                  return (
                    <div key={idx} style={{ height: getLineHeight(idx), visibility: isSpecial ? "hidden" : "visible" }}>
                      {line || "\u00A0"}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={() => setWordWrap(w => !w)}>
            <WrapText className="h-3.5 w-3.5 mr-2" />
            {wordWrap ? "Disable Word Wrap" : "Enable Word Wrap"}
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => {
            const allIds = regions.map(r => r.sectionId);
            const allCollapsed = allIds.length > 0 && allIds.every(id => collapsedSections.has(id));
            if (allCollapsed) {
              setCollapsedSections(new Set());
            } else {
              setCollapsedSections(new Set(allIds));
            }
          }}>
            {regions.length > 0 && regions.every(r => collapsedSections.has(r.sectionId))
              ? "Expand All Sections"
              : "Collapse All Sections"}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => insertAtCursor("\\newpage\n")}>
            <code className="text-xs font-mono bg-muted px-1 rounded">\newpage</code>
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => insertAtCursor("\\pagebreak\n")}>
            <code className="text-xs font-mono bg-muted px-1 rounded">\pagebreak</code>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => insertAtCursor("\\clearpage\n")}>
            <code className="text-xs font-mono bg-muted px-1 rounded">\clearpage</code>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
}
