-- ============================================================
-- Organizations & User Invite System
-- ============================================================

-- 1. Organizations table
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- 2. Organization members table
CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  invited_by uuid REFERENCES auth.users(id),
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  UNIQUE (org_id, user_id)
);

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- 3. Add org_id to organization_branding
ALTER TABLE public.organization_branding
  ADD COLUMN org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 4. Add org_id to projects
ALTER TABLE public.projects
  ADD COLUMN org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

-- ============================================================
-- Helper function: get user's org_id
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_org_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.organization_members
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Helper function: check if user is admin in their org
CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND role = 'admin'
  )
$$;

-- ============================================================
-- RLS Policies: organizations
-- ============================================================

CREATE POLICY "Members can view their organization"
ON public.organizations FOR SELECT
TO authenticated
USING (
  id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid())
);

CREATE POLICY "Authenticated users can create organizations"
ON public.organizations FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Org admins can update their organization"
ON public.organizations FOR UPDATE
TO authenticated
USING (
  id IN (
    SELECT org_id FROM public.organization_members
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- ============================================================
-- RLS Policies: organization_members
-- ============================================================

CREATE POLICY "Members can view other members in their org"
ON public.organization_members FOR SELECT
TO authenticated
USING (
  org_id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid())
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
  AND user_id != auth.uid() -- cannot remove yourself
);

-- ============================================================
-- Updated RLS: organization_branding (add org-scoped access)
-- ============================================================

CREATE POLICY "Org members can view shared branding"
ON public.organization_branding FOR SELECT
TO authenticated
USING (
  org_id IS NOT NULL
  AND org_id = public.get_user_org_id(auth.uid())
);

CREATE POLICY "Org admins can update shared branding"
ON public.organization_branding FOR UPDATE
TO authenticated
USING (
  org_id IS NOT NULL
  AND org_id IN (
    SELECT org_id FROM public.organization_members
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- ============================================================
-- Updated RLS: projects (add org-scoped access)
-- ============================================================

CREATE POLICY "Org members can view org projects"
ON public.projects FOR SELECT
TO authenticated
USING (
  org_id IS NOT NULL
  AND org_id = public.get_user_org_id(auth.uid())
);

CREATE POLICY "Org members can insert org projects"
ON public.projects FOR INSERT
TO authenticated
WITH CHECK (
  org_id IS NULL
  OR org_id = public.get_user_org_id(auth.uid())
);

CREATE POLICY "Org members can update org projects"
ON public.projects FOR UPDATE
TO authenticated
USING (
  org_id IS NULL
  OR org_id = public.get_user_org_id(auth.uid())
);

CREATE POLICY "Org members can delete org projects"
ON public.projects FOR DELETE
TO authenticated
USING (
  org_id IS NULL
  OR org_id = public.get_user_org_id(auth.uid())
);

-- ============================================================
-- Seed: Create default org for existing admin
-- ============================================================

DO $$
DECLARE
  _org_id uuid;
  _admin_id uuid := '912ffa08-c673-4dd3-a91f-788cae2a8d05';
BEGIN
  -- Create org
  INSERT INTO public.organizations (name, created_by)
  VALUES ('WM Solar', _admin_id)
  RETURNING id INTO _org_id;

  -- Add admin as member
  INSERT INTO public.organization_members (org_id, user_id, role, accepted_at)
  VALUES (_org_id, _admin_id, 'admin', now());

  -- Link existing branding
  UPDATE public.organization_branding
  SET org_id = _org_id
  WHERE user_id = _admin_id;

  -- Link existing projects
  UPDATE public.projects
  SET org_id = _org_id;
END $$;
