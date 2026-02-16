

## Add Inline Autocomplete to Comment Input

### What Changes

The comment input box will gain an inline autocomplete feature. As you type, matching past comments will appear as suggestions directly in the input. You can cycle through matches with the up/down arrow keys, and pressing Enter accepts the highlighted suggestion.

### How It Works

1. As you type, the component filters `pastComments` case-insensitively to find entries that start with (or contain) the typed text
2. The first matching suggestion is shown as greyed-out "ghost text" extending beyond what you've typed -- e.g. if you type "Low" and "Low irradiance" is a past comment, you'll see "Low" in normal text followed by " irradiance" in a muted/highlighted style
3. Pressing Up/Down arrow keys cycles through all matching suggestions
4. Pressing Enter accepts the currently shown suggestion and populates the full text, then saves
5. Pressing Escape or continuing to type dismisses/updates the suggestion
6. The existing dropdown button remains as an alternative way to browse all past comments

### Changes to DowntimeCommentCell.tsx

- Add state for `filteredSuggestions` (array of matching comments) and `suggestionIndex` (which one is active)
- On every keystroke, filter `pastComments` case-insensitively against the current input value
- Render a "ghost text" overlay or inline span showing the remainder of the active suggestion in a muted color
- Handle `ArrowUp`, `ArrowDown` to cycle `suggestionIndex`, and `Enter` to accept
- Clear suggestions when input is empty or no matches found

### Technical Details

- The input will be wrapped in a relative container with an absolutely positioned ghost-text span behind/overlapping the input
- Ghost text will use `text-muted-foreground/50` styling to appear as a subtle suggestion
- Matching is done with `startsWith` (case-insensitive) so suggestions feel natural
- The suggestion list is re-filtered on every `onChange`; arrow keys cycle through the filtered list
- Enter key: if a suggestion is visible, accept it (populate input + save); if no suggestion, just blur/save as before
- Tab key can also accept the suggestion for convenience
- No new dependencies needed -- pure React state logic

