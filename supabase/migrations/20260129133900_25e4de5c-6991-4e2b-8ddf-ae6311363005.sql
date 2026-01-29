-- Add simulation_id to pv_layouts for linking layouts to specific simulations
ALTER TABLE public.pv_layouts
ADD COLUMN simulation_id uuid REFERENCES public.project_simulations(id) ON DELETE SET NULL;

-- Add index for efficient lookups
CREATE INDEX idx_pv_layouts_simulation_id ON public.pv_layouts(simulation_id);