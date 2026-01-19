-- Create organization branding settings table
CREATE TABLE public.organization_branding (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_name TEXT,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#3b82f6',
  secondary_color TEXT DEFAULT '#1e40af',
  contact_email TEXT,
  contact_phone TEXT,
  website TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.organization_branding ENABLE ROW LEVEL SECURITY;

-- Users can view their own branding
CREATE POLICY "Users can view their own branding"
ON public.organization_branding
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own branding
CREATE POLICY "Users can create their own branding"
ON public.organization_branding
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own branding
CREATE POLICY "Users can update their own branding"
ON public.organization_branding
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own branding
CREATE POLICY "Users can delete their own branding"
ON public.organization_branding
FOR DELETE
USING (auth.uid() = user_id);

-- Create storage bucket for branding assets
INSERT INTO storage.buckets (id, name, public) VALUES ('branding', 'branding', true);

-- Storage policies for branding bucket
CREATE POLICY "Branding images are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'branding');

CREATE POLICY "Users can upload their own branding images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'branding' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own branding images"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'branding' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own branding images"
ON storage.objects
FOR DELETE
USING (bucket_id = 'branding' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Trigger for updated_at
CREATE TRIGGER update_organization_branding_updated_at
BEFORE UPDATE ON public.organization_branding
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();