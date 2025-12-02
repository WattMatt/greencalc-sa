-- Add source_file_path column to municipalities table
ALTER TABLE public.municipalities 
ADD COLUMN source_file_path text;