ALTER TABLE project_tenants
  ADD COLUMN include_in_load_profile boolean NOT NULL DEFAULT true,
  ADD COLUMN is_virtual boolean NOT NULL DEFAULT false;