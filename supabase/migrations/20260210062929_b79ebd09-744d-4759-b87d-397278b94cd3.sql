
-- 1. Create checklist_templates table
CREATE TABLE public.checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Solar PV',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to checklist_templates" ON public.checklist_templates
  FOR ALL USING (true) WITH CHECK (true);

-- 2. Seed default Solar PV items
INSERT INTO public.checklist_templates (label, category, sort_order) VALUES
  ('COC Certificate', 'Solar PV', 0),
  ('As-Built Drawings', 'Solar PV', 1),
  ('Commissioning Report', 'Solar PV', 2),
  ('O&M Manual', 'Solar PV', 3),
  ('Warranty Documentation', 'Solar PV', 4),
  ('Grid Connection Agreement', 'Solar PV', 5),
  ('Grid Tie Certificate', 'Solar PV', 6),
  ('Meter Installation Certificate', 'Solar PV', 7),
  ('Performance Test Report', 'Solar PV', 8),
  ('Structural Engineering Certificate', 'Solar PV', 9),
  ('Electrical Single Line Diagram', 'Solar PV', 10),
  ('Site Handover Certificate', 'Solar PV', 11),
  ('Training Completion Certificate', 'Solar PV', 12),
  ('Insurance Documentation', 'Solar PV', 13),
  ('Environmental Compliance Certificate', 'Solar PV', 14),
  ('Safety File', 'Solar PV', 15);

-- 3. Add template_id to handover_checklist_items
ALTER TABLE public.handover_checklist_items 
  ADD COLUMN template_id UUID REFERENCES public.checklist_templates(id);

-- 4. Create junction table for multi-file assignment
CREATE TABLE public.checklist_document_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_item_id UUID NOT NULL REFERENCES public.handover_checklist_items(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.project_documents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(checklist_item_id, document_id)
);

ALTER TABLE public.checklist_document_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to checklist_document_links" ON public.checklist_document_links
  FOR ALL USING (true) WITH CHECK (true);

-- 5. Migrate existing assignments from document_id to junction table
INSERT INTO public.checklist_document_links (checklist_item_id, document_id)
SELECT id, document_id FROM public.handover_checklist_items WHERE document_id IS NOT NULL;

-- 6. Drop old column
ALTER TABLE public.handover_checklist_items DROP COLUMN document_id;
