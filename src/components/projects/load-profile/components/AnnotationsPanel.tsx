import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MessageSquare, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Annotation } from "../types";

interface AnnotationsPanelProps {
  annotations: Annotation[];
  setAnnotations: React.Dispatch<React.SetStateAction<Annotation[]>>;
}

export function AnnotationsPanel({ annotations, setAnnotations }: AnnotationsPanelProps) {
  const [editingAnnotation, setEditingAnnotation] = useState<string | null>(null);

  const addAnnotation = useCallback((hour: number) => {
    const newAnnotation: Annotation = {
      id: `${Date.now()}`,
      hour,
      text: "",
      color: "hsl(var(--primary))",
    };
    setAnnotations((prev) => [...prev, newAnnotation]);
    setEditingAnnotation(newAnnotation.id);
  }, [setAnnotations]);

  const updateAnnotation = useCallback(
    (id: string, text: string) => {
      setAnnotations((prev) => prev.map((a) => (a.id === id ? { ...a, text } : a)));
    },
    [setAnnotations]
  );

  const deleteAnnotation = useCallback(
    (id: string) => {
      setAnnotations((prev) => prev.filter((a) => a.id !== id));
      setEditingAnnotation(null);
    },
    [setAnnotations]
  );

  const clearAllAnnotations = useCallback(() => {
    setAnnotations([]);
    toast.success("All annotations cleared");
  }, [setAnnotations]);

  return (
    <div className="mt-3 pt-3 border-t space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Chart Notes</span>
          <Badge variant="secondary" className="text-[10px]">
            {annotations.length}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                <Plus className="h-3 w-3" />
                Add Note
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 bg-popover z-50" align="end">
              <div className="space-y-2">
                <p className="text-sm font-medium">Select Hour</p>
                <div className="grid grid-cols-6 gap-1">
                  {Array.from({ length: 24 }, (_, h) => (
                    <Button
                      key={h}
                      variant={annotations.some((a) => a.hour === h) ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs p-0"
                      onClick={() => {
                        if (!annotations.some((a) => a.hour === h)) {
                          addAnnotation(h);
                        }
                      }}
                    >
                      {h.toString().padStart(2, "0")}
                    </Button>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
          {annotations.length > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={clearAllAnnotations}>
              Clear All
            </Button>
          )}
        </div>
      </div>

      {/* Annotation List */}
      {annotations.length > 0 && (
        <div className="space-y-1.5">
          {annotations
            .sort((a, b) => a.hour - b.hour)
            .map((annotation) => (
              <div key={annotation.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                <Badge variant="outline" className="text-[10px] min-w-[40px] justify-center">
                  {annotation.hour.toString().padStart(2, "0")}:00
                </Badge>
                <Input
                  value={annotation.text}
                  onChange={(e) => updateAnnotation(annotation.id, e.target.value)}
                  placeholder="Add note..."
                  className="h-7 text-xs flex-1"
                  autoFocus={editingAnnotation === annotation.id}
                  onBlur={() => setEditingAnnotation(null)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteAnnotation(annotation.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
        </div>
      )}

      {annotations.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Click "Add Note" to annotate specific hours on the chart</p>}
    </div>
  );
}
