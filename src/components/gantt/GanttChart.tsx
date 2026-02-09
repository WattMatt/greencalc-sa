import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu';
import { GanttTask, GanttTaskDependency, GanttMilestone, GanttChartConfig, GanttDependencyType, GanttBaselineTask, GanttTaskSegment, GroupByMode } from '@/types/gantt';
import { calculateCriticalPath } from '@/lib/criticalPath';
import { format, parseISO, differenceInDays, addDays, startOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, eachWeekOfInterval, isSameMonth, isWeekend, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight, Flag, Trash2, Edit2, Link, Unlink, GripVertical, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGanttDrag, DragMode } from '@/hooks/useGanttDrag';
import { useDependencyDrag } from '@/hooks/useDependencyDrag';
import { DependencyDragLine } from './DependencyDragLine';
import { TaskGroupHeader } from './TaskGroupHeader';

interface GanttChartProps {
  tasks: GanttTask[];
  dependencies: GanttTaskDependency[];
  milestones: GanttMilestone[];
  config: GanttChartConfig;
  selectedTasks: Set<string>;
  baselineTasks?: GanttBaselineTask[];
  segmentsByTaskId?: Map<string, GanttTaskSegment[]>;
  onSelectTask: (taskId: string, selected: boolean) => void;
  onEditTask: (task: GanttTask) => void;
  onUpdateTask: (id: string, updates: Partial<GanttTask>) => void;
  onDeleteTask: (id: string) => void;
  onCreateDependency: (predecessorId: string, successorId: string, type: GanttDependencyType) => void;
  onDeleteDependency: (id: string) => void;
  onReorderTasks?: (orderedIds: string[]) => void;
  onRequestDependencyType?: (predecessorId: string, successorId: string) => void;
}

const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 60;
const TASK_BAR_HEIGHT = 28;
const BASELINE_BAR_HEIGHT = 8;
const DAY_WIDTH = { day: 40, week: 20, month: 8 };
const DRAG_HANDLE_WIDTH = 8;

export function GanttChart({
  tasks,
  dependencies,
  milestones,
  config,
  selectedTasks,
  baselineTasks = [],
  segmentsByTaskId,
  onSelectTask,
  onEditTask,
  onUpdateTask,
  onDeleteTask,
  onCreateDependency,
  onDeleteDependency,
  onReorderTasks,
  onRequestDependencyType,
}: GanttChartProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const [viewOffset, setViewOffset] = useState(0);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [dragReorderTaskId, setDragReorderTaskId] = useState<string | null>(null);

  const dayWidth = DAY_WIDTH[config.viewMode];

  // Drag hooks
  const { isDragging, dragState, startDrag, updateDrag, endDrag, cancelDrag, getDragPreview } = useGanttDrag({
    dayWidth,
    onUpdateTask: (id, updates) => onUpdateTask(id, updates),
  });

  const { isDraggingDependency, dependencyDragState, startDependencyDrag, updateDependencyDrag, endDependencyDrag, cancelDependencyDrag } = useDependencyDrag({
    onCreateDependency,
    onRequestDependencyType,
  });

  // Mouse move handler for drag operations
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        updateDrag(e.clientX);
      }
      if (isDraggingDependency && scrollRef.current) {
        const scrollRect = scrollRef.current.getBoundingClientRect();
        // Account for scroll position and header height
        const scrollLeft = scrollRef.current.scrollLeft;
        const x = e.clientX - scrollRect.left + scrollLeft;
        // y is relative to the task bars container (after header)
        const y = e.clientY - scrollRect.top - HEADER_HEIGHT;
        updateDependencyDrag(x, y);
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        endDrag();
      }
      if (isDraggingDependency) {
        cancelDependencyDrag();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancelDrag();
        cancelDependencyDrag();
      }
    };

    if (isDragging || isDraggingDependency) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDragging, isDraggingDependency, updateDrag, endDrag, cancelDrag, updateDependencyDrag, cancelDependencyDrag]);

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
  const chartWidth = totalDays * dayWidth;

  // Group tasks by specified field
  const groupedTasks = useMemo(() => {
    if (config.groupBy === 'none' || config.groupBy === 'category_owner') {
      return { '': tasks };
    }

    const groups: Record<string, GanttTask[]> = {};
    for (const task of tasks) {
      let groupKey = '';
      if (config.groupBy === 'status') {
        groupKey = task.status;
      } else if (config.groupBy === 'owner') {
        groupKey = task.owner || '';
      } else if (config.groupBy === 'color') {
        groupKey = task.color || '';
      } else if (config.groupBy === 'category') {
        groupKey = task.description || '';
      }
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(task);
    }
    return groups;
  }, [tasks, config.groupBy]);

  // Hierarchical grouping for category_owner mode
  type VisibleRow = 
    | { type: 'category-header'; key: string; label: string; taskCount: number }
    | { type: 'zone-header'; key: string; label: string; categoryKey: string; taskCount: number }
    | { type: 'task'; task: GanttTask };

  const hierarchicalRows = useMemo<VisibleRow[]>(() => {
    if (config.groupBy !== 'category_owner') return [];

    // Build ordered structure preserving sort_order
    const catMap = new Map<string, Map<string, GanttTask[]>>();
    const catOrder: string[] = [];

    for (const task of tasks) {
      const cat = task.description || '';
      const zone = task.owner || '';
      if (!catMap.has(cat)) {
        catMap.set(cat, new Map());
        catOrder.push(cat);
      }
      const zoneMap = catMap.get(cat)!;
      if (!zoneMap.has(zone)) {
        zoneMap.set(zone, []);
      }
      zoneMap.get(zone)!.push(task);
    }

    const rows: VisibleRow[] = [];
    for (const cat of catOrder) {
      const zoneMap = catMap.get(cat)!;
      const catTaskCount = Array.from(zoneMap.values()).reduce((sum, arr) => sum + arr.length, 0);
      const catKey = `cat::${cat}`;
      rows.push({ type: 'category-header', key: catKey, label: cat, taskCount: catTaskCount });

      if (!collapsedGroups.has(catKey)) {
        const skipZoneHeader = zoneMap.size === 1 && !Array.from(zoneMap.keys())[0];
        for (const [zone, zoneTasks] of zoneMap) {
          if (!skipZoneHeader) {
            const zoneKey = `zone::${cat}::${zone}`;
            rows.push({ type: 'zone-header', key: zoneKey, label: zone, categoryKey: catKey, taskCount: zoneTasks.length });

            if (!collapsedGroups.has(zoneKey)) {
              for (const task of zoneTasks) {
                rows.push({ type: 'task', task });
              }
            }
          } else {
            for (const task of zoneTasks) {
              rows.push({ type: 'task', task });
            }
          }
        }
      }
    }
    return rows;
  }, [tasks, config.groupBy, collapsedGroups]);

  // Calculate baseline position for a task
  const getBaselinePosition = useCallback((taskId: string) => {
    const baselineTask = baselineTasks.find(bt => bt.task_id === taskId);
    if (!baselineTask) return null;
    
    const taskStart = parseISO(baselineTask.start_date);
    const taskEnd = parseISO(baselineTask.end_date);
    const left = differenceInDays(taskStart, startDate) * dayWidth;
    const width = (differenceInDays(taskEnd, taskStart) + 1) * dayWidth;
    return { left, width };
  }, [baselineTasks, startDate, dayWidth]);

  // Toggle group expansion
  const toggleGroup = useCallback((groupKey: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }, []);

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
  const getTaskPosition = useCallback((task: GanttTask, preview?: { startDate: Date; endDate: Date } | null) => {
    const taskStart = preview?.startDate || parseISO(task.start_date);
    const taskEnd = preview?.endDate || parseISO(task.end_date);
    const left = differenceInDays(taskStart, startDate) * dayWidth;
    const width = (differenceInDays(taskEnd, taskStart) + 1) * dayWidth;
    return { left, width };
  }, [startDate, dayWidth]);

  // Get segment positions for a task
  const getSegmentPositions = useCallback((taskId: string) => {
    const segs = segmentsByTaskId?.get(taskId);
    if (!segs || segs.length === 0) return null;
    return segs.map(seg => {
      const segStart = parseISO(seg.start_date);
      const segEnd = parseISO(seg.end_date);
      const left = differenceInDays(segStart, startDate) * dayWidth;
      const width = (differenceInDays(segEnd, segStart) + 1) * dayWidth;
      return { left, width };
    });
  }, [segmentsByTaskId, startDate, dayWidth]);


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
        <div className="flex flex-col" id="gantt-chart-container" ref={chartRef}>
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
              
              {/* Task rows - with grouping support */}
              <div className="divide-y">
                {config.groupBy === 'category_owner' ? (
                  // Render hierarchical category_owner rows
                  hierarchicalRows.map((row) => {
                    if (row.type === 'category-header') {
                      return (
                        <TaskGroupHeader
                          key={row.key}
                          groupKey={row.label}
                          groupBy="category_owner"
                          taskCount={row.taskCount}
                          isExpanded={!collapsedGroups.has(row.key)}
                          onToggle={() => toggleGroup(row.key)}
                          level={0}
                        />
                      );
                    }
                    if (row.type === 'zone-header') {
                      return (
                        <TaskGroupHeader
                          key={row.key}
                          groupKey={row.label}
                          groupBy="category_owner"
                          taskCount={row.taskCount}
                          isExpanded={!collapsedGroups.has(row.key)}
                          onToggle={() => toggleGroup(row.key)}
                          level={1}
                        />
                      );
                    }
                    const task = row.task;
                    return (
                      <div
                        key={task.id}
                        className={cn(
                          "flex items-center gap-2 hover:bg-muted/50 cursor-pointer group",
                          selectedTasks.has(task.id) && "bg-primary/10",
                          dragReorderTaskId === task.id && "opacity-50"
                        )}
                        style={{ height: ROW_HEIGHT, paddingLeft: 44, paddingRight: 8 }}
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
                    );
                  })
                ) : config.groupBy !== 'none' ? (
                  // Render grouped tasks
                  Object.entries(groupedTasks).map(([groupKey, groupTasks]) => (
                    <div key={groupKey || 'ungrouped'}>
                      <TaskGroupHeader
                        groupKey={groupKey || 'No Value'}
                        groupBy={config.groupBy as 'status' | 'owner' | 'color' | 'category'}
                        taskCount={groupTasks.length}
                        isExpanded={!collapsedGroups.has(groupKey)}
                        onToggle={() => toggleGroup(groupKey)}
                      />
                      {!collapsedGroups.has(groupKey) && groupTasks.map((task) => (
                        <div
                          key={task.id}
                          className={cn(
                            "flex items-center gap-2 px-2 hover:bg-muted/50 cursor-pointer group",
                            selectedTasks.has(task.id) && "bg-primary/10",
                            dragReorderTaskId === task.id && "opacity-50"
                          )}
                          style={{ height: ROW_HEIGHT }}
                          onClick={() => onEditTask(task)}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = 'move';
                            setDragReorderTaskId(task.id);
                          }}
                          onDragEnd={() => setDragReorderTaskId(null)}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (dragReorderTaskId && dragReorderTaskId !== task.id && onReorderTasks) {
                              const orderedIds = tasks.map(t => t.id);
                              const fromIndex = orderedIds.indexOf(dragReorderTaskId);
                              const toIndex = orderedIds.indexOf(task.id);
                              orderedIds.splice(fromIndex, 1);
                              orderedIds.splice(toIndex, 0, dragReorderTaskId);
                              onReorderTasks(orderedIds);
                            }
                            setDragReorderTaskId(null);
                          }}
                        >
                          <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab" />
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
                  ))
                ) : (
                  // Flat task list (no grouping)
                  tasks.map((task) => (
                    <div
                      key={task.id}
                      className={cn(
                        "flex items-center gap-2 px-2 hover:bg-muted/50 cursor-pointer group",
                        selectedTasks.has(task.id) && "bg-primary/10",
                        dragReorderTaskId === task.id && "opacity-50"
                      )}
                      style={{ height: ROW_HEIGHT }}
                      onClick={() => onEditTask(task)}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = 'move';
                        setDragReorderTaskId(task.id);
                      }}
                      onDragEnd={() => setDragReorderTaskId(null)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragReorderTaskId && dragReorderTaskId !== task.id && onReorderTasks) {
                          const orderedIds = tasks.map(t => t.id);
                          const fromIndex = orderedIds.indexOf(dragReorderTaskId);
                          const toIndex = orderedIds.indexOf(task.id);
                          orderedIds.splice(fromIndex, 1);
                          orderedIds.splice(toIndex, 0, dragReorderTaskId);
                          onReorderTasks(orderedIds);
                        }
                        setDragReorderTaskId(null);
                      }}
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab" />
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
                  ))
                )}
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
                        height: (config.groupBy === 'category_owner' ? hierarchicalRows.length : tasks.length) * ROW_HEIGHT + (milestones.length > 0 ? ROW_HEIGHT : 0),
                      }}
                    />
                  )}

                  {/* Task rows - unified for category_owner, flat otherwise */}
                  {config.groupBy === 'category_owner' ? (
                    hierarchicalRows.map((row, rowIndex) => {
                      if (row.type === 'category-header' || row.type === 'zone-header') {
                        // Spacer row for headers
                        return (
                          <div key={row.key} className="relative border-b bg-muted/20" style={{ height: ROW_HEIGHT }} />
                        );
                      }
                      const task = row.task;
                      const dragPreview = getDragPreview(task.id);
                      const { left, width } = getTaskPosition(task, dragPreview);
                      const isCritical = criticalPathIds.has(task.id);
                      const isBeingDragged = dragState?.taskId === task.id;
                      const segPositions = getSegmentPositions(task.id);

                      return (
                        <TooltipProvider key={task.id}>
                          <div
                            className={cn(
                              "relative border-b",
                              selectedTasks.has(task.id) && "bg-primary/5"
                            )}
                            style={{ height: ROW_HEIGHT }}
                          >
                            {config.showBaseline && (() => {
                              const baselinePos = getBaselinePosition(task.id);
                              if (!baselinePos) return null;
                              return (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div
                                      className="absolute rounded-sm border-2 border-dashed border-muted-foreground/50 bg-muted-foreground/10"
                                      style={{
                                        left: baselinePos.left,
                                        width: Math.max(baselinePos.width, 10),
                                        top: ROW_HEIGHT - BASELINE_BAR_HEIGHT - 4,
                                        height: BASELINE_BAR_HEIGHT,
                                      }}
                                    />
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom" className="text-xs">
                                    Baseline dates
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })()}

                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div
                                      className="absolute inset-0"
                                      style={{ height: ROW_HEIGHT }}
                                      onClick={() => !isDragging && onEditTask(task)}
                                    >
                                      {/* Render segments or single bar */}
                                      {segPositions ? (
                                        segPositions.map((seg, segIdx) => (
                                          <div
                                            key={segIdx}
                                            className={cn(
                                              "absolute rounded cursor-pointer transition-all group",
                                              !isBeingDragged && "hover:ring-2 hover:ring-primary/50",
                                              isCritical ? "ring-1 ring-destructive" : "",
                                              task.color ? "" : "bg-primary",
                                            )}
                                            style={{
                                              left: seg.left,
                                              width: Math.max(seg.width, 8),
                                              top: (ROW_HEIGHT - TASK_BAR_HEIGHT) / 2,
                                              height: TASK_BAR_HEIGHT,
                                              backgroundColor: task.color || undefined,
                                            }}
                                          >
                                            <div
                                              className="absolute inset-0 rounded opacity-40 bg-background pointer-events-none"
                                              style={{ width: `${100 - task.progress}%`, right: 0, left: 'auto' }}
                                            />
                                            {segIdx === 0 && seg.width > 60 && (
                                              <span className="absolute inset-0 flex items-center px-2 text-xs text-primary-foreground truncate font-medium pointer-events-none">
                                                {task.name}
                                              </span>
                                            )}
                                          </div>
                                        ))
                                      ) : (
                                        <div
                                          className={cn(
                                            "absolute rounded cursor-pointer transition-all group",
                                            !isBeingDragged && "hover:ring-2 hover:ring-primary/50",
                                            isCritical ? "ring-1 ring-destructive" : "",
                                            task.color ? "" : "bg-primary",
                                            isBeingDragged && "ring-2 ring-primary shadow-lg opacity-90"
                                          )}
                                          style={{
                                            left,
                                            width: Math.max(width, 20),
                                            top: (ROW_HEIGHT - TASK_BAR_HEIGHT) / 2,
                                            height: TASK_BAR_HEIGHT,
                                            backgroundColor: task.color || undefined,
                                          }}
                                          onMouseDown={(e) => {
                                            if (e.button === 0) {
                                              const rect = e.currentTarget.getBoundingClientRect();
                                              const offsetX = e.clientX - rect.left;
                                              if (offsetX < DRAG_HANDLE_WIDTH) {
                                                e.preventDefault();
                                                startDrag(task, 'resize-start', e.clientX);
                                              } else if (offsetX > rect.width - DRAG_HANDLE_WIDTH) {
                                                e.preventDefault();
                                                startDrag(task, 'resize-end', e.clientX);
                                              } else {
                                                e.preventDefault();
                                                startDrag(task, 'move', e.clientX);
                                              }
                                            }
                                          }}
                                        >
                                          <div className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-background/30 rounded-l" />
                                          <div className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-background/30 rounded-r" />
                                          <div
                                            className="absolute inset-0 rounded opacity-40 bg-background pointer-events-none"
                                            style={{ width: `${100 - task.progress}%`, right: 0, left: 'auto' }}
                                          />
                                          {width > 60 && (
                                            <span className="absolute inset-0 flex items-center px-3 text-xs text-primary-foreground truncate font-medium pointer-events-none">
                                              {task.name}
                                            </span>
                                          )}
                                          <div 
                                            className={cn(
                                              "absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-primary border-2 border-background cursor-crosshair transition-opacity z-20",
                                              isDraggingDependency ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                            )}
                                            onMouseDown={(e) => {
                                              e.stopPropagation();
                                              e.preventDefault();
                                              const startX = left;
                                              const startY = rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
                                              startDependencyDrag(task.id, 'start', startX, startY);
                                            }}
                                            onMouseUp={(e) => {
                                              if (isDraggingDependency && dependencyDragState) {
                                                e.stopPropagation();
                                                endDependencyDrag(task.id, 'start');
                                              }
                                            }}
                                          />
                                          <div 
                                            className={cn(
                                              "absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-primary border-2 border-background cursor-crosshair transition-opacity z-20",
                                              isDraggingDependency ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                            )}
                                            onMouseDown={(e) => {
                                              e.stopPropagation();
                                              e.preventDefault();
                                              const startX = left + width;
                                              const startY = rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
                                              startDependencyDrag(task.id, 'end', startX, startY);
                                            }}
                                            onMouseUp={(e) => {
                                              if (isDraggingDependency && dependencyDragState) {
                                                e.stopPropagation();
                                                endDependencyDrag(task.id, 'end');
                                              }
                                            }}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">
                                    <div className="text-sm">
                                      <p className="font-medium">{task.name}</p>
                                      {segPositions ? (
                                        <div className="text-muted-foreground">
                                          {segmentsByTaskId?.get(task.id)?.map((seg, i) => (
                                            <p key={i}>
                                              Segment {i + 1}: {format(parseISO(seg.start_date), 'MMM d')} - {format(parseISO(seg.end_date), 'MMM d')}
                                            </p>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="text-muted-foreground">
                                          {format(parseISO(task.start_date), 'MMM d')} - {format(parseISO(task.end_date), 'MMM d, yyyy')}
                                        </p>
                                      )}
                                      <p>Progress: {task.progress}%</p>
                                      {task.owner && <p>Zone: {task.owner}</p>}
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
                    })
                  ) : (
                    tasks.map((task, index) => {
                    const dragPreview = getDragPreview(task.id);
                    const { left, width } = getTaskPosition(task, dragPreview);
                    const isCritical = criticalPathIds.has(task.id);
                    const isBeingDragged = dragState?.taskId === task.id;

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

                          {/* Baseline overlay (ghost bar) */}
                          {config.showBaseline && (() => {
                            const baselinePos = getBaselinePosition(task.id);
                            if (!baselinePos) return null;
                            return (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className="absolute rounded-sm border-2 border-dashed border-muted-foreground/50 bg-muted-foreground/10"
                                    style={{
                                      left: baselinePos.left,
                                      width: Math.max(baselinePos.width, 10),
                                      top: ROW_HEIGHT - BASELINE_BAR_HEIGHT - 4,
                                      height: BASELINE_BAR_HEIGHT,
                                    }}
                                  />
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="text-xs">
                                  Baseline dates
                                </TooltipContent>
                              </Tooltip>
                            );
                          })()}

                          {/* Task bar */}
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className={cn(
                                      "absolute rounded cursor-pointer transition-all group",
                                      !isBeingDragged && "hover:ring-2 hover:ring-primary/50",
                                      isCritical ? "ring-1 ring-destructive" : "",
                                      task.color ? "" : "bg-primary",
                                      isBeingDragged && "ring-2 ring-primary shadow-lg opacity-90"
                                    )}
                                    style={{
                                      left,
                                      width: Math.max(width, 20),
                                      top: (ROW_HEIGHT - TASK_BAR_HEIGHT) / 2,
                                      height: TASK_BAR_HEIGHT,
                                      backgroundColor: task.color || undefined,
                                    }}
                                    onClick={() => !isDragging && onEditTask(task)}
                                    onMouseDown={(e) => {
                                      if (e.button === 0) {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const offsetX = e.clientX - rect.left;
                                        if (offsetX < DRAG_HANDLE_WIDTH) {
                                          e.preventDefault();
                                          startDrag(task, 'resize-start', e.clientX);
                                        } else if (offsetX > rect.width - DRAG_HANDLE_WIDTH) {
                                          e.preventDefault();
                                          startDrag(task, 'resize-end', e.clientX);
                                        } else {
                                          e.preventDefault();
                                          startDrag(task, 'move', e.clientX);
                                        }
                                      }
                                    }}
                                  >
                                    {/* Left resize handle */}
                                    <div 
                                      className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-background/30 rounded-l"
                                    />
                                    
                                    {/* Right resize handle */}
                                    <div 
                                      className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-background/30 rounded-r"
                                    />

                                    {/* Progress fill */}
                                    <div
                                      className="absolute inset-0 rounded opacity-40 bg-background pointer-events-none"
                                      style={{ width: `${100 - task.progress}%`, right: 0, left: 'auto' }}
                                    />
                                    
                                    {/* Task name if wide enough */}
                                    {width > 60 && (
                                      <span className="absolute inset-0 flex items-center px-3 text-xs text-primary-foreground truncate font-medium pointer-events-none">
                                        {task.name}
                                      </span>
                                    )}

                                    {/* Dependency connection points */}
                                    <div 
                                      className={cn(
                                        "absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-primary border-2 border-background cursor-crosshair transition-opacity z-20",
                                        isDraggingDependency ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                      )}
                                      onMouseDown={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        const startX = left;
                                        const startY = index * ROW_HEIGHT + ROW_HEIGHT / 2;
                                        startDependencyDrag(task.id, 'start', startX, startY);
                                      }}
                                      onMouseUp={(e) => {
                                        if (isDraggingDependency && dependencyDragState) {
                                          e.stopPropagation();
                                          endDependencyDrag(task.id, 'start');
                                        }
                                      }}
                                    />
                                    <div 
                                      className={cn(
                                        "absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-primary border-2 border-background cursor-crosshair transition-opacity z-20",
                                        isDraggingDependency ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                      )}
                                      onMouseDown={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        const startX = left + width;
                                        const startY = index * ROW_HEIGHT + ROW_HEIGHT / 2;
                                        startDependencyDrag(task.id, 'end', startX, startY);
                                      }}
                                      onMouseUp={(e) => {
                                        if (isDraggingDependency && dependencyDragState) {
                                          e.stopPropagation();
                                          endDependencyDrag(task.id, 'end');
                                        }
                                      }}
                                    />
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
                  })
                  )}

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
                      style={{ width: chartWidth, height: (config.groupBy === 'category_owner' ? hierarchicalRows.length : tasks.length) * ROW_HEIGHT }}
                    >
                      {dependencies.map((dep) => {
                        const predTask = tasks.find((t) => t.id === dep.predecessor_id);
                        const succTask = tasks.find((t) => t.id === dep.successor_id);
                        if (!predTask || !succTask) return null;

                        // For category_owner, find indices in hierarchicalRows
                        let predIndex: number, succIndex: number;
                        if (config.groupBy === 'category_owner') {
                          predIndex = hierarchicalRows.findIndex(r => r.type === 'task' && r.task.id === predTask.id);
                          succIndex = hierarchicalRows.findIndex(r => r.type === 'task' && r.task.id === succTask.id);
                        } else {
                          predIndex = tasks.indexOf(predTask);
                          succIndex = tasks.indexOf(succTask);
                        }
                        if (predIndex === -1 || succIndex === -1) return null;

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

                  {/* Dependency drag line */}
                  {isDraggingDependency && dependencyDragState && (
                    <DependencyDragLine
                      startX={dependencyDragState.startX}
                      startY={dependencyDragState.startY}
                      endX={dependencyDragState.currentX}
                      endY={dependencyDragState.currentY}
                      isValid={true}
                    />
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
