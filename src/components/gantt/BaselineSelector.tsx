import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { GanttBaseline } from '@/types/gantt';
import { History, X, Eye } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface BaselineSelectorProps {
  baselines: GanttBaseline[];
  selectedBaselineId: string | null;
  onSelect: (baselineId: string | null) => void;
}

export function BaselineSelector({
  baselines,
  selectedBaselineId,
  onSelect,
}: BaselineSelectorProps) {
  const selectedBaseline = baselines.find(b => b.id === selectedBaselineId);

  if (baselines.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <History className="h-3 w-3" />
        Compare:
      </div>
      
      <Select
        value={selectedBaselineId || 'none'}
        onValueChange={(value) => onSelect(value === 'none' ? null : value)}
      >
        <SelectTrigger className="h-7 w-40 text-xs">
          <SelectValue placeholder="Select baseline" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">
            <span className="text-muted-foreground">No comparison</span>
          </SelectItem>
          {baselines.map((baseline) => (
            <SelectItem key={baseline.id} value={baseline.id}>
              <div className="flex flex-col">
                <span>{baseline.name}</span>
                <span className="text-[10px] text-muted-foreground">
                  {format(parseISO(baseline.created_at), 'MMM d, yyyy')}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedBaseline && (
        <Badge variant="outline" className="text-[10px] h-5 gap-1">
          <Eye className="h-3 w-3" />
          Comparing
          <button
            onClick={() => onSelect(null)}
            className="ml-1 hover:text-destructive"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}
    </div>
  );
}
