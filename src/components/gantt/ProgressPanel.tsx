import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { GanttTask, GanttTaskDependency } from '@/types/gantt';
import { getScheduleStats } from '@/lib/criticalPath';
import { CheckCircle2, Clock, AlertCircle, TrendingUp, CalendarDays, Target } from 'lucide-react';

interface ProgressPanelProps {
  tasks: GanttTask[];
  dependencies: GanttTaskDependency[];
}

export function ProgressPanel({ tasks, dependencies }: ProgressPanelProps) {
  const stats = useMemo(() => getScheduleStats(tasks, dependencies), [tasks, dependencies]);

  const completionPercentage = stats.totalTasks > 0 
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
    : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Schedule Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Overall Completion</span>
            <span className="font-medium">{completionPercentage}%</span>
          </div>
          <Progress value={completionPercentage} className="h-2" />
        </div>

        {/* Task Stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-md bg-muted/50">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Clock className="h-3 w-3" />
            </div>
            <p className="text-lg font-semibold">{stats.notStartedTasks}</p>
            <p className="text-[10px] text-muted-foreground">Not Started</p>
          </div>
          <div className="p-2 rounded-md bg-primary/10">
            <div className="flex items-center justify-center gap-1 text-primary mb-1">
              <TrendingUp className="h-3 w-3" />
            </div>
            <p className="text-lg font-semibold text-primary">{stats.inProgressTasks}</p>
            <p className="text-[10px] text-muted-foreground">In Progress</p>
          </div>
          <div className="p-2 rounded-md bg-green-500/10">
            <div className="flex items-center justify-center gap-1 text-green-600 dark:text-green-400 mb-1">
              <CheckCircle2 className="h-3 w-3" />
            </div>
            <p className="text-lg font-semibold text-green-600 dark:text-green-400">{stats.completedTasks}</p>
            <p className="text-[10px] text-muted-foreground">Completed</p>
          </div>
        </div>

        {/* Average Progress */}
        <div className="flex items-center justify-between p-2 rounded-md bg-muted/30">
          <span className="text-sm text-muted-foreground">Average Progress</span>
          <Badge variant="outline">{stats.averageProgress}%</Badge>
        </div>

        {/* Project Duration */}
        <div className="flex items-center justify-between p-2 rounded-md bg-muted/30">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Duration</span>
          </div>
          <Badge variant="outline">{stats.projectDuration} days</Badge>
        </div>

        {/* Critical Path */}
        {stats.criticalTaskCount > 0 && (
          <div className="flex items-center justify-between p-2 rounded-md bg-destructive/10">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span className="text-sm text-muted-foreground">Critical Path</span>
            </div>
            <Badge variant="outline" className="border-destructive/50 text-destructive">
              {stats.criticalTaskCount} tasks
            </Badge>
          </div>
        )}

        {/* Task Summary */}
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground text-center">
            {stats.totalTasks} total tasks • {dependencies.length} dependencies
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
