-- Create report analytics table
CREATE TABLE public.report_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  event_type TEXT NOT NULL, -- 'view', 'export_pdf', 'export_excel', 'export_sheets', 'chart_view', 'infographic_generate'
  report_config_id UUID REFERENCES public.report_configs(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX idx_report_analytics_user ON public.report_analytics(user_id);
CREATE INDEX idx_report_analytics_event ON public.report_analytics(event_type);
CREATE INDEX idx_report_analytics_created ON public.report_analytics(created_at DESC);

-- Enable RLS
ALTER TABLE public.report_analytics ENABLE ROW LEVEL SECURITY;

-- Users can view their own analytics
CREATE POLICY "Users can view own analytics"
ON public.report_analytics
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own analytics
CREATE POLICY "Users can insert own analytics"
ON public.report_analytics
FOR INSERT
WITH CHECK (auth.uid() = user_id);