import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, User, Palette, CheckCircle2, Clock, Circle, Layers, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GanttTaskStatus, TASK_COLORS } from '@/types/gantt';

interface TaskGroupHeaderProps {
  groupKey: string;
  groupBy: 'status' | 'owner' | 'color' | 'category' | 'category_owner';
  taskCount: number;
  isExpanded: boolean;
  onToggle: () => void;
  level?: 0 | 1; // 0 = category, 1 = zone (for category_owner mode)
}

export function TaskGroupHeader({
  groupKey,
  groupBy,
  taskCount,
  isExpanded,
  onToggle,
  level = 0,
}: TaskGroupHeaderProps) {
  const getGroupIcon = () => {
    if (groupBy === 'category_owner') {
      if (level === 0) {
        return <FolderOpen className="h-4 w-4 text-muted-foreground" />;
      }
      return <div className="w-3 h-3 rounded-full bg-primary/60" />;
    }
    if (groupBy === 'status') {
      switch (groupKey as GanttTaskStatus) {
        case 'completed':
          return <CheckCircle2 className="h-4 w-4 text-green-500" />;
        case 'in_progress':
          return <Clock className="h-4 w-4 text-primary" />;
        case 'not_started':
          return <Circle className="h-4 w-4 text-muted-foreground" />;
        default:
          return null;
      }
    }
    if (groupBy === 'owner') {
      return <User className="h-4 w-4 text-muted-foreground" />;
    }
    if (groupBy === 'color') {
      const color = TASK_COLORS.find(c => c.value === groupKey);
      return (
        <div
          className="w-4 h-4 rounded-full border"
          style={{ backgroundColor: groupKey }}
          title={color?.name || groupKey}
        />
      );
    }
    if (groupBy === 'category') {
      return <Layers className="h-4 w-4 text-muted-foreground" />;
    }
    return null;
  };

  const getGroupLabel = () => {
    if (groupBy === 'category_owner') {
      return groupKey || (level === 0 ? 'Uncategorized' : 'Unassigned');
    }
    if (groupBy === 'status') {
      return groupKey.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    if (groupBy === 'owner') {
      return groupKey || 'Unassigned';
    }
    if (groupBy === 'color') {
      const color = TASK_COLORS.find(c => c.value === groupKey);
      return color?.name || 'No Color';
    }
    if (groupBy === 'category') {
      return groupKey || 'Uncategorized';
    }
    return groupKey;
  };

  const paddingLeft = groupBy === 'category_owner' ? (level === 0 ? 12 : 28) : 12;

  return (
    <div
      className={cn(
        "flex items-center gap-2 py-2 border-b cursor-pointer hover:bg-muted/70 transition-colors",
        level === 0 ? "bg-muted/50" : "bg-muted/30"
      )}
      style={{ paddingLeft, paddingRight: 12 }}
      onClick={onToggle}
    >
      {isExpanded ? (
        <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      ) : (
        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      )}
      {getGroupIcon()}
      <span className={cn("text-sm truncate", level === 0 && "font-semibold", level === 1 && "font-medium text-muted-foreground")}>
        {getGroupLabel()}
      </span>
      <Badge variant="secondary" className="ml-auto text-xs flex-shrink-0">
        {taskCount}
      </Badge>
    </div>
  );
}
