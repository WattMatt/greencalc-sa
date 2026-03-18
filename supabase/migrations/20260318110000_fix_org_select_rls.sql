-- Fix: Allow org creators to SELECT their org immediately after INSERT
-- (before they've been added as a member)
CREATE POLICY "Creators can view their own organization"
ON public.organizations FOR SELECT
TO authenticated
USING (created_by = auth.uid());
