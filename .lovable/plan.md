

## Add Year Period Dropdown to Project Tariff Selector

### Problem
When selecting a tariff within a project, the user sees a flat list of all tariffs for the selected municipality. Since tariffs are uploaded for different financial years (e.g., "1 Jun 2024 - 31 May 2025" and "1 Jun 2025 - 31 May 2026"), the list is cluttered and there is no way to filter by period. The user needs a "Year" dropdown between Municipality and Tariff to select which period's tariffs to use.

### Solution
Add a new dropdown labelled "Year" between the Municipality and Tariff selectors in `TariffSelector.tsx`. This dropdown will:
- Show distinct date periods from the tariffs available for that municipality (e.g., "Jun 2025 - May 2026")
- Default to the most recent period
- Filter the tariff dropdown to only show tariffs from the selected period
- Include a "All Periods" option to see everything
- Handle tariffs with no dates (grouped as "No Period Specified")

### Layout Change

Current: `Province | Municipality | Tariff`

New: `Province | Municipality | Year | Tariff` (4 columns on md+)

### Technical Details

**File: `src/components/projects/TariffSelector.tsx`**

1. **Add state**: `const [selectedPeriod, setSelectedPeriod] = useState<string>("")`

2. **Derive available periods** from the `tariffs` query result using `useMemo`:
   - Group tariffs by their `effective_from + effective_to` combination
   - Format each as a label like "Jun 2025 - May 2026"
   - Sort descending (most recent first)
   - Include "No Period" for tariffs where both dates are null

3. **Auto-select the most recent period** via `useEffect` when tariffs load or municipality changes

4. **Filter tariffs** shown in the Tariff dropdown to only those matching the selected period

5. **Reset period** when municipality changes (alongside existing reset logic)

6. **Grid update**: Change `md:grid-cols-3` to `md:grid-cols-4` to accommodate the new dropdown

7. The Year dropdown is only shown for non-Eskom tariffs (same condition as the Tariff dropdown)

### Files Modified
- `src/components/projects/TariffSelector.tsx` -- add Year period dropdown, filter tariffs by selected period
