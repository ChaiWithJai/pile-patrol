# UAT gate — root causes, screenflow against JTBD, and the crown jewel

*2026-07-02. Triggered by a UAT review: current HCI would confuse and bounce
most users. Supporting evidence: annotation overlay broken, black padding /
viewport bleed at the bottom, and no real engagement in the camera→detect
flow.*

## 1. The two blocking bugs — root cause and fix

### Annotation logic broken
`web/src/lib/hub.svelte.js`'s overlay boxes were positioned by mapping a
normalized source-frame coordinate (`box[0..1]`) linearly onto the on-screen
container as a raw percentage. But the video renders with
`object-fit: cover`, which scales the source frame up and **crops** whichever
axis overflows once its aspect ratio doesn't match the container's. On a
real phone, the camera's native aspect (fixed by hardware) essentially never
matches `.view`'s rendered aspect (fluid, decided by page layout) — so on
real devices every box was silently mispositioned. It only *looked* correct
in the synthetic-pile demo because the fixed 720×960 canvas happened to
match the container's aspect at common window sizes, hiding the bug from
casual testing.

**Fix:** `coverMap()` (`web/src/lib/camera.js`) undoes the cover-crop before
placing a box — same math the browser uses internally to scale+crop the
video, applied to box coordinates too. 4 unit tests lock in the identity
case (matched aspect — why the bug went unnoticed), both crop directions,
and the not-yet-measured fallback. Verified: content that would overflow now
scrolls inside `.phone` instead of the page (see below); the crop math
itself is proven in `web/src/lib/camera.test.js` (real-device aspect
mismatch can't be reproduced in this backgrounded-tab automation harness —
`ResizeObserver` is throttled on non-visible Chrome tabs — so correctness
here rests on the unit-tested transform, not a live screenshot).

### Black padding at the bottom / viewport bleed
`body { height: 100% }` is a **cap**, not a floor. `.phone` used
`min-height: 100dvh` inside a `display:flex; flex-direction:column` layout
whose `.view` child had no `min-height: 0` — a classic flexbox trap where a
video-bearing flex item resists shrinking below its intrinsic content size.
Once the phone's actual content (bar + viewfinder + the Deal progress row +
help text + buttons) exceeded one viewport, it overflowed *past* `body`'s
capped box onto bare `<html>`, which had no background set — rendering
black in dark-mode Safari and "bleeding" past what looked like the
viewport's edge.

**Fix:** `.phone` now uses `height: 100dvh; overflow-y: auto` (bounded,
scrolls internally instead of pushing the page taller); `.view` gets
`min-height: 0` (lets the flex item actually shrink); `html` now carries the
same paper background as `body` as a fallback, and `#app` gets an explicit
`height: 100%`. Verified live: forcing 2000px of extra content into
`.controls`, `.phone`'s box stayed capped at exactly one viewport
(818px, same as before), `document.documentElement.scrollHeight` never grew
past that viewport either — the overflow is fully contained, with no bleed
possible even in the worst case.

## 2. The real screenflow against the JTBD

The JTBD (`docs/2026-07-01-canonical-jtbd.md`) is: *point the phone, say
what it is, the paper is safe to throw away.* The service map for that:

```
camera on → something is detected → user engages (narrates) → committed → confirmed → understood
```

Auditing each beat as it actually shipped:

| Beat | JTBD says | What shipped (before this pass) |
|---|---|---|
| Camera on | Instant, obviously alive | ✅ camera/synthetic fallback is instant and honest about fallback |
| Something detected | A visible, legible "it sees my pile" moment | ❌ two static boxes always in the same place, never change, never announce themselves — reads as broken, not as "looking" |
| User engages | Hold + speak, low friction | ✅ hold-to-talk with live transcript is already good |
| Committed | Instant, no dead air | ✅ auto-commit + receipt is real and fast |
| Confirmed | Feels earned, explains itself | ✅ (added previous pass) receipt now carries the pattern explain line |
| Understood | The user leaves smarter about their own pattern | ✅ desktop pattern rollup, but only visible to the *other* device |

The **"something is detected" beat was the actual gap** — not just buggy
(wrong position) but *silent*: nothing on screen distinguished "I haven't
looked yet" from "I'm looking and found nothing" from "I found something."
That ambiguity is exactly what a first-time user reads as "this is broken,"
independent of the coordinate bug.

## 3. UX lifts considered, and feasibility

| Lift | Impact | Effort | Verdict |
|---|---|---|---|
| Fix coordinate mapping (cover-crop) | High — this *is* the reported break | Low (pure function + wiring) | **Shipped** |
| Fix viewport bleed | High — blocks the gate outright | Low (CSS) | **Shipped** |
| **"Looking at your pile…" scanning state + smooth box transitions** | High — turns a silent/dead moment into a legible, alive one; directly serves the reward-mismatch pattern (near-term visible win) | Low (CSS animation + one derived flag) | **Shipped — crown jewel** |
| Real on-device detection (Apple Vision) replacing placeholder boxes | Highest — but out of scope for a UAT/HCI gate; it's a model-quality problem, not an interaction problem | High (native Swift helper, new seam wiring) | Deferred — tracked as the next subsystem-3 milestone, not a UAT blocker |
| Per-box confidence styling / tap-to-correct a box | Medium — nice, but there's nothing to correct until real detection lands | Medium | Deferred until real detection ships (styling a placeholder's "confidence" is theater) |
| Onboarding tutorial overlay | Low — the flow is simple enough that a first hold-to-talk teaches itself once the scan state exists | Medium | Deferred |

## 4. The crown jewel

**Make "something is detected" a real, legible moment** — not just correctly
positioned (the bug fix), but *alive*: a scanning pulse while the app hasn't
found anything yet, boxes that ease into position rather than snapping (so a
future real-detection update reads as "it noticed something new," not as a
glitch), and this is the correctly-mapped state so the boxes actually sit on
the thing they claim to label. This is the single lift that turns the
JTBD's entry beat from silent/broken into the first trust-building moment of
the whole flow — everything downstream (narrate → commit → confirm) was
already good; this was the one beat actively working against the product.

Implementation: `web/src/components/Phone.svelte` — `.scan` state (shown
until the first identify response ever lands), `coverMap`-corrected box
placement, and a `transition: left/top/width/height 0.35s ease` on `.box` so
position updates animate instead of jumping.

## 5. What's still open

Real on-device detection (Apple Vision) is the next real lift, and it's a
model-integration task, not an interaction one — the seam (`identify()` in
`hub/identify.js`) is already shaped for it. Nothing in this pass should
need to change when that lands; `coverMap` and the scanning-state logic are
detection-engine-agnostic.
