import { useState, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2, ChevronRight, ChevronDown } from "lucide-react";
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
  beginLine: number; // 0-indexed
  endLine: number;   // 0-indexed
}

const BEGIN_RE = /^%%--\s*BEGIN:(\w+)\s*--%%$/;
const END_RE = /^%%--\s*END:(\w+)\s*--%%$/;

function parseFoldRegions(source: string): FoldRegion[] {
  const lines = source.split("\n");
  const regions: FoldRegion[] = [];
  const stack: { sectionId: string; beginLine: number }[] = [];

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

/**
 * Given the full source and collapsed section IDs, produce:
 * - displayLines: the lines to show in the textarea
 * - lineMap: for each display line index, the corresponding source line index (or -1 for placeholder lines)
 * - collapsedRanges: map of source line index of BEGIN -> { sectionId, hiddenCount, sourceStart, sourceEnd }
 */
function computeDisplayLines(
  source: string,
  collapsedSections: Set<string>,
) {
  const sourceLines = source.split("\n");
  const regions = parseFoldRegions(source);

  // Build a set of source line indices that are hidden
  const hiddenLines = new Set<number>();
  const collapsedInfo = new Map<number, { sectionId: string; hiddenCount: number }>();

  for (const region of regions) {
    if (collapsedSections.has(region.sectionId)) {
      // Hide lines between BEGIN+1 and END (inclusive of END)
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
  const lineMap: number[] = []; // displayIndex -> sourceIndex (-1 for placeholder)

  for (let i = 0; i < sourceLines.length; i++) {
    if (hiddenLines.has(i)) continue;

    displayLines.push(sourceLines[i]);
    lineMap.push(i);

    // After a collapsed BEGIN line, insert a placeholder
    const info = collapsedInfo.get(i);
    if (info) {
      displayLines.push(`  ... (${info.hiddenCount} lines hidden)`);
      lineMap.push(-1); // placeholder, not a real source line
    }
  }

  return { displayLines, lineMap, regions };
}

/**
 * Given edit in display text, reconstruct the full source.
 */
function reconstructSource(
  newDisplayText: string,
  originalSource: string,
  lineMap: number[],
  collapsedSections: Set<string>,
): string {
  const originalLines = originalSource.split("\n");
  const newDisplayLines = newDisplayText.split("\n");
  const result = [...originalLines];

  // Map each display line back; skip placeholders
  let displayIdx = 0;
  for (let i = 0; i < lineMap.length && displayIdx < newDisplayLines.length; i++) {
    if (lineMap[i] === -1) {
      // placeholder line — skip in display
      displayIdx++;
      continue;
    }
    result[lineMap[i]] = newDisplayLines[displayIdx];
    displayIdx++;
  }

  // Handle added/removed lines at the end of the display
  // If the user added lines at the end of the textarea, append them
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
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // Sync gutter scroll with textarea scroll
  const handleTextareaScroll = useCallback(() => {
    const ta = textareaRef.current;
    const gutter = gutterRef.current;
    if (ta && gutter) {
      gutter.scrollTop = ta.scrollTop;
    }
  }, []);

  const { displayLines, lineMap, regions } = useMemo(
    () => computeDisplayLines(value, collapsedSections),
    [value, collapsedSections],
  );

  const displayText = displayLines.join("\n");

  // Build a set of BEGIN line indices for quick lookup in gutter
  const foldableLines = useMemo(() => {
    const map = new Map<number, string>(); // sourceLineIdx -> sectionId
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
      // No folding active — pass through directly
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

  // Build gutter content — one entry per display line
  const gutterEntries = useMemo(() => {
    return displayLines.map((_, displayIdx) => {
      const sourceIdx = lineMap[displayIdx];
      if (sourceIdx === -1) {
        // Placeholder line
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

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
        <span className="text-xs font-medium text-muted-foreground">main.tex</span>
        <div className="flex items-center gap-1">
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
                if (entry.type === "placeholder") {
                  return (
                    <div key={`p-${idx}`} className="flex items-center justify-end pr-2 text-muted-foreground/40" style={{ height: 20 }}>
                      ⋯
                    </div>
                  );
                }
                if (entry.type === "foldable") {
                  return (
                    <div key={`f-${idx}`} className="flex items-center" style={{ height: 20 }}>
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
                  <div key={`n-${idx}`} className="text-right pr-2 pl-5" style={{ height: 20 }}>
                    {entry.lineNum}
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
              className="flex-1 resize-none border-none outline-none bg-transparent font-mono text-xs leading-[20px] p-2 overflow-auto"
              style={{ tabSize: 2 }}
            />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
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
