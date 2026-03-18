-- Fix: Allow users to bootstrap their own organization
-- The original RLS on organization_members requires is_org_admin(),
-- which creates a chicken-and-egg problem for the first member.

-- Allow the org creator to add themselves as the first member
CREATE POLICY "Org creators can add themselves as first member"
ON public.organization_members FOR INSERT
TO authenticated
WITH CHECK (
  -- The user is adding themselves
  user_id = auth.uid()
  -- And they created the organization
  AND org_id IN (
    SELECT id FROM public.organizations WHERE created_by = auth.uid()
  )
  -- And they are not already a member of any org
  AND NOT EXISTS (
    SELECT 1 FROM public.organization_members WHERE user_id = auth.uid()
  )
);
