-- Create storage bucket for tour assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('tour-assets', 'tour-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to tour assets
CREATE POLICY "Tour assets are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'tour-assets');

-- Allow authenticated users to upload tour assets
CREATE POLICY "Authenticated users can upload tour assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'tour-assets' AND auth.role() = 'authenticated');

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update tour assets"
ON storage.objects FOR UPDATE
USING (bucket_id = 'tour-assets' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete tour assets
CREATE POLICY "Authenticated users can delete tour assets"
ON storage.objects FOR DELETE
USING (bucket_id = 'tour-assets' AND auth.role() = 'authenticated');