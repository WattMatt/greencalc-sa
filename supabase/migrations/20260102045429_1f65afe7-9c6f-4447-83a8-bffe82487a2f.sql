-- Create eskom_batch_status table to track which batches have been extracted
CREATE TABLE IF NOT EXISTS public.eskom_batch_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE CASCADE,
  batch_index integer NOT NULL,
  batch_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  tariffs_extracted integer DEFAULT 0,
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(municipality_id, batch_index)
);

-- Enable RLS
ALTER TABLE public.eskom_batch_status ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can view batch status" ON public.eskom_batch_status FOR SELECT USING (true);
CREATE POLICY "Anyone can insert batch status" ON public.eskom_batch_status FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update batch status" ON public.eskom_batch_status FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete batch status" ON public.eskom_batch_status FOR DELETE USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_eskom_batch_status_updated_at
  BEFORE UPDATE ON public.eskom_batch_status
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();