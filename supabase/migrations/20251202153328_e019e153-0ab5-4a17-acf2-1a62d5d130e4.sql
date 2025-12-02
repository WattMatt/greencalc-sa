-- Create storage bucket for tariff file uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('tariff-uploads', 'tariff-uploads', false);

-- Allow authenticated and anonymous users to upload files
CREATE POLICY "Anyone can upload tariff files"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'tariff-uploads');

-- Allow reading uploaded files
CREATE POLICY "Anyone can read tariff files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'tariff-uploads');

-- Allow deleting files
CREATE POLICY "Anyone can delete tariff files"
ON storage.objects
FOR DELETE
USING (bucket_id = 'tariff-uploads');