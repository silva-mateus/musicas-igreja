# Tom/Capo Segmented Pill Design

Status: Approved for implementation  
Date: 2026-04-29  
Scope: `frontend/src/components/music/music-panel-viewer.tsx`

## Context
The Tom/Capo control must be visually prominent, always visible beside the title, and use an expanded “segmented pill + cards” presentation. The current trigger looks like a generic button and does not read as a high‑quality music control. The goal is a premium, clear, always‑visible control aligned with the warm paper UI.

## Goals
- Always visible beside the song title in read mode.
- Expanded segmented pill with two mini‑card segments: Tom and Capo.
- Clear labels + values with strong visual hierarchy.
- Works on desktop and mobile without hiding the control.
- Touch targets meet 44px minimum.

## Non‑Goals
- Changing chord transposition logic or API calls.
- Reworking other toolbar actions outside the header block.
- Introducing new theming tokens.

## Design Overview
### Placement & Layout
- **Desktop (md+):** Title/artist block on the left; segmented pill sits to the right on the same row, vertically centered.
- **Small screens:** If space is tight, the pill wraps below the title but remains inside the same header block and visually paired with it.
- Header spacing remains consistent with existing layout (`px-3 md:px-6`, `pt-3 pb-2`).

### Component Structure
**Segmented pill (single container):**
- Rounded full container with subtle border and soft background.
- Two equal segments inside (Tom | Capo), each behaving like a mini‑card.
- A thin vertical divider separates segments.

**Each segment:**
- Label: uppercase, small (`text-[10px]`), muted.
- Value: mono, bold, slightly larger (`text-sm`).
- Optional subtle chevron to indicate edit (only if it doesn’t add clutter).

### Visual Hierarchy
1. Title (largest).
2. Segment values (Tom/Capo).
3. Segment labels.
4. Optional chevrons.

### Interaction
- Clicking **either** segment opens the same popover (Tom/Capo selector).
- The opened segment receives a subtle emphasis inside the popover (visual cue only).
- Hover: gentle background lift; Active: slightly stronger border + soft shadow.
- Keyboard focus ring around the pill for accessibility.
- Haptic feedback via existing `TouchTarget`.

### Responsive Behavior
- Pill is `w-full` only on small screens; on desktop it is `shrink-0`.
- The two segments remain side‑by‑side; labels scale down to fit.
- Minimum height is 44px for comfortable tapping.

## Proposed Styling (Tailwind-level)
- **Pill container:** `inline-flex items-stretch rounded-full border border-border bg-muted/40 shadow-sm`
- **Segments:** `flex-1 px-3 py-2 rounded-full` (inner rounding via overflow hidden on container)
- **Divider:** `w-px bg-border/70`
- **Label:** `text-[10px] uppercase tracking-wider text-muted-foreground`
- **Value:** `text-sm font-mono font-bold text-foreground`
- **Hover:** `hover:bg-muted/60` (per segment)
- **Active:** `active:shadow-inner` (light)

## Implementation Notes
- Replace the current “Key & Capo Information Bar” trigger with the segmented pill.
- Keep `ResponsivePopover` as the wrapper, using the pill as `trigger`.
- Ensure the pill lives in the same header row as the title for md+.
- For small screens, allow the pill to wrap below the title but still inside the header container.

## Accessibility
- Pill and segments must be keyboard focusable.
- Provide `title`/`aria-label` for Tom and Capo segments.
- Maintain 44px height touch target.

## Acceptance Criteria
- Tom/Capo control is always visible beside the title (desktop) and directly under it (small screens).
- Segmented pill presents Tom/Capo as two mini cards with clear label/value hierarchy.
- Popover opens correctly from either segment.
- Mobile tap targets meet 44px minimum height.
- No layout regressions in header block.
