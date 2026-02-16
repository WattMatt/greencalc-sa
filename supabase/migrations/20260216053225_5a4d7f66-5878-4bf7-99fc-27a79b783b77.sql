
-- Create downtime_comments table
CREATE TABLE public.downtime_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  day INTEGER NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_project_day UNIQUE (project_id, year, month, day)
);

-- Enable RLS
ALTER TABLE public.downtime_comments ENABLE ROW LEVEL SECURITY;

-- Public read/write policies (app doesn't use auth for this feature)
CREATE POLICY "Anyone can view downtime_comments"
  ON public.downtime_comments FOR SELECT USING (true);

CREATE POLICY "Anyone can insert downtime_comments"
  ON public.downtime_comments FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update downtime_comments"
  ON public.downtime_comments FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete downtime_comments"
  ON public.downtime_comments FOR DELETE USING (true);
