
-- Create project_document_folders table
CREATE TABLE public.project_document_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3b82f6',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.project_document_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view project_document_folders" ON public.project_document_folders FOR SELECT USING (true);
CREATE POLICY "Anyone can insert project_document_folders" ON public.project_document_folders FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update project_document_folders" ON public.project_document_folders FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete project_document_folders" ON public.project_document_folders FOR DELETE USING (true);

-- Create project_documents table
CREATE TABLE public.project_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES public.project_document_folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  file_path TEXT,
  file_size BIGINT,
  mime_type TEXT,
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view project_documents" ON public.project_documents FOR SELECT USING (true);
CREATE POLICY "Anyone can insert project_documents" ON public.project_documents FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update project_documents" ON public.project_documents FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete project_documents" ON public.project_documents FOR DELETE USING (true);

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('project-documents', 'project-documents', false);

-- Storage RLS policies
CREATE POLICY "Authenticated users can upload project documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'project-documents');
CREATE POLICY "Authenticated users can view project documents" ON storage.objects FOR SELECT USING (bucket_id = 'project-documents');
CREATE POLICY "Authenticated users can update project documents" ON storage.objects FOR UPDATE USING (bucket_id = 'project-documents');
CREATE POLICY "Authenticated users can delete project documents" ON storage.objects FOR DELETE USING (bucket_id = 'project-documents');
