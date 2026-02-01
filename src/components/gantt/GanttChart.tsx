import { useMemo, useState, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu';
import { GanttTask, GanttTaskDependency, GanttMilestone, GanttChartConfig, GanttDependencyType } from '@/types/gantt';
import { calculateCriticalPath } from '@/lib/criticalPath';
import { format, parseISO, differenceInDays, addDays, startOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, eachWeekOfInterval, isSameMonth, isWeekend, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight, Flag, Trash2, Edit2, Link, Unlink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GanttChartProps {
  tasks: GanttTask[];
  dependencies: GanttTaskDependency[];
  milestones: GanttMilestone[];
  config: GanttChartConfig;
  selectedTasks: Set<string>;
  onSelectTask: (taskId: string, selected: boolean) => void;
  onEditTask: (task: GanttTask) => void;
  onUpdateTask: (id: string, updates: Partial<GanttTask>) => void;
  onDeleteTask: (id: string) => void;
  onCreateDependency: (predecessorId: string, successorId: string, type: GanttDependencyType) => void;
  onDeleteDependency: (id: string) => void;
}

const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 60;
const TASK_BAR_HEIGHT = 28;
const DAY_WIDTH = { day: 40, week: 20, month: 8 };

export function GanttChart({
  tasks,
  dependencies,
  milestones,
  config,
  selectedTasks,
  onSelectTask,
  onEditTask,
  onUpdateTask,
  onDeleteTask,
  onCreateDependency,
  onDeleteDependency,
}: GanttChartProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewOffset, setViewOffset] = useState(0);

  // Calculate date range
  const { startDate, endDate, totalDays } = useMemo(() => {
    if (tasks.length === 0) {
      const today = new Date();
      return {
        startDate: startOfWeek(today),
        endDate: addDays(today, 30),
        totalDays: 30,
      };
    }

    const allDates = [
      ...tasks.flatMap((t) => [parseISO(t.start_date), parseISO(t.end_date)]),
      ...milestones.map((m) => parseISO(m.date)),
    ];

    const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())));

    // Add padding
    const start = addDays(startOfWeek(minDate), -7);
    const end = addDays(maxDate, 14);

    return {
      startDate: start,
      endDate: end,
      totalDays: differenceInDays(end, start) + 1,
    };
  }, [tasks, milestones]);

  // Critical path calculation
  const criticalPathIds = useMemo(() => {
    return new Set(calculateCriticalPath(tasks, dependencies));
  }, [tasks, dependencies]);

  const dayWidth = DAY_WIDTH[config.viewMode];
  const chartWidth = totalDays * dayWidth;

  // Generate time header cells
  const timeHeaders = useMemo(() => {
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    
    if (config.viewMode === 'day') {
      return days.map((day) => ({
        date: day,
        label: format(day, 'd'),
        subLabel: format(day, 'EEE'),
        width: dayWidth,
        isWeekend: isWeekend(day),
        isToday: isToday(day),
      }));
    }
    
    if (config.viewMode === 'week') {
      const weeks = eachWeekOfInterval({ start: startDate, end: endDate });
      return weeks.map((weekStart) => ({
        date: weekStart,
        label: format(weekStart, 'MMM d'),
        subLabel: `Week ${format(weekStart, 'w')}`,
        width: dayWidth * 7,
        isWeekend: false,
        isToday: false,
      }));
    }

    // Month view
    const months: typeof days = [];
    let current = startOfMonth(startDate);
    while (current <= endDate) {
      months.push(current);
      current = addDays(endOfMonth(current), 1);
    }
    return months.map((monthStart) => {
      const monthEnd = endOfMonth(monthStart);
      const daysInView = Math.min(
        differenceInDays(monthEnd, monthStart) + 1,
        differenceInDays(endDate, monthStart) + 1
      );
      return {
        date: monthStart,
        label: format(monthStart, 'MMMM yyyy'),
        subLabel: '',
        width: daysInView * dayWidth,
        isWeekend: false,
        isToday: false,
      };
    });
  }, [startDate, endDate, config.viewMode, dayWidth]);

  // Calculate task bar positions
  const getTaskPosition = useCallback((task: GanttTask) => {
    const taskStart = parseISO(task.start_date);
    const taskEnd = parseISO(task.end_date);
    const left = differenceInDays(taskStart, startDate) * dayWidth;
    const width = (differenceInDays(taskEnd, taskStart) + 1) * dayWidth;
    return { left, width };
  }, [startDate, dayWidth]);

  // Get milestone position
  const getMilestonePosition = useCallback((milestone: GanttMilestone) => {
    const date = parseISO(milestone.date);
    return differenceInDays(date, startDate) * dayWidth;
  }, [startDate, dayWidth]);

  // Status badge colors
  const statusColors = {
    not_started: 'bg-muted text-muted-foreground',
    in_progress: 'bg-primary/20 text-primary',
    completed: 'bg-green-500/20 text-green-700 dark:text-green-400',
  };

  const scrollToToday = () => {
    const todayOffset = differenceInDays(new Date(), startDate) * dayWidth;
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = todayOffset - scrollRef.current.clientWidth / 2;
    }
  };

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex flex-col">
          {/* Controls */}
          <div className="flex items-center justify-between p-2 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={scrollToToday}>
                Today
              </Button>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => scrollRef.current?.scrollBy({ left: -200, behavior: 'smooth' })}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => scrollRef.current?.scrollBy({ left: 200, behavior: 'smooth' })}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Chart container */}
          <div className="flex">
            {/* Task list (left panel) */}
            <div className="w-64 flex-shrink-0 border-r">
              {/* Header */}
              <div 
                className="flex items-center px-3 font-medium text-sm text-muted-foreground bg-muted/50 border-b"
                style={{ height: HEADER_HEIGHT }}
              >
                Task Name
              </div>
              
              {/* Task rows */}
              <div className="divide-y">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className={cn(
                      "flex items-center gap-2 px-2 hover:bg-muted/50 cursor-pointer group",
                      selectedTasks.has(task.id) && "bg-primary/10"
                    )}
                    style={{ height: ROW_HEIGHT }}
                    onClick={() => onEditTask(task)}
                  >
                    <Checkbox
                      checked={selectedTasks.has(task.id)}
                      onCheckedChange={(checked) => onSelectTask(task.id, !!checked)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{task.name}</p>
                    </div>
                    <Badge variant="outline" className={cn("text-[10px] h-5", statusColors[task.status])}>
                      {task.progress}%
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Gantt timeline (right panel) */}
            <div className="flex-1 overflow-x-auto" ref={scrollRef}>
              <div style={{ width: chartWidth, minWidth: '100%' }}>
                {/* Time header */}
                <div 
                  className="flex border-b bg-muted/30 sticky top-0"
                  style={{ height: HEADER_HEIGHT }}
                >
                  {timeHeaders.map((header, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex flex-col items-center justify-center border-r text-xs",
                        header.isWeekend && "bg-muted/50",
                        header.isToday && "bg-primary/10"
                      )}
                      style={{ width: header.width }}
                    >
                      <span className="font-medium">{header.label}</span>
                      {header.subLabel && (
                        <span className="text-muted-foreground">{header.subLabel}</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Task bars */}
                <div className="relative">
                  {/* Grid lines */}
                  {config.showToday && (
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-primary/50 z-10"
                      style={{ 
                        left: differenceInDays(new Date(), startDate) * dayWidth,
                        height: tasks.length * ROW_HEIGHT + (milestones.length > 0 ? ROW_HEIGHT : 0),
                      }}
                    />
                  )}

                  {/* Task rows */}
                  {tasks.map((task, index) => {
                    const { left, width } = getTaskPosition(task);
                    const isCritical = criticalPathIds.has(task.id);

                    return (
                      <TooltipProvider key={task.id}>
                        <div
                          className={cn(
                            "relative border-b",
                            selectedTasks.has(task.id) && "bg-primary/5"
                          )}
                          style={{ height: ROW_HEIGHT }}
                        >
                          {/* Weekend highlighting for day view */}
                          {config.viewMode === 'day' && config.showWeekends && (
                            <>
                              {eachDayOfInterval({ start: startDate, end: endDate })
                                .filter(isWeekend)
                                .map((day, i) => (
                                  <div
                                    key={i}
                                    className="absolute top-0 bottom-0 bg-muted/30"
                                    style={{
                                      left: differenceInDays(day, startDate) * dayWidth,
                                      width: dayWidth,
                                    }}
                                  />
                                ))}
                            </>
                          )}

                          {/* Task bar */}
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className={cn(
                                      "absolute rounded cursor-pointer transition-all hover:ring-2 hover:ring-primary/50",
                                      isCritical ? "ring-1 ring-destructive" : "",
                                      task.color ? "" : "bg-primary"
                                    )}
                                    style={{
                                      left,
                                      width: Math.max(width, 20),
                                      top: (ROW_HEIGHT - TASK_BAR_HEIGHT) / 2,
                                      height: TASK_BAR_HEIGHT,
                                      backgroundColor: task.color || undefined,
                                    }}
                                    onClick={() => onEditTask(task)}
                                  >
                                    {/* Progress fill */}
                                    <div
                                      className="absolute inset-0 rounded opacity-40 bg-background"
                                      style={{ width: `${100 - task.progress}%`, right: 0, left: 'auto' }}
                                    />
                                    
                                    {/* Task name if wide enough */}
                                    {width > 60 && (
                                      <span className="absolute inset-0 flex items-center px-2 text-xs text-primary-foreground truncate font-medium">
                                        {task.name}
                                      </span>
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <div className="text-sm">
                                    <p className="font-medium">{task.name}</p>
                                    <p className="text-muted-foreground">
                                      {format(parseISO(task.start_date), 'MMM d')} - {format(parseISO(task.end_date), 'MMM d, yyyy')}
                                    </p>
                                    <p>Progress: {task.progress}%</p>
                                    {task.owner && <p>Owner: {task.owner}</p>}
                                    {isCritical && <p className="text-destructive">On Critical Path</p>}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </ContextMenuTrigger>
                            <ContextMenuContent>
                              <ContextMenuItem onClick={() => onEditTask(task)}>
                                <Edit2 className="h-4 w-4 mr-2" />
                                Edit Task
                              </ContextMenuItem>
                              <ContextMenuSeparator />
                              <ContextMenuItem 
                                onClick={() => onDeleteTask(task.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Task
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        </div>
                      </TooltipProvider>
                    );
                  })}

                  {/* Milestones row */}
                  {milestones.length > 0 && (
                    <div className="relative border-t-2 border-dashed" style={{ height: ROW_HEIGHT }}>
                      {milestones.map((milestone) => {
                        const left = getMilestonePosition(milestone);
                        return (
                          <TooltipProvider key={milestone.id}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className="absolute flex items-center justify-center"
                                  style={{
                                    left: left - 12,
                                    top: (ROW_HEIGHT - 24) / 2,
                                  }}
                                >
                                  <Flag
                                    className="h-6 w-6"
                                    style={{ color: milestone.color || 'hsl(var(--primary))' }}
                                    fill={milestone.color || 'hsl(var(--primary))'}
                                  />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div>
                                  <p className="font-medium">{milestone.name}</p>
                                  <p className="text-muted-foreground">
                                    {format(parseISO(milestone.date), 'MMM d, yyyy')}
                                  </p>
                                  {milestone.description && <p className="text-sm">{milestone.description}</p>}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      })}
                    </div>
                  )}

                  {/* Dependency arrows */}
                  {config.showDependencies && (
                    <svg
                      className="absolute top-0 left-0 pointer-events-none"
                      style={{ width: chartWidth, height: tasks.length * ROW_HEIGHT }}
                    >
                      {dependencies.map((dep) => {
                        const predTask = tasks.find((t) => t.id === dep.predecessor_id);
                        const succTask = tasks.find((t) => t.id === dep.successor_id);
                        if (!predTask || !succTask) return null;

                        const predIndex = tasks.indexOf(predTask);
                        const succIndex = tasks.indexOf(succTask);
                        const predPos = getTaskPosition(predTask);
                        const succPos = getTaskPosition(succTask);

                        const startX = predPos.left + predPos.width;
                        const startY = predIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
                        const endX = succPos.left;
                        const endY = succIndex * ROW_HEIGHT + ROW_HEIGHT / 2;

                        const midX = (startX + endX) / 2;

                        return (
                          <g key={dep.id}>
                            <path
                              d={`M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`}
                              fill="none"
                              stroke="hsl(var(--muted-foreground))"
                              strokeWidth="1.5"
                              strokeDasharray="4"
                              markerEnd="url(#arrowhead)"
                            />
                          </g>
                        );
                      })}
                      <defs>
                        <marker
                          id="arrowhead"
                          markerWidth="10"
                          markerHeight="7"
                          refX="9"
                          refY="3.5"
                          orient="auto"
                        >
                          <polygon
                            points="0 0, 10 3.5, 0 7"
                            fill="hsl(var(--muted-foreground))"
                          />
                        </marker>
                      </defs>
                    </svg>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
