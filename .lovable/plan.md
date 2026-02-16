

## Persist Content Blocks and Ensure All Sections are Enabled by Default

### What's Happening Now

The content block toggle states (which sections are on/off) are **not saved to the database**. The `proposals` table has no `content_blocks` column. When you reload a proposal, the toggles reset to defaults. The LaTeX delimiters (`%%-- BEGIN:id --%%` / `%%-- END:id --%%`) are already implemented in the template engine, so when all sections are enabled, every section is clearly labeled and identifiable by any AI.

The LaTeX you pasted only shows `cover` and `signature` because those were the only two sections toggled ON at the time.

### What Will Change

1. **Add a `content_blocks` JSONB column** to the `proposals` table so toggle states persist across sessions.

2. **Save content blocks on proposal save** -- include the current toggle states in both the insert and update mutations.

3. **Restore content blocks on proposal load** -- when loading an existing proposal, restore the saved toggle states instead of using defaults.

4. **All sections enabled by default** -- this is already the case in `DEFAULT_CONTENT_BLOCKS`. New proposals will start with every section ON, producing a full LaTeX document with all `%%-- BEGIN:id --%%` / `%%-- END:id --%%` markers visible.

### Technical Details

**Database migration:**
```sql
ALTER TABLE proposals 
ADD COLUMN content_blocks jsonb DEFAULT NULL;
```

**Files to change:**

| File | Change |
|------|--------|
| `src/pages/ProposalWorkspace.tsx` | Add `content_blocks` to save mutation (both insert and update). Add `setContentBlocks(...)` in the existing proposal load `useEffect`. |

**Save mutation changes (lines 349-361 and 366-378):**
- Add `content_blocks: JSON.parse(JSON.stringify(contentBlocks))` to both the update and insert payloads.

**Load proposal effect (line 207-238):**
- After restoring branding/notes, add:
```typescript
if (existingProposal.content_blocks) {
  setContentBlocks(existingProposal.content_blocks as unknown as ContentBlock[]);
}
```

This ensures that when you toggle sections on/off and save, those states persist. When the proposal is reloaded, the same sections will be enabled/disabled, and the LaTeX will contain the corresponding delimited blocks.

