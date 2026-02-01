import { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useGanttTasks } from '@/hooks/useGanttTasks';
import { useGanttDependencies } from '@/hooks/useGanttDependencies';
import { useGanttMilestones } from '@/hooks/useGanttMilestones';
import { useGanttBaselines } from '@/hooks/useGanttBaselines';
import { GanttToolbar } from './GanttToolbar';
import { GanttChart } from './GanttChart';
import { TaskForm } from './TaskForm';
import { MilestoneForm } from './MilestoneForm';
import { ProgressPanel } from './ProgressPanel';
import { BulkActionsBar } from './BulkActionsBar';
import { GettingStartedGuide } from './GettingStartedGuide';
import { 
  GanttChartConfig, 
  GanttFilters, 
  GanttTask,
  DEFAULT_CHART_CONFIG, 
  DEFAULT_FILTERS,
  TaskFormData,
  MilestoneFormData,
} from '@/types/gantt';
import { Plus, Flag, CalendarDays } from 'lucide-react';
import { parseISO, isWithinInterval } from 'date-fns';

interface ProjectGanttProps {
  projectId: string;
  projectName: string;
}

export function ProjectGantt({ projectId, projectName }: ProjectGanttProps) {
  // Data hooks
  const { tasks, isLoading: isLoadingTasks, createTask, updateTask, deleteTask, bulkUpdateTasks, bulkDeleteTasks } = useGanttTasks(projectId);
  const { dependencies, isLoading: isLoadingDeps, createDependency, deleteDependency } = useGanttDependencies(projectId);
  const { milestones, isLoading: isLoadingMilestones, createMilestone, updateMilestone, deleteMilestone } = useGanttMilestones(projectId);
  const { baselines, createBaseline, deleteBaseline } = useGanttBaselines(projectId);

  // UI State
  const [config, setConfig] = useState<GanttChartConfig>(DEFAULT_CHART_CONFIG);
  const [filters, setFilters] = useState<GanttFilters>(DEFAULT_FILTERS);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [editingTask, setEditingTask] = useState<GanttTask | null>(null);
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [isMilestoneFormOpen, setIsMilestoneFormOpen] = useState(false);

  const isLoading = isLoadingTasks || isLoadingDeps || isLoadingMilestones;

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Search filter
      if (filters.search && !task.name.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }
      
      // Status filter
      if (filters.status.length > 0 && !filters.status.includes(task.status)) {
        return false;
      }
      
      // Owner filter
      if (filters.owners.length > 0 && (!task.owner || !filters.owners.includes(task.owner))) {
        return false;
      }
      
      // Color filter
      if (filters.colors.length > 0 && (!task.color || !filters.colors.includes(task.color))) {
        return false;
      }
      
      // Date range filter
      if (filters.dateRange.start && filters.dateRange.end) {
        const taskStart = parseISO(task.start_date);
        const taskEnd = parseISO(task.end_date);
        const filterStart = filters.dateRange.start;
        const filterEnd = filters.dateRange.end;
        
        // Check if task overlaps with filter range
        if (taskEnd < filterStart || taskStart > filterEnd) {
          return false;
        }
      }
      
      return true;
    });
  }, [tasks, filters]);

  // Unique owners for filter dropdown
  const uniqueOwners = useMemo(() => {
    return Array.from(new Set(tasks.map((t) => t.owner).filter(Boolean) as string[]));
  }, [tasks]);

  // Handle task creation
  const handleCreateTask = useCallback(async (formData: TaskFormData) => {
    await createTask.mutateAsync(formData);
    setIsTaskFormOpen(false);
  }, [createTask]);

  // Handle task update
  const handleUpdateTask = useCallback(async (formData: TaskFormData) => {
    if (!editingTask) return;
    
    await updateTask.mutateAsync({
      id: editingTask.id,
      name: formData.name,
      description: formData.description || null,
      start_date: formData.start_date.toISOString().split('T')[0],
      end_date: formData.end_date.toISOString().split('T')[0],
      status: formData.status,
      owner: formData.owner || null,
      progress: formData.progress,
      color: formData.color,
    });
    
    setEditingTask(null);
    setIsTaskFormOpen(false);
  }, [editingTask, updateTask]);

  // Handle milestone creation
  const handleCreateMilestone = useCallback(async (formData: MilestoneFormData) => {
    await createMilestone.mutateAsync(formData);
    setIsMilestoneFormOpen(false);
  }, [createMilestone]);

  // Handle selection
  const handleSelectTask = useCallback((taskId: string, selected: boolean) => {
    setSelectedTasks((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(taskId);
      } else {
        next.delete(taskId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedTasks.size === filteredTasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(filteredTasks.map((t) => t.id)));
    }
  }, [selectedTasks.size, filteredTasks]);

  // Handle bulk actions
  const handleBulkUpdate = useCallback(async (changes: Parameters<typeof bulkUpdateTasks.mutateAsync>[0]['changes']) => {
    await bulkUpdateTasks.mutateAsync({ ids: Array.from(selectedTasks), changes });
    setSelectedTasks(new Set());
  }, [bulkUpdateTasks, selectedTasks]);

  const handleBulkDelete = useCallback(async () => {
    await bulkDeleteTasks.mutateAsync(Array.from(selectedTasks));
    setSelectedTasks(new Set());
  }, [bulkDeleteTasks, selectedTasks]);

  // Save baseline
  const handleSaveBaseline = useCallback(async (name: string, description: string) => {
    await createBaseline.mutateAsync({ name, description, tasks });
  }, [createBaseline, tasks]);

  // Open task edit form
  const handleEditTask = useCallback((task: GanttTask) => {
    setEditingTask(task);
    setIsTaskFormOpen(true);
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  // Show getting started guide if no tasks
  if (tasks.length === 0) {
    return (
      <GettingStartedGuide
        onCreateTask={() => setIsTaskFormOpen(true)}
        onCreateMilestone={() => setIsMilestoneFormOpen(true)}
        isTaskFormOpen={isTaskFormOpen}
        isMilestoneFormOpen={isMilestoneFormOpen}
      >
        <TaskForm
          open={isTaskFormOpen}
          onOpenChange={setIsTaskFormOpen}
          onSubmit={handleCreateTask}
          isSubmitting={createTask.isPending}
        />
        <MilestoneForm
          open={isMilestoneFormOpen}
          onOpenChange={setIsMilestoneFormOpen}
          onSubmit={handleCreateMilestone}
          isSubmitting={createMilestone.isPending}
        />
      </GettingStartedGuide>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with quick actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Project Schedule</h2>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsMilestoneFormOpen(true)}>
            <Flag className="h-4 w-4 mr-2" />
            Add Milestone
          </Button>
          <Button size="sm" onClick={() => { setEditingTask(null); setIsTaskFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <GanttToolbar
        config={config}
        onConfigChange={setConfig}
        filters={filters}
        onFiltersChange={setFilters}
        owners={uniqueOwners}
        baselines={baselines}
        onSaveBaseline={handleSaveBaseline}
        onDeleteBaseline={(id) => deleteBaseline.mutate(id)}
        tasks={tasks}
        milestones={milestones}
        projectName={projectName}
      />

      {/* Bulk actions bar */}
      {selectedTasks.size > 0 && (
        <BulkActionsBar
          selectedCount={selectedTasks.size}
          totalCount={filteredTasks.length}
          onSelectAll={handleSelectAll}
          onClearSelection={() => setSelectedTasks(new Set())}
          onBulkUpdate={handleBulkUpdate}
          onBulkDelete={handleBulkDelete}
        />
      )}

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Progress Panel */}
        <div className="lg:col-span-1">
          <ProgressPanel tasks={tasks} dependencies={dependencies} />
        </div>

        {/* Gantt Chart */}
        <div className="lg:col-span-3">
          <GanttChart
            tasks={filteredTasks}
            dependencies={dependencies}
            milestones={config.showMilestones ? milestones : []}
            config={config}
            selectedTasks={selectedTasks}
            onSelectTask={handleSelectTask}
            onEditTask={handleEditTask}
            onUpdateTask={(id, updates) => updateTask.mutate({ id, ...updates })}
            onDeleteTask={(id) => deleteTask.mutate(id)}
            onCreateDependency={(pred, succ, type) => createDependency.mutate({ predecessorId: pred, successorId: succ, dependencyType: type })}
            onDeleteDependency={(id) => deleteDependency.mutate(id)}
          />
        </div>
      </div>

      {/* Task Form Dialog */}
      <TaskForm
        open={isTaskFormOpen}
        onOpenChange={(open) => {
          setIsTaskFormOpen(open);
          if (!open) setEditingTask(null);
        }}
        task={editingTask}
        onSubmit={editingTask ? handleUpdateTask : handleCreateTask}
        isSubmitting={editingTask ? updateTask.isPending : createTask.isPending}
      />

      {/* Milestone Form Dialog */}
      <MilestoneForm
        open={isMilestoneFormOpen}
        onOpenChange={setIsMilestoneFormOpen}
        onSubmit={handleCreateMilestone}
        isSubmitting={createMilestone.isPending}
      />
    </div>
  );
}
