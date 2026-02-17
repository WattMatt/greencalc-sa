

## Toggle Line Wrapping with Gutter Alignment

### Overview
Add a toggle button in the toolbar to switch between wrapped and unwrapped text. When wrapping is disabled, lines scroll horizontally and the gutter aligns perfectly. When wrapping is enabled, a measurement system dynamically adjusts each gutter row's height to match the actual rendered height of wrapped lines in the textarea.

### How It Works

**Wrap Off (default):**
- Textarea gets `white-space: pre` and `overflow-x: auto` -- lines never wrap
- Every logical line = one visual row = fixed 20px gutter entry
- Perfect alignment guaranteed

**Wrap On:**
- Textarea uses `white-space: pre-wrap` and `word-break: break-all` -- long lines wrap
- A hidden "mirror" div replicates the textarea's content, font, size, and width
- After each render, the component measures the pixel height of each line in the mirror
- Each gutter entry's height is set to match its corresponding line's measured height
- The gutter stays perfectly aligned even with multi-row wrapped lines

### Technical Details

**File: `src/components/proposals/latex/LaTeXEditor.tsx`**

1. **New state**: `const [wordWrap, setWordWrap] = useState(false);`

2. **Toolbar toggle**: Add a small "Wrap" button next to the line count in the toolbar bar, using a `WrapText` icon from lucide-react. Active state is visually indicated.

3. **Textarea styles**: Conditionally apply:
   - Wrap off: `whiteSpace: "pre", overflowX: "auto"`
   - Wrap on: `whiteSpace: "pre-wrap", wordBreak: "break-all", overflowWrap: "break-word"`

4. **Hidden mirror div**: A `<div>` positioned offscreen (or `visibility: hidden`, `height: 0`, `overflow: hidden`) with identical font, font-size, line-height, padding, and width as the textarea. Each display line is rendered as a separate child `<div>`. This allows measuring each line's actual rendered height.

5. **Line height measurement**: Use a `useEffect` + `useLayoutEffect` that runs after render to read each mirror line child's `offsetHeight`, producing a `lineHeights: number[]` array. A `ResizeObserver` on the textarea tracks width changes to re-measure when the panel is resized.

6. **Gutter height binding**: Each gutter entry div gets `style={{ height: lineHeights[idx] || 20 }}` when wrapping is on, or the fixed `height: 20` when wrapping is off.

7. **Context menu addition**: Add a "Toggle Word Wrap" option to the right-click context menu for quick access.

