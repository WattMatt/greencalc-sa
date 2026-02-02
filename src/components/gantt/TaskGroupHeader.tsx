import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, User, Palette, CheckCircle2, Clock, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GanttTaskStatus, TASK_COLORS } from '@/types/gantt';

interface TaskGroupHeaderProps {
  groupKey: string;
  groupBy: 'status' | 'owner' | 'color';
  taskCount: number;
  isExpanded: boolean;
  onToggle: () => void;
}

export function TaskGroupHeader({
  groupKey,
  groupBy,
  taskCount,
  isExpanded,
  onToggle,
}: TaskGroupHeaderProps) {
  const getGroupIcon = () => {
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
    return null;
  };

  const getGroupLabel = () => {
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
    return groupKey;
  };

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b cursor-pointer hover:bg-muted/70 transition-colors"
      onClick={onToggle}
    >
      {isExpanded ? (
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      ) : (
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      )}
      {getGroupIcon()}
      <span className="font-medium text-sm">{getGroupLabel()}</span>
      <Badge variant="secondary" className="ml-auto text-xs">
        {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
      </Badge>
    </div>
  );
}
