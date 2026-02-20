ALTER TABLE public.project_schematics
  ALTER COLUMN file_path DROP NOT NULL,
  ALTER COLUMN file_type DROP NOT NULL;