import { useMemo, useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { TrendingDown, TrendingUp } from "lucide-react";
import type { LossBreakdownItem } from "@/lib/pvsystLossChain";

interface LossWaterfallChartProps {
  breakdown: LossBreakdownItem[];
  performanceRatio: number;
  className?: string;
  editable?: boolean;
  onLossChange?: (stage: string, newValue: number) => void;
}

export function LossWaterfallChart({ 
  breakdown, 
  performanceRatio, 
  className,
  editable = false,
  onLossChange
}: LossWaterfallChartProps) {
  const [editingStage, setEditingStage] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingStage && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingStage]);

  // Calculate running total for waterfall visualization
  const waterfallData = useMemo(() => {
    let runningPercent = 100;
    
    return breakdown
      .filter(item => item.lossPercent !== 0 || item.stage === "GHI Input")
      .map((item, index) => {
        const isFirst = index === 0;
        const isGain = item.isGain || item.lossPercent < 0;
        
        if (isFirst) {
          return {
            ...item,
            startPercent: 0,
            endPercent: 100,
            runningPercent: 100,
            barWidth: 100,
            isGain: false,
          };
        }
        
        const loss = isGain ? -Math.abs(item.lossPercent) : Math.abs(item.lossPercent);
        const startPercent = runningPercent;
        runningPercent = runningPercent - loss;
        
        return {
          ...item,
          startPercent,
          endPercent: runningPercent,
          runningPercent,
          barWidth: Math.abs(loss),
          isGain,
        };
      });
  }, [breakdown]);

  const handleEditClick = (stage: string, currentValue: number) => {
    if (!editable || stage === "GHI Input") return;
    setEditingStage(stage);
    setEditValue(Math.abs(currentValue).toFixed(4));
  };

  const handleEditBlur = () => {
    if (editingStage && onLossChange) {
      const newValue = parseFloat(editValue);
      if (!isNaN(newValue)) {
        onLossChange(editingStage, newValue);
      }
    }
    setEditingStage(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleEditBlur();
    } else if (e.key === "Escape") {
      setEditingStage(null);
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Loss Waterfall</CardTitle>
          <Badge variant="outline" className="text-xs">
            PR: {performanceRatio.toFixed(1)}%
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Sequential energy losses from GHI to grid injection
          {editable && <span className="text-primary ml-1">(click values to edit)</span>}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="space-y-1.5">
          {waterfallData.map((item, index) => {
            const isFirst = index === 0;
            const isGain = item.isGain;
            const isLast = item.stage === "System Unavailability";
            const isEditing = editingStage === item.stage;
            
            return (
              <div key={item.stage} className="flex items-center gap-2 text-xs">
                {/* Stage label */}
                <div className="w-32 truncate text-muted-foreground text-right" title={item.stage}>
                  {item.stage}
                </div>
                
                {/* Bar container */}
                <div className="flex-1 h-5 bg-muted/30 rounded relative overflow-hidden">
                  {/* Filled bar */}
                  <div
                    className={`absolute top-0 h-full rounded transition-all ${
                      isFirst
                        ? "bg-primary/60"
                        : isGain
                        ? "bg-green-500/60"
                        : isLast
                        ? "bg-primary"
                        : "bg-amber-500/60"
                    }`}
                    style={{
                      left: isFirst || isGain ? 0 : `${item.endPercent}%`,
                      width: isFirst ? "100%" : `${item.barWidth}%`,
                    }}
                  />
                  
                  {/* Running total line */}
                  {!isFirst && (
                    <div
                      className="absolute top-0 h-full w-0.5 bg-foreground/30"
                      style={{ left: `${item.runningPercent}%` }}
                    />
                  )}
                </div>
                
                {/* Loss/Gain value - editable */}
                <div className={`w-20 text-right flex items-center justify-end gap-1 ${
                  isFirst 
                    ? "text-muted-foreground"
                    : isGain 
                    ? "text-green-600" 
                    : "text-amber-600"
                }`}>
                  {!isFirst && (
                    isGain ? (
                      <TrendingUp className="h-3 w-3 flex-shrink-0" />
                    ) : (
                      <TrendingDown className="h-3 w-3 flex-shrink-0" />
                    )
                  )}
                  {isEditing ? (
                    <Input
                      ref={inputRef}
                      type="text"
                      inputMode="decimal"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={handleEditBlur}
                      onKeyDown={handleKeyDown}
                      className="h-5 w-16 text-xs text-right px-1 py-0"
                    />
                  ) : (
                    <span
                      className={`${editable && !isFirst ? "cursor-pointer hover:underline" : ""}`}
                      onClick={() => handleEditClick(item.stage, item.lossPercent)}
                      title={editable && !isFirst ? "Click to edit (4 decimal places)" : undefined}
                    >
                      {isFirst ? (
                        "100%"
                      ) : isGain ? (
                        `+${Math.abs(item.lossPercent).toFixed(1)}%`
                      ) : (
                        `-${Math.abs(item.lossPercent).toFixed(1)}%`
                      )}
                    </span>
                  )}
                </div>
                
                {/* Running total */}
                <div className="w-12 text-right font-medium">
                  {item.runningPercent.toFixed(1)}%
                </div>
              </div>
            );
          })}
          
          {/* Final E_Grid line */}
          <div className="flex items-center gap-2 text-xs border-t pt-2 mt-2">
            <div className="w-32 truncate text-right font-medium text-primary">
              E_Grid Output
            </div>
            <div className="flex-1 h-5 bg-muted/30 rounded relative overflow-hidden">
              <div
                className="absolute top-0 h-full rounded bg-primary"
                style={{ width: `${performanceRatio}%` }}
              />
            </div>
            <div className="w-20 text-right text-muted-foreground">—</div>
            <div className="w-12 text-right font-bold text-primary">
              {performanceRatio.toFixed(1)}%
            </div>
          </div>
        </div>
        
        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground justify-center">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-500/60" />
            <span>Gain</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-amber-500/60" />
            <span>Loss</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-primary" />
            <span>Final PR</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
