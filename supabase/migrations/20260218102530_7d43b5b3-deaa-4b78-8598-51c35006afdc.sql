ALTER TABLE projects
  ADD CONSTRAINT projects_tariff_id_fkey
  FOREIGN KEY (tariff_id) REFERENCES tariff_plans(id)
  ON DELETE SET NULL;