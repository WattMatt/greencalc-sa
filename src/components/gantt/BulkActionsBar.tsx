import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { GanttTaskStatus, TASK_COLORS } from '@/types/gantt';
import { X, CheckCircle2, Trash2, Palette, User } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface BulkActionsBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBulkUpdate: (changes: { status?: GanttTaskStatus; owner?: string; color?: string; progress?: number }) => Promise<void>;
  onBulkDelete: () => Promise<void>;
}

export function BulkActionsBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  onBulkUpdate,
  onBulkDelete,
}: BulkActionsBarProps) {
  return (
    <div className="flex items-center gap-3 p-3 bg-primary/10 border border-primary/20 rounded-lg animate-in slide-in-from-top-2">
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="font-medium">
          {selectedCount} selected
        </Badge>
        {selectedCount < totalCount && (
          <Button variant="ghost" size="sm" onClick={onSelectAll}>
            Select all ({totalCount})
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onClearSelection}>
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Status change */}
      <Select onValueChange={(value) => onBulkUpdate({ status: value as GanttTaskStatus })}>
        <SelectTrigger className="w-40 h-8">
          <CheckCircle2 className="h-4 w-4 mr-1" />
          <SelectValue placeholder="Set status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="not_started">Not Started</SelectItem>
          <SelectItem value="in_progress">In Progress</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
        </SelectContent>
      </Select>

      {/* Color change */}
      <Select onValueChange={(value) => onBulkUpdate({ color: value === 'default' ? null : value })}>
        <SelectTrigger className="w-36 h-8">
          <Palette className="h-4 w-4 mr-1" />
          <SelectValue placeholder="Set color" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="default">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary" />
              Default
            </div>
          </SelectItem>
          {TASK_COLORS.map((color) => (
            <SelectItem key={color.value} value={color.value}>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color.value }} />
                {color.name}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Progress presets */}
      <Select onValueChange={(value) => onBulkUpdate({ progress: parseInt(value) })}>
        <SelectTrigger className="w-36 h-8">
          <SelectValue placeholder="Set progress" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="0">0%</SelectItem>
          <SelectItem value="25">25%</SelectItem>
          <SelectItem value="50">50%</SelectItem>
          <SelectItem value="75">75%</SelectItem>
          <SelectItem value="100">100%</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex-1" />

      {/* Bulk delete */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm">
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedCount} tasks?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All selected tasks and their dependencies will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Tasks
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
