-- Create storage bucket for cached infographics
INSERT INTO storage.buckets (id, name, public)
VALUES ('report-infographics', 'report-infographics', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view infographics (they're public)
CREATE POLICY "Anyone can view report infographics"
ON storage.objects FOR SELECT
USING (bucket_id = 'report-infographics');

-- Allow authenticated users to upload infographics
CREATE POLICY "Authenticated users can upload infographics"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'report-infographics' AND auth.role() = 'authenticated');

-- Allow authenticated users to update their infographics
CREATE POLICY "Authenticated users can update infographics"
ON storage.objects FOR UPDATE
USING (bucket_id = 'report-infographics' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete infographics
CREATE POLICY "Authenticated users can delete infographics"
ON storage.objects FOR DELETE
USING (bucket_id = 'report-infographics' AND auth.role() = 'authenticated');