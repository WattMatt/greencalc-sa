-- Fix infinite recursion in organization_members RLS policies
-- The SELECT policy references organization_members itself, causing recursion.
-- Solution: Use the existing SECURITY DEFINER function get_user_org_id() instead.

-- Drop the recursive policies
DROP POLICY IF EXISTS "Members can view other members in their org" ON public.organization_members;
DROP POLICY IF EXISTS "Org admins can insert members" ON public.organization_members;
DROP POLICY IF EXISTS "Org admins can update members" ON public.organization_members;
DROP POLICY IF EXISTS "Org admins can delete members" ON public.organization_members;
DROP POLICY IF EXISTS "Org creators can add themselves as first member" ON public.organization_members;

-- Recreate using SECURITY DEFINER functions (no recursion)
CREATE POLICY "Members can view other members in their org"
ON public.organization_members FOR SELECT
TO authenticated
USING (
  org_id = public.get_user_org_id(auth.uid())
);

CREATE POLICY "Org admins can insert members"
ON public.organization_members FOR INSERT
TO authenticated
WITH CHECK (
  public.is_org_admin(auth.uid())
  AND org_id = public.get_user_org_id(auth.uid())
);

CREATE POLICY "Org admins can update members"
ON public.organization_members FOR UPDATE
TO authenticated
USING (
  public.is_org_admin(auth.uid())
  AND org_id = public.get_user_org_id(auth.uid())
);

CREATE POLICY "Org admins can delete members"
ON public.organization_members FOR DELETE
TO authenticated
USING (
  public.is_org_admin(auth.uid())
  AND org_id = public.get_user_org_id(auth.uid())
  AND user_id != auth.uid()
);

-- Bootstrap policy: allow org creators to add themselves as first member
-- Uses organizations table (no recursion) to verify ownership
CREATE POLICY "Org creators can bootstrap membership"
ON public.organization_members FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND org_id IN (SELECT id FROM public.organizations WHERE created_by = auth.uid())
  AND public.get_user_org_id(auth.uid()) IS NULL
);

-- Also fix the organizations SELECT policy to not depend on organization_members
DROP POLICY IF EXISTS "Members can view their organization" ON public.organizations;

CREATE POLICY "Members can view their organization"
ON public.organizations FOR SELECT
TO authenticated
USING (
  id = public.get_user_org_id(auth.uid())
  OR created_by = auth.uid()
);
