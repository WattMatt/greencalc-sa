import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TASK_COLORS } from '@/types/gantt';
import { Palette, X } from 'lucide-react';

interface ColorLegendProps {
  usedColors: string[];
  onFilterColor?: (color: string) => void;
  activeColors?: string[];
  onClearFilters?: () => void;
  compact?: boolean;
}

export function ColorLegend({ 
  usedColors, 
  onFilterColor, 
  activeColors = [], 
  onClearFilters,
  compact = false 
}: ColorLegendProps) {
  // Only show colors that are actually used
  const relevantColors = TASK_COLORS.filter(c => usedColors.includes(c.value));

  if (relevantColors.length === 0) {
    return null;
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <Palette className="h-4 w-4 text-muted-foreground" />
        {relevantColors.map(color => (
          <button
            key={color.value}
            onClick={() => onFilterColor?.(color.value)}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs transition-all ${
              activeColors.includes(color.value) 
                ? 'ring-2 ring-offset-2 ring-primary' 
                : 'hover:opacity-80'
            }`}
            style={{ backgroundColor: `${color.value}20` }}
          >
            <span 
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: color.value }}
            />
            {color.name}
          </button>
        ))}
        {activeColors.length > 0 && onClearFilters && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 px-2"
            onClick={onClearFilters}
          >
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Palette className="h-4 w-4" />
          Color Legend
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {relevantColors.map(color => (
            <button
              key={color.value}
              onClick={() => onFilterColor?.(color.value)}
              className={`w-full flex items-center gap-2 p-2 rounded-md text-sm transition-all ${
                activeColors.includes(color.value) 
                  ? 'bg-primary/10 ring-1 ring-primary' 
                  : 'hover:bg-muted'
              }`}
            >
              <span 
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: color.value }}
              />
              <span className="flex-1 text-left">{color.name}</span>
            </button>
          ))}
        </div>
        {activeColors.length > 0 && onClearFilters && (
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full mt-3"
            onClick={onClearFilters}
          >
            Clear Color Filter
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
