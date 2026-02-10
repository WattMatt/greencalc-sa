
-- 1. Create checklist_template_groups table
CREATE TABLE public.checklist_template_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.checklist_template_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view template groups"
  ON public.checklist_template_groups FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage template groups"
  ON public.checklist_template_groups FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Insert default group
INSERT INTO public.checklist_template_groups (id, name, description)
VALUES ('a0000000-0000-0000-0000-000000000001', 'Solar PV Handover', 'Standard handover documentation requirements for solar PV installations');

-- 3. Add group_id column to checklist_templates
ALTER TABLE public.checklist_templates ADD COLUMN group_id UUID REFERENCES public.checklist_template_groups(id) ON DELETE CASCADE;

-- 4. Backfill existing items
UPDATE public.checklist_templates SET group_id = 'a0000000-0000-0000-0000-000000000001' WHERE group_id IS NULL;

-- 5. Make NOT NULL
ALTER TABLE public.checklist_templates ALTER COLUMN group_id SET NOT NULL;
