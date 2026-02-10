// Gantt Chart Types

export type GanttTaskStatus = 'not_started' | 'in_progress' | 'completed';
export type GanttDependencyType = 'finish_to_start' | 'start_to_start' | 'finish_to_finish' | 'start_to_finish';
export type ViewMode = 'day' | 'week' | 'month';
export type GroupByMode = 'none' | 'status' | 'owner' | 'color' | 'category' | 'category_owner';
export type ChartViewType = 'gantt' | 'workload' | 'calendar';

export interface ParsedSegment {
  startDate: string; // yyyy-MM-dd
  endDate: string;   // yyyy-MM-dd
}

export interface ParsedScheduleTask {
  zone: string;
  category: string;
  taskName: string;
  daysScheduled: number;
  progress: number;
  startDate: string; // yyyy-MM-dd
  endDate: string;   // yyyy-MM-dd
  color: string;
  segments: ParsedSegment[];
}

export interface GanttTask {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  status: GanttTaskStatus;
  owner: string | null;
  progress: number;
  sort_order: number;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export interface GanttTaskDependency {
  id: string;
  predecessor_id: string;
  successor_id: string;
  dependency_type: GanttDependencyType;
  created_at: string;
}

export interface GanttMilestone {
  id: string;
  project_id: string;
  name: string;
  date: string;
  description: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export interface GanttTaskSegment {
  id: string;
  task_id: string;
  start_date: string;
  end_date: string;
  created_at: string;
}

export interface GanttBaseline {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface GanttBaselineTask {
  id: string;
  baseline_id: string;
  task_id: string;
  name: string;
  start_date: string;
  end_date: string;
  created_at: string;
}

export interface GanttChartConfig {
  viewMode: ViewMode;
  groupBy: GroupByMode;
  chartView: ChartViewType;
  showDependencies: boolean;
  showMilestones: boolean;
  showBaseline: string | null; // baseline id or null
  showWeekends: boolean;
  showToday: boolean;
  splitView: boolean;
}

export interface GanttFilters {
  search: string;
  status: GanttTaskStatus[];
  owners: string[];
  colors: string[];
  dateRange: { start: Date | null; end: Date | null };
}

export interface GanttFilterPreset {
  id: string;
  name: string;
  filters: GanttFilters;
}

// Task form data for create/update
export interface TaskFormData {
  name: string;
  description: string;
  start_date: Date;
  end_date: Date;
  status: GanttTaskStatus;
  owner: string;
  progress: number;
  color: string | null;
}

// Milestone form data for create/update
export interface MilestoneFormData {
  name: string;
  date: Date;
  description: string;
  color: string | null;
}

// Undo/Redo action types
export type UndoAction = 
  | { type: 'task_create'; task: GanttTask }
  | { type: 'task_update'; before: GanttTask; after: GanttTask }
  | { type: 'task_delete'; task: GanttTask }
  | { type: 'milestone_create'; milestone: GanttMilestone }
  | { type: 'milestone_update'; before: GanttMilestone; after: GanttMilestone }
  | { type: 'milestone_delete'; milestone: GanttMilestone }
  | { type: 'dependency_create'; dependency: GanttTaskDependency }
  | { type: 'dependency_delete'; dependency: GanttTaskDependency };

// Color presets
export const TASK_COLORS = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Teal', value: '#14b8a6' },
] as const;

// Default chart configuration
export const DEFAULT_CHART_CONFIG: GanttChartConfig = {
  viewMode: 'week',
  groupBy: 'category_owner',
  chartView: 'gantt',
  showDependencies: true,
  showMilestones: true,
  showBaseline: null,
  showWeekends: true,
  showToday: true,
  splitView: true,
};

// Default filters
export const DEFAULT_FILTERS: GanttFilters = {
  search: '',
  status: [],
  owners: [],
  colors: [],
  dateRange: { start: null, end: null },
};
