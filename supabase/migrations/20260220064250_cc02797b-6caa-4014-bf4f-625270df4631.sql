
-- Create scada-csvs storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('scada-csvs', 'scada-csvs', false);

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload scada csvs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'scada-csvs' AND auth.role() = 'authenticated');

-- Allow authenticated users to read files
CREATE POLICY "Authenticated users can read scada csvs"
ON storage.objects FOR SELECT
USING (bucket_id = 'scada-csvs' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete files
CREATE POLICY "Authenticated users can delete scada csvs"
ON storage.objects FOR DELETE
USING (bucket_id = 'scada-csvs' AND auth.role() = 'authenticated');
