
-- Create gantt_task_segments table for split/non-contiguous task date ranges
CREATE TABLE public.gantt_task_segments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.gantt_tasks(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gantt_task_segments ENABLE ROW LEVEL SECURITY;

-- RLS policies (same open access as gantt_tasks)
CREATE POLICY "Users can view all task segments"
  ON public.gantt_task_segments FOR SELECT USING (true);

CREATE POLICY "Users can create task segments"
  ON public.gantt_task_segments FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update task segments"
  ON public.gantt_task_segments FOR UPDATE USING (true);

CREATE POLICY "Users can delete task segments"
  ON public.gantt_task_segments FOR DELETE USING (true);

-- Index for fast lookup by task
CREATE INDEX idx_gantt_task_segments_task_id ON public.gantt_task_segments(task_id);
