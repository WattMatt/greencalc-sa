
## Add Editable Comment Input with Past Comments Dropdown

### What Changes

The "Comment" column in the Down Time tab currently shows a static dash ("—"). This will be replaced with an interactive input that:
- Lets you type a free-text comment for each day
- Shows a dropdown of previously used comments so you can quickly reuse them
- Persists comments to the database so they survive page reloads

### New Database Table

A new `downtime_comments` table will store one comment per project + month + year + day:

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | Auto-generated |
| project_id | text | Links to the project |
| year | integer | e.g. 2026 |
| month | integer | 1-12 |
| day | integer | 1-31 |
| comment | text | The user's comment |
| created_at | timestamptz | Auto-set |

A unique constraint on (project_id, year, month, day) ensures one comment per day. An upsert will be used so typing a comment auto-saves it.

A second query will fetch distinct past comments for this project to populate the dropdown suggestions.

### UI Approach

Each row's Comment cell will become a combo-box style input:
- A small text input (matching table styling) where you can type freely
- A dropdown button that shows a list of previously used comments for quick selection
- Uses the existing Popover + Command (cmdk) components already installed in the project
- Comments auto-save on blur (losing focus) with a debounce, so no save button is needed

### Files to Change

1. **Database migration** -- Create `downtime_comments` table with RLS policies (public read/write for now since the app doesn't use auth on this feature)
2. **`src/components/projects/generation/PerformanceSummaryTable.tsx`** -- Replace the static "—" Comment cell with the new interactive input component; fetch and save comments via Supabase
3. **`src/components/projects/generation/DowntimeCommentCell.tsx`** (new) -- Extracted component for the comment cell with input + dropdown logic

### Technical Details

- The `DowntimeCommentCell` component will:
  - Accept `projectId`, `year`, `month`, `day`, `initialValue`, and `pastComments` props
  - Use local state for the input value
  - On blur, upsert the comment to the database
  - Render a Popover with a filterable list of past comments using the existing `cmdk` (Command) component
- Past comments will be fetched once per table render via a `useQuery` hook in the parent
- The dropdown will show distinct non-empty comments from this project, sorted alphabetically
- Selecting a past comment fills the input and triggers an auto-save
