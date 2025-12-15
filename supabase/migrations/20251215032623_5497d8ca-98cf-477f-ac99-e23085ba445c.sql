-- Drop existing overly permissive policies on projects
DROP POLICY IF EXISTS "Anyone can delete projects" ON public.projects;
DROP POLICY IF EXISTS "Anyone can insert projects" ON public.projects;
DROP POLICY IF EXISTS "Anyone can update projects" ON public.projects;
DROP POLICY IF EXISTS "Anyone can view projects" ON public.projects;

-- Create authenticated-only policies for projects
CREATE POLICY "Authenticated users can view projects"
ON public.projects FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert projects"
ON public.projects FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update projects"
ON public.projects FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete projects"
ON public.projects FOR DELETE
TO authenticated
USING (true);

-- Drop existing overly permissive policies on scada_imports
DROP POLICY IF EXISTS "Anyone can delete scada_imports" ON public.scada_imports;
DROP POLICY IF EXISTS "Anyone can insert scada_imports" ON public.scada_imports;
DROP POLICY IF EXISTS "Anyone can update scada_imports" ON public.scada_imports;
DROP POLICY IF EXISTS "Anyone can view scada_imports" ON public.scada_imports;

-- Create authenticated-only policies for scada_imports
CREATE POLICY "Authenticated users can view scada_imports"
ON public.scada_imports FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert scada_imports"
ON public.scada_imports FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update scada_imports"
ON public.scada_imports FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete scada_imports"
ON public.scada_imports FOR DELETE
TO authenticated
USING (true);