DELETE FROM handover_checklist_items a
WHERE a.template_id IS NULL
AND EXISTS (
  SELECT 1 FROM handover_checklist_items b
  WHERE b.project_id = a.project_id
  AND b.label = a.label
  AND b.template_id IS NOT NULL
);