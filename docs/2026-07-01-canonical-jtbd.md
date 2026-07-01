# Pile Patrol — canonical JTBD, expert grounding, and the redesign

*2026-07-01. This is the domain layer the POC was missing: what job the tool is hired
for, whose methods it encodes, and how the design treatments map onto the build.*

## 1. The workload, profiled

Two repos, one thesis.

- **`adhd-pattern-map`** (canonical) — the *Model of Understanding*: a sensemaking app
  for late-diagnosed ADHD adults. Its reusable spine: **pattern-as-data**
  (mechanism → old story → new story → one adjustment → proof), a screen arc
  (Reveal → Rewrite → Adjust → Payoff → First Step), and a copy voice (first person,
  lived, never clinical). Six patterns: `time-blindness`, `activation-friction`,
  `working-memory-overload`, `reward-mismatch`, `environment-cueing`, `shame-loop`.
- **`pile-patrol`** (this repo) — the pattern map *applied at the point of performance*.
  Phone camera at the pile, voice narration, Mac auto-commits: keep = file the
  information, kill = bin the object, every action a SQLite transaction with undo.
  Local-first; nothing leaves the house.

The connective tissue is `web/src/lib/pilemap.js`: every destination knows which
pattern runs its pile and delivers a one-line explain per transaction — so each
keep/kill is understanding + one adjustment, never thin.

## 2. Jobs To Be Done

### Job A — paper triage (admin · knowledge-creative · personal)
> **When** I face a pile of unopened mail and papers, **I want to** point my phone at
> it and say what each thing is, **so I can** throw the paper away knowing the
> information is filed, backed up, and findable — without making a single filing
> decision by hand.

Success: seconds-per-sheet, and the receipt line "N recycled · N archived · 0 info lost."

### Job B — packing the move
> **When** I pack a box, **I want to** point the camera in and narrate the contents,
> **so I can** seal it without fear — the photo is the manifest, and "where are the
> passports?" gets answered by a picture, not by opening ten boxes.

### Job C — unpacking (the anti-doom-box job)
> **When** I unpack, **I want to** ask for things by need ("the good knives") and see
> which box answers, **so I can** unpack by function — bed, bathroom, coffee, one
> working surface — instead of box-by-box completionism, before sealed boxes calcify
> into doom boxes.

## 3. Expert grounding → design rules (who says so)

| Rule in the product | Expert | Source |
|---|---|---|
| Capture is one gesture; category is a suggestion you can veto, never a form | Susan Pinsky — one-step access, ruthless reduction | *Organizing Solutions for People with ADHD* |
| The phone at the pile is the point of performance; nothing relies on remembering later | Russell Barkley — externalize everything | *Taking Charge of Adult ADHD* |
| One item, one prompt, ≤4 spoken options; undo makes instant decisions cheap | Ari Tuckman — the missing pause, decision cost | *More Attention, Less Deficit* |
| Zero-shame copy; stopping mid-pile is saved state, not failure | KC Davis — care tasks are morally neutral | *How to Keep House While Drowning* |
| Categories can be the user's own phrase; the transcript is the label | Judith Kolberg — kindred categories, body doubling | *ADD-Friendly Ways to Organize Your Life* |
| The log is the point: "clutter is postponed decisions" — made, and undoable | Barbara Hemphill | *Taming the Paper Tiger* |
| Recency-first archive + search; no folder tree as primary UI | Yukio Noguchi — file by last touch | "Super" Organization Method |
| Don't optimize retrieval of paper never retrieved; optimize capture | NAPO folk-Pareto (~80% never re-read) | NAPO-GPC |
| Show the captured photo at the moment of discard — the scan *replaces* the object | Penn State photo-substitution (15–35% more letting-go) | Winterich et al., *J. Marketing* 2017 |
| OHIO/one-touch fails ADHD (paralysis); we shrink "handling" to capture+narrate | Caroline Totah — "Keep It Moving" | carolinetotah.com |
| Voice, never keyboard, in the capture loop (~150 wpm vs ~40, no working-memory tax) | OT/AT literature | OT4ADHD, Understood.org |
| Declutter before packing; label by room; photo-inventory boxes; "open first" box | Sinfield / Shimmer / ADHD Online moving guides | — |

The doom-pile mechanism itself (DOOM = *Didn't Organize, Only Moved*): each item is a
live micro-decision, and the pile is the ADHD reminder system. The app must **replace
the pile's memory function before removing the pile** — that is why the archive is a
visible recency stream with search, not folders.

## 4. Worked examples (the canon)

1. **IRS letter** → "tax letter, respond by Aug 1" → filed *admin*, paper to the act
   tray. OHIO fails here (not resolvable on first touch); decouple capture from action.
2. **Autopaid utility bill** → archived, binned. Will never be retrieved; the copy is
   insurance, the filing labor is zero.
3. **Expired coupon/flyer** → toss, cheapest decision in the room — do trash first for
   momentum (Davis).
4. **Napkin sketch** → "idea for the onboarding" → *knowledge-creative* in your own
   words (Kolberg); the recency stream answers "I'll never see it again."
5. **Dishwasher manual** → scan-and-bin beats deliberating; findable online anyway.
6. **Kid's birthday card** → show the captured image before "recycle?" — the photo
   does the emotional work (Penn State). "Keep physical" stays a spoken exception.
7. **Scary unopened envelope** → the app is the body double: "open it, we'll just look."
8. **Insurance renewal** → archive + a dated task, instead of leaving the paper out as
   its own reminder (piles ARE the reminder system — replace, then remove).
9. **Partner's mail** → "for Sam" → one fixed handoff tray, never back in the pile.
10. **Lease / movers' quote** → tagged *move*, pinned until moving day, auto-demoted after.
11. **Wad of 2022 statements** → batch: one narration for the lot, all binned (Pinsky:
    don't organize what you can eliminate).
12. **Packing a box** → "Box 12, kitchen, mugs and the good knives" → photo manifest;
    unpack-time query returns the photo.
13. **"Open First" box** → meds, chargers, documents, kettle, sheets — checklist as
    externalized working memory.
14. **Walking away at item 17** → next session opens "17 handled last time — five more?"
    No red badges, no overdue.
15. **Regret** → search "council" → document + photo + the narration audio; the log
    shows honestly where the paper went. "Binned 214 this month; needed 3 back; all 3
    were here."

## 5. Design treatments → what changed in the build

From the original board (`ADHD Doom Piles Game.zip`): **1a The Deal**, 1b Lanes,
**1c Lava**, **1d Sprint**, **1e Desktop companion**. Applied now:

- **The Deal (1a)** → bounded sessions on the phone: "N of 10 · ten and you're done,"
  pips, and a done-state that says stopping is the design. Function is uncapped;
  the *framing* is capped.
- **Per-item understanding (1a's item card)** → every transaction row and phone
  receipt now carries a pattern chip + one-line explain from `pilemap.js`.
- **Anti-shame microcopy (1a/1d)** → rotating affirmations after each commit:
  "No wrong answers." "Partial is progress."
- **Patterns under your piles (1e)** → desktop sidebar rolls committed transactions
  up into pattern percentages, names the biggest driver, closes with Hemphill.
- **Summary reframe** → "N recycled · N archived · 0 info lost" (lossless
  compression, not loss).

Deferred, deliberately: Lava (1c, prevention streaks per surface), Sprint (1d,
timed body-double sessions), before/after payoff photos, deadline-visible move
collections, and voice-created kindred categories. Each has a seam already
(`pilemap.js`, the transaction log, the mode table).

## 6. Line of visibility (unchanged, restated)

Raw photos and audio stay on the Mac. Models emit text and structured JSON only.
Privacy is architecture, not a settings page.
