-- Create enum types for task status and dependency types
CREATE TYPE public.gantt_task_status AS ENUM ('not_started', 'in_progress', 'completed');
CREATE TYPE public.gantt_dependency_type AS ENUM ('finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish');

-- Create gantt_tasks table
CREATE TABLE public.gantt_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status gantt_task_status NOT NULL DEFAULT 'not_started',
  owner TEXT,
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  sort_order INTEGER NOT NULL DEFAULT 0,
  color TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create gantt_task_dependencies table
CREATE TABLE public.gantt_task_dependencies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  predecessor_id UUID NOT NULL REFERENCES public.gantt_tasks(id) ON DELETE CASCADE,
  successor_id UUID NOT NULL REFERENCES public.gantt_tasks(id) ON DELETE CASCADE,
  dependency_type gantt_dependency_type NOT NULL DEFAULT 'finish_to_start',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(predecessor_id, successor_id)
);

-- Create gantt_milestones table
CREATE TABLE public.gantt_milestones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  color TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create gantt_baselines table
CREATE TABLE public.gantt_baselines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create gantt_baseline_tasks table
CREATE TABLE public.gantt_baseline_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  baseline_id UUID NOT NULL REFERENCES public.gantt_baselines(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.gantt_tasks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.gantt_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gantt_task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gantt_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gantt_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gantt_baseline_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for gantt_tasks (authenticated users can access all project tasks)
CREATE POLICY "Users can view all gantt tasks"
  ON public.gantt_tasks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create gantt tasks"
  ON public.gantt_tasks FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update gantt tasks"
  ON public.gantt_tasks FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete gantt tasks"
  ON public.gantt_tasks FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for gantt_task_dependencies
CREATE POLICY "Users can view all task dependencies"
  ON public.gantt_task_dependencies FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create task dependencies"
  ON public.gantt_task_dependencies FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update task dependencies"
  ON public.gantt_task_dependencies FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete task dependencies"
  ON public.gantt_task_dependencies FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for gantt_milestones
CREATE POLICY "Users can view all milestones"
  ON public.gantt_milestones FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create milestones"
  ON public.gantt_milestones FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update milestones"
  ON public.gantt_milestones FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete milestones"
  ON public.gantt_milestones FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for gantt_baselines
CREATE POLICY "Users can view all baselines"
  ON public.gantt_baselines FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create baselines"
  ON public.gantt_baselines FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update baselines"
  ON public.gantt_baselines FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete baselines"
  ON public.gantt_baselines FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for gantt_baseline_tasks
CREATE POLICY "Users can view all baseline tasks"
  ON public.gantt_baseline_tasks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create baseline tasks"
  ON public.gantt_baseline_tasks FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update baseline tasks"
  ON public.gantt_baseline_tasks FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete baseline tasks"
  ON public.gantt_baseline_tasks FOR DELETE
  TO authenticated
  USING (true);

-- Add updated_at triggers
CREATE TRIGGER update_gantt_tasks_updated_at
  BEFORE UPDATE ON public.gantt_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_gantt_milestones_updated_at
  BEFORE UPDATE ON public.gantt_milestones
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_gantt_tasks_project_id ON public.gantt_tasks(project_id);
CREATE INDEX idx_gantt_tasks_status ON public.gantt_tasks(status);
CREATE INDEX idx_gantt_task_dependencies_predecessor ON public.gantt_task_dependencies(predecessor_id);
CREATE INDEX idx_gantt_task_dependencies_successor ON public.gantt_task_dependencies(successor_id);
CREATE INDEX idx_gantt_milestones_project_id ON public.gantt_milestones(project_id);
CREATE INDEX idx_gantt_baselines_project_id ON public.gantt_baselines(project_id);
CREATE INDEX idx_gantt_baseline_tasks_baseline_id ON public.gantt_baseline_tasks(baseline_id);