import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { GanttTask } from '@/types/gantt';
import { format, parseISO, differenceInDays, isWithinInterval, eachDayOfInterval, addDays } from 'date-fns';
import { User, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ResourceWorkloadViewProps {
  tasks: GanttTask[];
  startDate?: Date;
  endDate?: Date;
}

interface OwnerWorkload {
  owner: string;
  totalTasks: number;
  completedTasks: number;
  totalDays: number;
  overloadedDays: number;
  tasks: GanttTask[];
  dailyLoad: Map<string, number>; // date string -> task count
}

export function ResourceWorkloadView({ tasks, startDate, endDate }: ResourceWorkloadViewProps) {
  // Group tasks by owner and calculate workload
  const workloads = useMemo(() => {
    const ownerMap = new Map<string, OwnerWorkload>();
    
    // Filter tasks with owners
    const assignedTasks = tasks.filter(t => t.owner);
    
    assignedTasks.forEach(task => {
      const owner = task.owner!;
      
      if (!ownerMap.has(owner)) {
        ownerMap.set(owner, {
          owner,
          totalTasks: 0,
          completedTasks: 0,
          totalDays: 0,
          overloadedDays: 0,
          tasks: [],
          dailyLoad: new Map(),
        });
      }
      
      const workload = ownerMap.get(owner)!;
      workload.totalTasks += 1;
      workload.tasks.push(task);
      
      if (task.status === 'completed') {
        workload.completedTasks += 1;
      }
      
      // Calculate days
      const taskStart = parseISO(task.start_date);
      const taskEnd = parseISO(task.end_date);
      const days = differenceInDays(taskEnd, taskStart) + 1;
      workload.totalDays += days;
      
      // Track daily load
      const taskDays = eachDayOfInterval({ start: taskStart, end: taskEnd });
      taskDays.forEach(day => {
        const dateKey = format(day, 'yyyy-MM-dd');
        workload.dailyLoad.set(dateKey, (workload.dailyLoad.get(dateKey) || 0) + 1);
      });
    });
    
    // Calculate overloaded days (more than 2 tasks per day)
    ownerMap.forEach(workload => {
      workload.overloadedDays = Array.from(workload.dailyLoad.values())
        .filter(count => count > 2).length;
    });
    
    return Array.from(ownerMap.values())
      .sort((a, b) => b.totalTasks - a.totalTasks);
  }, [tasks]);

  // Unassigned tasks
  const unassignedTasks = useMemo(() => {
    return tasks.filter(t => !t.owner);
  }, [tasks]);

  if (workloads.length === 0 && unassignedTasks.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          <User className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p>No task assignments yet</p>
          <p className="text-sm">Assign owners to tasks to see workload distribution</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <User className="h-4 w-4" />
          Resource Workload
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {workloads.map(workload => (
          <div key={workload.owner} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{workload.owner}</span>
                {workload.overloadedDays > 0 && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                      </TooltipTrigger>
                      <TooltipContent>
                        {workload.overloadedDays} day(s) with 3+ concurrent tasks
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {workload.completedTasks}/{workload.totalTasks} tasks
                </Badge>
              </div>
            </div>
            
            <Progress 
              value={(workload.completedTasks / workload.totalTasks) * 100}
              className="h-2"
            />
            
            {/* Task pills */}
            <div className="flex flex-wrap gap-1">
              {workload.tasks.slice(0, 5).map(task => (
                <TooltipProvider key={task.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-xs truncate max-w-[120px]",
                          task.status === 'completed' && "opacity-60 line-through"
                        )}
                        style={{ 
                          backgroundColor: task.color ? `${task.color}20` : undefined,
                          borderColor: task.color || undefined,
                        }}
                      >
                        {task.name}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-sm">
                        <p className="font-medium">{task.name}</p>
                        <p className="text-muted-foreground">
                          {format(parseISO(task.start_date), 'MMM d')} - {format(parseISO(task.end_date), 'MMM d')}
                        </p>
                        <p>Progress: {task.progress}%</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
              {workload.tasks.length > 5 && (
                <Badge variant="outline" className="text-xs">
                  +{workload.tasks.length - 5} more
                </Badge>
              )}
            </div>
          </div>
        ))}
        
        {/* Unassigned tasks */}
        {unassignedTasks.length > 0 && (
          <div className="pt-3 border-t">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Unassigned</span>
              <Badge variant="destructive" className="text-xs">
                {unassignedTasks.length} tasks
              </Badge>
            </div>
            <div className="flex flex-wrap gap-1">
              {unassignedTasks.slice(0, 5).map(task => (
                <Badge
                  key={task.id}
                  variant="outline"
                  className="text-xs truncate max-w-[120px] border-dashed"
                >
                  {task.name}
                </Badge>
              ))}
              {unassignedTasks.length > 5 && (
                <Badge variant="outline" className="text-xs border-dashed">
                  +{unassignedTasks.length - 5} more
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
