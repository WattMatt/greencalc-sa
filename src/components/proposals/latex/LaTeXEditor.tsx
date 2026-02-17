import { useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";
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

export function LaTeXEditor({ value, onChange, onSync, needsSync, isCompiling, disabled }: LaTeXEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newValue = value.substring(0, start) + "  " + value.substring(end);
      onChange(newValue);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      });
    }
  }, [value, onChange]);

  const insertAtCursor = useCallback((text: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const newValue = value.substring(0, start) + text + value.substring(end);
    onChange(newValue);
    requestAnimationFrame(() => {
      ta.focus();
      const newPos = start + text.length;
      ta.selectionStart = ta.selectionEnd = newPos;
    });
  }, [value, onChange]);

  const lines = value.split("\n").length;

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
        <span className="text-xs font-medium text-muted-foreground">main.tex</span>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-2">{lines} lines</span>
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
            <div
              className="bg-muted/30 text-muted-foreground text-right select-none overflow-hidden border-r px-2 py-2 font-mono text-xs leading-5"
              style={{ minWidth: "3rem" }}
            >
              {Array.from({ length: lines }, (_, i) => (
                <div key={i + 1}>{i + 1}</div>
              ))}
            </div>

            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              spellCheck={false}
              className="flex-1 resize-none border-none outline-none bg-transparent font-mono text-xs leading-5 p-2 overflow-auto"
              style={{ tabSize: 2 }}
            />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={() => insertAtCursor("\\newpage\n")}>
            Insert <code className="ml-2 text-xs font-mono bg-muted px-1 rounded">\\newpage</code>
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => insertAtCursor("\\pagebreak\n")}>
            Insert <code className="ml-2 text-xs font-mono bg-muted px-1 rounded">\\pagebreak</code>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => insertAtCursor("\\clearpage\n")}>
            Insert <code className="ml-2 text-xs font-mono bg-muted px-1 rounded">\\clearpage</code>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
}
