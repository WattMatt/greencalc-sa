

# GanttPro Integration Plan

## Overview

Integrate the complete GanttPro project management application as a new "Schedule" tab within each project in your solar energy platform. This will add professional Gantt chart capabilities for tracking installation timelines, milestones, and task dependencies.

---

## Features Being Integrated

Based on the GanttPro source code analysis:

### Core Features
- **Interactive Gantt Chart**: Drag-and-drop timeline visualization with day/week/month views
- **Task Management**: Create, edit, delete tasks with status tracking (not started, in progress, completed)
- **Task Dependencies**: Link tasks with 4 dependency types (finish-to-start, start-to-start, finish-to-finish, start-to-finish)
- **Milestones**: Mark key project dates with customizable markers
- **Progress Tracking**: Visual progress bars and completion percentages
- **Critical Path Analysis**: Automatically identify tasks that determine project duration

### Advanced Features
- **Baselines**: Save schedule snapshots for variance tracking
- **Resource Workload View**: Visualize task assignments by owner
- **Bulk Actions**: Select and update multiple tasks at once
- **Undo/Redo**: Track and reverse changes
- **Filter Presets**: Save and reuse filter combinations
- **Chart Export**: Export as PNG, JPEG, or PDF
- **Report Export**: Export to Excel, Word, and Calendar (ICS) formats
- **Keyboard Shortcuts**: Power-user navigation
- **Onboarding Checklist**: Guide users through first-time setup
- **Color Coding**: Tag tasks with preset colors for categorization
- **Search and Filters**: Filter by status, owner, color, date range

---

## Database Schema

Create 5 new tables linked to your existing `projects` table:

```text
+-------------------+       +-------------------+
|     projects      |       |   gantt_tasks     |
+-------------------+       +-------------------+
| id (uuid) PK      |<------| project_id (uuid) |
| name              |       | id (uuid) PK      |
| ...               |       | name              |
+-------------------+       | description       |
                            | start_date        |
                            | end_date          |
                            | status            |
                            | owner             |
                            | progress (0-100)  |
                            | sort_order        |
                            | color             |
                            +-------------------+
                                    |
                                    v
+-------------------+       +------------------------+
| gantt_milestones  |       | gantt_task_dependencies|
+-------------------+       +------------------------+
| id (uuid) PK      |       | id (uuid) PK           |
| project_id (uuid) |       | predecessor_id (uuid)  |
| name              |       | successor_id (uuid)    |
| date              |       | dependency_type        |
| description       |       +------------------------+
| color             |
+-------------------+

+-------------------+       +------------------------+
| gantt_baselines   |       | gantt_baseline_tasks   |
+-------------------+       +------------------------+
| id (uuid) PK      |       | id (uuid) PK           |
| project_id (uuid) |       | baseline_id (uuid)     |
| name              |       | task_id (uuid)         |
| description       |       | name                   |
| created_at        |       | start_date             |
+-------------------+       | end_date               |
                            +------------------------+
```

### Table Details

**gantt_tasks**
- `id`: UUID primary key
- `project_id`: Foreign key to projects table
- `name`: Task name (required)
- `description`: Optional task description
- `start_date`: Task start date
- `end_date`: Task end date
- `status`: Enum ('not_started', 'in_progress', 'completed')
- `owner`: Optional assignee name
- `progress`: Integer 0-100
- `sort_order`: Integer for ordering
- `color`: Optional color code
- `created_at`, `updated_at`: Timestamps

**gantt_task_dependencies**
- Links predecessor and successor tasks
- `dependency_type`: Enum (finish_to_start, start_to_start, finish_to_finish, start_to_finish)

**gantt_milestones**
- Key dates marked on the timeline
- Color-coded for visual distinction

**gantt_baselines** and **gantt_baseline_tasks**
- Snapshot system for tracking schedule changes over time

---

## Implementation Steps

### Phase 1: Database Setup
1. Create database migration with all 5 tables
2. Add RLS policies (authenticated users can CRUD on their project's data)
3. Add foreign key relationships to projects table

### Phase 2: Component Structure
Create new components under `src/components/gantt/`:

```text
src/components/gantt/
  index.ts                    # Barrel export
  ProjectGantt.tsx            # Main wrapper component (replaces Project.tsx page)
  GanttChart.tsx              # Timeline visualization
  GanttToolbar.tsx            # Controls: view mode, filters, exports
  TaskForm.tsx                # Task create/edit dialog
  MilestoneForm.tsx           # Milestone create/edit dialog
  ProgressPanel.tsx           # Progress statistics sidebar
  DependencyArrows.tsx        # SVG dependency lines
  DependencyDragLine.tsx      # Drag-to-create dependencies
  DependencyTypeSelector.tsx  # Dependency type picker
  BulkActionsBar.tsx          # Multi-select actions
  ColorLegend.tsx             # Color coding legend
  BaselineSelector.tsx        # Baseline management
  MilestoneMarker.tsx         # Milestone display
  ResourceWorkloadView.tsx    # Resource allocation view
  KeyboardShortcutsModal.tsx  # Shortcut reference
  OnboardingChecklist.tsx     # First-time user guide
  GettingStartedGuide.tsx     # Empty state helper
```

### Phase 3: Hooks
Create hooks under `src/hooks/`:

```text
src/hooks/
  useGanttTasks.ts           # Task CRUD operations
  useGanttMilestones.ts      # Milestone CRUD operations
  useGanttBaselines.ts       # Baseline management
  useGanttDrag.ts            # Drag-to-resize/move tasks
  useDependencyDrag.ts       # Drag-to-create dependencies
  useTaskReorder.ts          # Drag-and-drop reordering
  useUndoRedo.ts             # Undo/redo stack
  useFilterPresets.ts        # Saved filter configurations
  useChartExport.ts          # PNG/JPEG/PDF export
  useKeyboardShortcuts.ts    # Keyboard navigation
  useOnboardingProgress.ts   # Track onboarding completion
```

### Phase 4: Utility Libraries
Create under `src/lib/`:

```text
src/lib/
  criticalPath.ts            # Critical path calculation algorithm
  taskColors.ts              # Color preset definitions
  calendarExport.ts          # ICS file generation
  reportExport.ts            # Excel/Word export (extend existing)
```

### Phase 5: Type Definitions
Add to `src/types/gantt.ts`:
- Task, TaskDependency, Milestone, Baseline, BaselineTask interfaces
- ViewMode, GroupByMode, ChartViewType enums
- GanttChartConfig interface

### Phase 6: Integration into ProjectDetail
1. Add new "Schedule" tab to ProjectDetail.tsx
2. Import ProjectGantt component
3. Pass projectId to enable per-project scheduling
4. Add tab status tracking (pending/partial/complete based on task count)

---

## Technical Details

### New Dependencies Required
- `html-to-image` (for chart export) - needs to be added
- `jspdf` (for PDF export) - needs to be added

Existing dependencies that will be reused:
- `date-fns` (already installed)
- `recharts` (already installed)
- `xlsx` (already installed for Excel)

### Key Adaptations
1. **Project ID Linking**: Replace GanttPro's standalone project system with references to your existing `projects` table
2. **Authentication**: Use your existing `useAuth` hook instead of GanttPro's version
3. **Styling**: Components already use Tailwind and shadcn/ui, matching your current stack
4. **Database Client**: Use your existing Supabase client from `@/integrations/supabase/client`

### UI Integration Point

In `ProjectDetail.tsx`, add after the "Reports" tab:

```typescript
<TabWithStatus 
  value="schedule" 
  status={tabStatuses.schedule.status} 
  tooltip={tabStatuses.schedule.tooltip}
>
  <Calendar className="h-4 w-4 mr-2" />
  Schedule
</TabWithStatus>

// And in TabsContent:
<TabsContent value="schedule" className="mt-6">
  <ProjectGantt projectId={id!} projectName={project.name} />
</TabsContent>
```

---

## Summary

This integration brings a full-featured project scheduling system to your solar energy platform:

| Component | Files to Create | Complexity |
|-----------|-----------------|------------|
| Database Tables | 1 migration | Medium |
| Gantt Components | ~15 files | High |
| Custom Hooks | ~11 files | Medium |
| Utility Libraries | ~4 files | Medium |
| Type Definitions | 1 file | Low |
| ProjectDetail Integration | 1 file edit | Low |

**Estimated Components**: ~32 new files
**Estimated Lines of Code**: ~6,000+ lines

The implementation will preserve all original GanttPro functionality while adapting it to work within your existing project context, allowing you to track solar installation schedules, equipment delivery milestones, and contractor dependencies directly within each project.

