
-- Create handover_checklist_items table
CREATE TABLE public.handover_checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  document_id UUID REFERENCES public.project_documents(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.handover_checklist_items ENABLE ROW LEVEL SECURITY;

-- Open access policies (same pattern as other project tables)
CREATE POLICY "Allow all select on handover_checklist_items" ON public.handover_checklist_items FOR SELECT USING (true);
CREATE POLICY "Allow all insert on handover_checklist_items" ON public.handover_checklist_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on handover_checklist_items" ON public.handover_checklist_items FOR UPDATE USING (true);
CREATE POLICY "Allow all delete on handover_checklist_items" ON public.handover_checklist_items FOR DELETE USING (true);

-- Index for fast lookups
CREATE INDEX idx_handover_checklist_project ON public.handover_checklist_items(project_id);
