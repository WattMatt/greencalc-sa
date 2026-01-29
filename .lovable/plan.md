
## Goal
Make placed inverters behave like other selectable items (PV arrays, roof masks):
- Click an inverter on the canvas to select it (highlight + enables keyboard delete).
- Delete an inverter from the Project Summary dropdown reliably.

## What’s happening now (root cause)
The canvas selection logic (`Canvas.tsx`) only hit-tests PV arrays and roof masks. It never checks “equipment” items (inverters, combiner, etc.), so clicking an inverter can’t select it.

Deletion from the Project Summary should theoretically work (it calls `onDeleteItem(inv.id)`), but in practice it can fail if:
- the inverter list filter doesn’t match the stored `type` values in all cases (string vs enum), or
- the click event gets swallowed/treated like a selection click (needs `preventDefault` + `stopPropagation` consistently).

## Proposed changes

### 1) Add equipment hit-testing + selection on the canvas
**File:** `src/components/floor-plan/components/Canvas.tsx`

**Implementation approach:**
- In the `handleMouseDown` block for `Tool.SELECT`:
  1. Keep existing priority: PV Arrays (topmost) first.
  2. Then Roof Masks.
  3. Then add a new step: detect if the click hits an equipment icon (inverter etc.) and select it.
  4. Otherwise clear selection.

**How to hit-test equipment (simple + consistent with drawing):**
- Reuse the same size logic used in `drawEquipmentIcon`:
  - If `scaleInfo.ratio` exists: `sizePx = EQUIPMENT_REAL_WORLD_SIZES[type] / scaleInfo.ratio`
  - Else fallback to `fixedSize = 12 / zoom` style sizing (or a small constant adjusted by zoom).
- Use a conservative axis-aligned bounding box around the item’s center:
  - `abs(worldPos.x - item.position.x) <= sizePx/2 + padding`
  - `abs(worldPos.y - item.position.y) <= sizePx/2 + padding`
- Iterate equipment in reverse order so the most recently placed (visually “top”) wins, similar to PV arrays.

**Notes / edge cases:**
- Ignore rotation in the hit test initially (simple bounding box). This is good enough for selection and matches user expectations.
- Later enhancement (optional) could do rotated-rect hit testing, but not needed to solve the issue.

**Expected outcome:**
- Clicking an inverter selects it.
- `selectedItemId` becomes the inverter’s id.
- Highlighting already works because `renderAllMarkups()` passes `selectedItemId` into `drawEquipmentIcon`.

---

### 2) Make inverter deletion from the Summary Panel robust
**File:** `src/components/floor-plan/components/SummaryPanel.tsx`

**Implementation approach:**
- Ensure filtering uses the enum value (or otherwise matches actual stored values):
  - Replace `e.type === 'Inverter'` with `e.type === EquipmentType.INVERTER` by importing `EquipmentType` from `../types`.
- Harden delete click handling:
  - In the trash button `onClick`, call `e.preventDefault()` + `e.stopPropagation()` before invoking `onDeleteItem(inv.id)`.
  - This prevents the click from being interpreted as a selection click or triggering any parent handlers.

**Expected outcome:**
- Clicking the trash icon reliably deletes that inverter instance (calls `handleDeleteItem`, which filters `equipment` by id).
- Works regardless of whether `type` is represented as a string literal or enum in persisted data.

---

### 3) Verification checklist (manual tests)
1. Place an inverter using the Equipment tool.
2. Switch to Select tool.
3. Click the inverter on the canvas:
   - It should highlight (selected state).
4. Press Delete/Backspace:
   - The inverter should be removed.
5. Open Project Summary → Inverters:
   - Confirm the inverter appears in the list.
6. Click the trash icon for that inverter:
   - It should be removed immediately.

## Optional follow-up (nice-to-have, not required for the fix)
- Add equipment dragging in Select mode (similar to PV arrays) once selection works:
  - drag start when clicking selected equipment,
  - update equipment position on mouse move,
  - release on mouse up.
This would improve usability but is not necessary to resolve the current “cannot select” blocker.
