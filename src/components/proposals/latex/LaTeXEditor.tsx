import { useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

interface LaTeXEditorProps {
  value: string;
  onChange: (value: string) => void;
  onReset?: () => void;
  disabled?: boolean;
}

export function LaTeXEditor({ value, onChange, onReset, disabled }: LaTeXEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab inserts spaces instead of changing focus
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newValue = value.substring(0, start) + "  " + value.substring(end);
      onChange(newValue);
      // Restore cursor position after React re-renders
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      });
    }
  }, [value, onChange]);

  const lines = value.split("\n").length;

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
        <span className="text-xs font-medium text-muted-foreground">main.tex</span>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-2">{lines} lines</span>
          {onReset && (
            <Button variant="ghost" size="sm" onClick={onReset} className="h-6 text-xs">
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Editor with line numbers */}
      <div className="flex-1 flex overflow-hidden">
        {/* Line numbers */}
        <div
          className="bg-muted/30 text-muted-foreground text-right select-none overflow-hidden border-r px-2 py-2 font-mono text-xs leading-5"
          style={{ minWidth: "3rem" }}
        >
          {Array.from({ length: lines }, (_, i) => (
            <div key={i + 1}>{i + 1}</div>
          ))}
        </div>

        {/* Textarea */}
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
    </div>
  );
}
