import { useState, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useGanttTasks } from '@/hooks/useGanttTasks';
import { useGanttTaskSegments } from '@/hooks/useGanttTaskSegments';
import { useGanttDependencies } from '@/hooks/useGanttDependencies';
import { useGanttMilestones } from '@/hooks/useGanttMilestones';
import { useGanttBaselines, useBaselineTasks } from '@/hooks/useGanttBaselines';
import { useFilterPresets } from '@/hooks/useFilterPresets';
import { useKeyboardShortcuts, getDefaultGanttShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useOnboardingProgress } from '@/hooks/useOnboardingProgress';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { useCelebration } from '@/hooks/useCelebration';
import { GanttToolbar } from './GanttToolbar';
import { GanttChart } from './GanttChart';
import { TaskForm } from './TaskForm';
import { MilestoneForm } from './MilestoneForm';
import { ProgressPanel } from './ProgressPanel';
import { BulkActionsBar } from './BulkActionsBar';
import { GettingStartedGuide } from './GettingStartedGuide';
import { ResourceWorkloadView } from './ResourceWorkloadView';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { OnboardingChecklist } from './OnboardingChecklist';
import { ColorLegend } from './ColorLegend';
import { DependencyTypeSelector } from './DependencyTypeSelector';
import { ImportScheduleDialog } from './ImportScheduleDialog';
import { ParsedScheduleTask } from '@/lib/ganttImport';
import { toast } from 'sonner';
import { 
  GanttChartConfig, 
  GanttFilters, 
  GanttTask,
  DEFAULT_CHART_CONFIG, 
  DEFAULT_FILTERS,
  TaskFormData,
  MilestoneFormData,
} from '@/types/gantt';
import { Plus, Flag, CalendarDays, Users } from 'lucide-react';
import { parseISO, isWithinInterval } from 'date-fns';

interface ProjectGanttProps {
  projectId: string;
  projectName: string;
}

export function ProjectGantt({ projectId, projectName }: ProjectGanttProps) {
  // Data hooks
  const { tasks, isLoading: isLoadingTasks, createTask, updateTask, deleteTask, bulkUpdateTasks, bulkDeleteTasks, reorderTasks } = useGanttTasks(projectId);
  const taskIds = useMemo(() => tasks.map(t => t.id), [tasks]);
  const { segmentsByTaskId, saveSegments, deleteSegmentsForTasks } = useGanttTaskSegments(projectId, taskIds);
  const { dependencies, isLoading: isLoadingDeps, createDependency, deleteDependency } = useGanttDependencies(projectId);
  const { milestones, isLoading: isLoadingMilestones, createMilestone, updateMilestone, deleteMilestone } = useGanttMilestones(projectId);
  const { baselines, createBaseline, deleteBaseline } = useGanttBaselines(projectId);
  
  // Feature hooks
  const { presets: filterPresets, createPreset, deletePreset, applyPreset } = useFilterPresets(projectId);
  const { steps: onboardingSteps, progress: onboardingProgress, completedCount, totalSteps, isComplete: onboardingComplete, isDismissed: onboardingDismissed, completeStep, dismissOnboarding, resetOnboarding } = useOnboardingProgress(projectId);
  const { canUndo, canRedo, undo, redo, pushAction } = useUndoRedo();
  const { celebrate, celebrateSubtle, celebrateAllComplete } = useCelebration();

  // UI State
  const [config, setConfig] = useState<GanttChartConfig>(DEFAULT_CHART_CONFIG);
  const [filters, setFilters] = useState<GanttFilters>(DEFAULT_FILTERS);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [editingTask, setEditingTask] = useState<GanttTask | null>(null);
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [isMilestoneFormOpen, setIsMilestoneFormOpen] = useState(false);
  const [isKeyboardShortcutsOpen, setIsKeyboardShortcutsOpen] = useState(false);
  const [showWorkloadView, setShowWorkloadView] = useState(false);
  const [pendingDependency, setPendingDependency] = useState<{ predecessorId: string; successorId: string } | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch baseline tasks when a baseline is selected
  const { data: baselineTasks = [] } = useBaselineTasks(config.showBaseline);

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
    completeStep('create_task');
    if (formData.owner) {
      completeStep('assign_owner');
    }
  }, [createTask, completeStep]);

  // Handle task update with celebration
  const handleUpdateTask = useCallback(async (formData: TaskFormData) => {
    if (!editingTask) return;
    
    const wasNotCompleted = editingTask.status !== 'completed';
    const isNowCompleted = formData.status === 'completed';
    
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
    
    // Celebrate task completion!
    if (wasNotCompleted && isNowCompleted) {
      // Check if ALL tasks are now completed
      const otherTasks = tasks.filter(t => t.id !== editingTask.id);
      const allOthersCompleted = otherTasks.every(t => t.status === 'completed');
      
      if (allOthersCompleted && otherTasks.length > 0) {
        // All tasks complete - big celebration!
        celebrateAllComplete();
        toast.success('🎉 All tasks completed! Amazing work!', {
          duration: 5000,
        });
      } else {
        // Single task complete - subtle celebration
        celebrateSubtle();
        toast.success(`✅ "${formData.name}" completed!`);
      }
    }
    
    if (formData.owner) {
      completeStep('assign_owner');
    }
    
    setEditingTask(null);
    setIsTaskFormOpen(false);
  }, [editingTask, updateTask, completeStep, tasks, celebrateSubtle, celebrateAllComplete]);

  // Handle milestone creation
  const handleCreateMilestone = useCallback(async (formData: MilestoneFormData) => {
    await createMilestone.mutateAsync(formData);
    setIsMilestoneFormOpen(false);
    completeStep('add_milestone');
  }, [createMilestone, completeStep]);

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
    completeStep('save_baseline');
  }, [createBaseline, tasks, completeStep]);

  // Open task edit form
  const handleEditTask = useCallback((task: GanttTask) => {
    setEditingTask(task);
    setIsTaskFormOpen(true);
  }, []);

  // Handle filter presets
  const handleApplyFilterPreset = useCallback((presetId: string) => {
    const newFilters = applyPreset(presetId);
    if (newFilters) {
      setFilters(newFilters);
      completeStep('use_filters');
    }
  }, [applyPreset, completeStep]);

  const handleSaveFilterPreset = useCallback((name: string) => {
    createPreset(name, filters);
    completeStep('use_filters');
  }, [createPreset, filters, completeStep]);

  // Handle import from Excel
  const handleImportTasks = useCallback(async (parsedTasks: ParsedScheduleTask[], mode: 'append' | 'replace') => {
    if (mode === 'replace' && tasks.length > 0) {
      // Delete segments first (cascade should handle, but be explicit)
      await deleteSegmentsForTasks.mutateAsync(tasks.map(t => t.id));
      await bulkDeleteTasks.mutateAsync(tasks.map(t => t.id));
    }
    
    const maxOrder = mode === 'replace' ? 0 : tasks.reduce((max, t) => Math.max(max, t.sort_order), 0);
    const allSegments: { task_id: string; start_date: string; end_date: string }[] = [];
    
    for (let i = 0; i < parsedTasks.length; i++) {
      const pt = parsedTasks[i];
      const status = pt.progress >= 100 ? 'completed' as const : pt.progress > 0 ? 'in_progress' as const : 'not_started' as const;
      
      const newTask = await createTask.mutateAsync({
        name: pt.taskName,
        description: pt.category,
        start_date: new Date(pt.startDate),
        end_date: new Date(pt.endDate),
        status,
        owner: pt.zone,
        progress: pt.progress,
        color: pt.color,
      });
      
      // Save segments if more than one (single segment = use task dates)
      if (pt.segments && pt.segments.length > 1) {
        for (const seg of pt.segments) {
          allSegments.push({
            task_id: newTask.id,
            start_date: seg.startDate,
            end_date: seg.endDate,
          });
        }
      }
    }
    
    // Batch save all segments
    if (allSegments.length > 0) {
      await saveSegments.mutateAsync(allSegments);
    }
    
    completeStep('create_task');
    completeStep('assign_owner');
  }, [tasks, bulkDeleteTasks, createTask, completeStep, saveSegments, deleteSegmentsForTasks]);

  // Used colors for color legend
  const usedColors = useMemo(() => {
    return Array.from(new Set(tasks.map(t => t.color).filter(Boolean) as string[]));
  }, [tasks]);

  // Keyboard shortcuts
  const keyboardShortcuts = useMemo(() => getDefaultGanttShortcuts({
    onNewTask: () => { setEditingTask(null); setIsTaskFormOpen(true); },
    onNewMilestone: () => setIsMilestoneFormOpen(true),
    onDelete: () => {
      if (selectedTasks.size > 0) {
        handleBulkDelete();
      }
    },
    onUndo: () => undo(),
    onRedo: () => redo(),
    onSelectAll: handleSelectAll,
    onEscape: () => setSelectedTasks(new Set()),
    onZoomIn: () => {
      if (config.viewMode === 'month') setConfig(c => ({ ...c, viewMode: 'week' }));
      else if (config.viewMode === 'week') setConfig(c => ({ ...c, viewMode: 'day' }));
    },
    onZoomOut: () => {
      if (config.viewMode === 'day') setConfig(c => ({ ...c, viewMode: 'week' }));
      else if (config.viewMode === 'week') setConfig(c => ({ ...c, viewMode: 'month' }));
    },
    onFocusSearch: () => searchInputRef.current?.focus(),
  }), [selectedTasks.size, handleBulkDelete, handleSelectAll, undo, redo, config.viewMode]);

  useKeyboardShortcuts({ shortcuts: keyboardShortcuts, enabled: true });

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
        onImportSchedule={() => setIsImportDialogOpen(true)}
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
        <ImportScheduleDialog
          open={isImportDialogOpen}
          onOpenChange={setIsImportDialogOpen}
          onImport={handleImportTasks}
          existingTaskCount={tasks.length}
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
        onFiltersChange={(newFilters) => {
          setFilters(newFilters);
          if (newFilters.search || newFilters.status.length > 0 || newFilters.owners.length > 0 || newFilters.colors.length > 0) {
            completeStep('use_filters');
          }
        }}
        owners={uniqueOwners}
        baselines={baselines}
        onSaveBaseline={handleSaveBaseline}
        onDeleteBaseline={(id) => deleteBaseline.mutate(id)}
        tasks={tasks}
        milestones={milestones}
        dependencies={dependencies}
        projectName={projectName}
        filterPresets={filterPresets}
        onSaveFilterPreset={handleSaveFilterPreset}
        onApplyFilterPreset={handleApplyFilterPreset}
        onDeleteFilterPreset={deletePreset}
        onOpenKeyboardShortcuts={() => setIsKeyboardShortcutsOpen(true)}
        onOpenImport={() => setIsImportDialogOpen(true)}
        searchInputRef={searchInputRef}
      />

      {/* Onboarding Checklist */}
      {!onboardingDismissed && !onboardingComplete && tasks.length > 0 && (
        <OnboardingChecklist
          steps={onboardingSteps}
          progress={onboardingProgress}
          completedCount={completedCount}
          totalSteps={totalSteps}
          isComplete={onboardingComplete}
          onDismiss={dismissOnboarding}
          onReset={resetOnboarding}
        />
      )}

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
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <ProgressPanel tasks={tasks} dependencies={dependencies} />
          
          {/* Color Legend */}
          {usedColors.length > 0 && (
            <ColorLegend
              usedColors={usedColors}
              onFilterColor={(color) => {
                const newColors = filters.colors.includes(color)
                  ? filters.colors.filter(c => c !== color)
                  : [...filters.colors, color];
                setFilters({ ...filters, colors: newColors });
                completeStep('use_filters');
              }}
              activeColors={filters.colors}
              onClearFilters={() => setFilters({ ...filters, colors: [] })}
            />
          )}
          
          {/* Toggle Workload View */}
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setShowWorkloadView(!showWorkloadView)}
          >
            <Users className="h-4 w-4 mr-2" />
            {showWorkloadView ? 'Hide' : 'Show'} Workload
          </Button>
          
          {showWorkloadView && (
            <ResourceWorkloadView tasks={tasks} />
          )}
        </div>

        {/* Gantt Chart */}
        <div className="lg:col-span-3">
          <GanttChart
            tasks={filteredTasks}
            dependencies={dependencies}
            milestones={config.showMilestones ? milestones : []}
            config={config}
            selectedTasks={selectedTasks}
            baselineTasks={baselineTasks}
            segmentsByTaskId={segmentsByTaskId}
            onSelectTask={handleSelectTask}
            onEditTask={handleEditTask}
            onUpdateTask={(id, updates) => {
              const existingTask = tasks.find(t => t.id === id);
              const wasNotCompleted = existingTask?.status !== 'completed';
              const isNowCompleted = updates.status === 'completed';
              
              updateTask.mutate({ id, ...updates });
              
              // Celebrate if task just became completed
              if (wasNotCompleted && isNowCompleted && existingTask) {
                const otherTasks = tasks.filter(t => t.id !== id);
                const allOthersCompleted = otherTasks.every(t => t.status === 'completed');
                
                if (allOthersCompleted && otherTasks.length > 0) {
                  celebrateAllComplete();
                  toast.success('🎉 All tasks completed! Amazing work!', { duration: 5000 });
                } else {
                  celebrateSubtle();
                  toast.success(`✅ "${existingTask.name}" completed!`);
                }
              }
            }}
            onDeleteTask={(id) => deleteTask.mutate(id)}
            onCreateDependency={(pred, succ, type) => {
              createDependency.mutate({ predecessorId: pred, successorId: succ, dependencyType: type });
              completeStep('create_dependency');
            }}
            onDeleteDependency={(id) => deleteDependency.mutate(id)}
            onReorderTasks={(orderedIds) => reorderTasks.mutate(orderedIds)}
            onRequestDependencyType={(predecessorId, successorId) => {
              setPendingDependency({ predecessorId, successorId });
            }}
      />

      {/* Import Schedule Dialog */}
      <ImportScheduleDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        onImport={handleImportTasks}
        existingTaskCount={tasks.length}
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

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        open={isKeyboardShortcutsOpen}
        onOpenChange={setIsKeyboardShortcutsOpen}
        shortcuts={keyboardShortcuts}
      />

      {/* Dependency Type Selector Dialog */}
      <DependencyTypeSelector
        open={!!pendingDependency}
        onOpenChange={(open) => !open && setPendingDependency(null)}
        predecessorName={tasks.find(t => t.id === pendingDependency?.predecessorId)?.name || ''}
        successorName={tasks.find(t => t.id === pendingDependency?.successorId)?.name || ''}
        onConfirm={(type) => {
          if (pendingDependency) {
            createDependency.mutate({
              predecessorId: pendingDependency.predecessorId,
              successorId: pendingDependency.successorId,
              dependencyType: type,
            });
            completeStep('create_dependency');
            setPendingDependency(null);
          }
        }}
      />
    </div>
  );
}
