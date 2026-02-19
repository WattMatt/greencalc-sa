

## Group Tariffs by Date Range Period

### Problem
When you expand a municipality (e.g. Polokwane), all tariffs from both uploaded documents are shown in a single flat list. There is no way to tell which tariff came from which document/period.

### Solution
Add a **date range sub-group** between the municipality level and the individual tariff cards. When you expand Polokwane, you will see collapsible sections like:

```text
POLOKWANE (21 tariffs)
  |
  +-- 1 Jun 2024 - 31 May 2025 (8 tariffs)
  |     Bulk Supply >100A 3Phase - High Voltage
  |     Commercial Prepaid Single Phase
  |     ...
  |
  +-- 1 Jun 2025 - 31 May 2026 (11 tariffs)
  |     Bulk Supply >100A 3Phase - High Voltage
  |     Single Phase Domestic Prepaid
  |     ...
  |
  +-- No Period Specified (2 tariffs)
        Municipal Tariff
        ...
```

Each period sub-group will show a date badge (e.g. "1 Jun 2024 - 31 May 2025") with a tariff count, and will be independently expandable/collapsible.

### Technical Details

**File: `src/components/tariffs/TariffList.tsx`**

Changes are localised to the municipality accordion content area (around lines 660-830):

1. **Group tariffs by period** -- After tariffs are loaded for a municipality, group them by a composite key of `effective_from|effective_to`. Tariffs with null dates go into an "Unspecified" group.

2. **Render period sub-groups** -- Replace the current flat `municipality.tariffs.map(...)` with:
   - An outer loop over each period group
   - A `Collapsible` header showing the formatted date range and count badge
   - The existing tariff cards rendered inside each group

3. **Format the period label** -- Use `date-fns` (already installed) to format dates as "1 Jun 2024 - 31 May 2025". Null dates display as "No Period Specified".

4. **Period badge styling** -- Each period header gets a `Calendar` icon (from lucide-react) and a subtle background to visually separate it from the municipality and tariff levels.

No database changes or edge function changes are required. This is purely a UI grouping change in the existing component.
