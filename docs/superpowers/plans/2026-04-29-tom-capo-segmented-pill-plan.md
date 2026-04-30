# Tom/Capo Segmented Pill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current Tom/Capo trigger with an always-visible segmented pill beside the title, matching the approved design.

**Architecture:** Update the read-mode header layout in `music-panel-viewer.tsx`, implement a segmented pill trigger with per-segment emphasis state, and apply subtle segment emphasis inside the popover content. A tiny helper is added for segment detection with a unit test.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS, Vitest.

---

## File Structure

**Modify:**
- `frontend/src/components/music/music-panel-viewer.tsx` — header layout + segmented pill trigger + active-segment emphasis.

**Create:**
- `frontend/src/components/music/segment-utils.ts` — helper to resolve which segment was clicked.
- `frontend/src/components/music/segment-utils.test.ts` — unit tests for the helper (Vitest).

---

### Task 1: Update header layout to keep pill beside title

**Files:**
- Modify: `frontend/src/components/music/music-panel-viewer.tsx` (read-mode header block)

- [ ] **Step 1: Write the failing test (layout helper not needed yet)**

```ts
// No test for layout-only change. Proceed to implementation.
```

- [ ] **Step 2: Update header row to include the pill beside title**

Replace the header wrapper so the pill sits in the same flex row:

```tsx
<div className="shrink-0 border-b border-border bg-card px-3 md:px-6 pt-3 pb-2 space-y-3">
  <div className="flex flex-wrap items-center gap-3">
    <div className="min-w-0 flex-1">
      {/* title + artist */}
    </div>

    {isChord && (
      <ResponsivePopover
        align="start"
        className="w-80 p-4 space-y-4 max-w-[calc(100vw-2rem)]"
        side="bottom"
        trigger={/* segmented pill trigger (Task 2) */}
      >
        {/* popover content */}
      </ResponsivePopover>
    )}
  </div>

  <div className="flex flex-wrap items-center gap-1 rounded-full border border-border bg-muted/70 px-1.5 py-1 shadow-sm">
    {/* action buttons */}
  </div>
</div>
```

- [ ] **Step 3: Manual check**

Open `/music?m=386` and confirm the pill sits beside the title on desktop, wraps below on small widths.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/music/music-panel-viewer.tsx
git commit -m "feat: align header with tom/capo control"
```

---

### Task 2: Implement segmented pill trigger + active segment state

**Files:**
- Modify: `frontend/src/components/music/music-panel-viewer.tsx`
- Create: `frontend/src/components/music/segment-utils.ts`

- [ ] **Step 1: Write failing test for helper**

```ts
// frontend/src/components/music/segment-utils.test.ts
import { describe, it, expect } from 'vitest'
import { resolveSegmentFromTarget } from '@/components/music/segment-utils'

describe('resolveSegmentFromTarget', () => {
  it('returns tom when target is inside tom segment', () => {
    const tom = document.createElement('div')
    tom.setAttribute('data-segment', 'tom')
    const child = document.createElement('span')
    tom.appendChild(child)
    expect(resolveSegmentFromTarget(child)).toBe('tom')
  })

  it('returns capo when target is inside capo segment', () => {
    const capo = document.createElement('div')
    capo.setAttribute('data-segment', 'capo')
    const child = document.createElement('span')
    capo.appendChild(child)
    expect(resolveSegmentFromTarget(child)).toBe('capo')
  })

  it('returns null when no segment is found', () => {
    const root = document.createElement('div')
    expect(resolveSegmentFromTarget(root)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- segment-utils.test.ts`  
Expected: FAIL with “resolveSegmentFromTarget is not defined”.

- [ ] **Step 3: Implement helper**

```ts
// frontend/src/components/music/segment-utils.ts
export type SegmentKey = 'tom' | 'capo'

export function resolveSegmentFromTarget(target: HTMLElement | null): SegmentKey | null {
  if (!target) return null
  const segmentEl = target.closest('[data-segment]')
  const value = segmentEl?.getAttribute('data-segment')
  return value === 'tom' || value === 'capo' ? value : null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- segment-utils.test.ts`  
Expected: PASS.

- [ ] **Step 5: Add active segment state + click capture**

```tsx
// near other read-mode state
const [activeSegment, setActiveSegment] = useState<'tom' | 'capo'>('tom')

const handleSegmentClick = (event: React.MouseEvent<HTMLDivElement>) => {
  const segment = resolveSegmentFromTarget(event.target as HTMLElement)
  if (segment) setActiveSegment(segment)
}
```

- [ ] **Step 6: Build segmented pill trigger**

```tsx
// ResponsivePopover trigger
<div
  className="inline-flex items-stretch rounded-full border border-border bg-muted/40 shadow-sm overflow-hidden min-h-11 w-full sm:w-auto"
  onClickCapture={handleSegmentClick}
  role="group"
  aria-label="Tom e capo"
>
  <div
    data-segment="tom"
    className="flex items-center gap-2 px-3 py-2 hover:bg-muted/60 transition-colors cursor-pointer"
    title="Alterar tom"
  >
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Tom</span>
      <span className="text-sm font-mono font-bold">{effectiveKey}</span>
    </div>
  </div>
  <div className="w-px bg-border/70" />
  <div
    data-segment="capo"
    className="flex items-center gap-2 px-3 py-2 hover:bg-muted/60 transition-colors cursor-pointer"
    title="Alterar capo"
  >
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Capo</span>
      <span className="text-sm font-mono font-bold">{capoFret || '—'}</span>
    </div>
  </div>
</div>
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/music/music-panel-viewer.tsx frontend/src/components/music/segment-utils.ts frontend/src/components/music/segment-utils.test.ts
git commit -m "feat: add segmented tom/capo trigger"
```

---

### Task 3: Emphasize active segment inside the popover

**Files:**
- Modify: `frontend/src/components/music/music-panel-viewer.tsx`

- [ ] **Step 1: Add active styling to Tom/Capo sections**

```tsx
<div
  className={cn(
    "space-y-3",
    activeSegment === 'tom' && "rounded-lg ring-1 ring-primary/30 bg-primary/5 p-2"
  )}
>
  {/* Tom content */}
</div>

<div
  className={cn(
    "space-y-3 pt-4 border-t border-border",
    activeSegment === 'capo' && "rounded-lg ring-1 ring-secondary/40 bg-secondary/20 p-2"
  )}
>
  {/* Capo content */}
</div>
```

- [ ] **Step 2: Manual check**

Click Tom segment → open popover and confirm Tom section is subtly emphasized.  
Click Capo segment → open popover and confirm Capo section is emphasized.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/music/music-panel-viewer.tsx
git commit -m "feat: highlight active tom/capo section"
```

---

## Plan Self‑Review
- **Spec coverage:** Layout, segmented pill, interactions, active emphasis, responsive behavior are mapped to Tasks 1–3.
- **Placeholder scan:** No TODO/TBD text in tasks.
- **Type consistency:** Segment keys are `'tom' | 'capo'` across helper + state.

---

## Execution Handoff
Plan complete and saved to `docs/superpowers/plans/2026-04-29-tom-capo-segmented-pill-plan.md`.

Two execution options:
1. **Subagent‑Driven (recommended)** – I dispatch a fresh subagent per task, review between tasks.
2. **Inline Execution** – Execute tasks in this session using executing‑plans, batch execution with checkpoints.

Which approach?
