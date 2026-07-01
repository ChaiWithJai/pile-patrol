# Pile Patrol — Service Map & Reference Patterns

*Companion to `2026-07-01-game-pile-patrol-design.md`. Format borrowed from
`bonsai/docs/SERVICE_BLUEPRINT.md` — because the line of visibility is the product story.*

**The bar:** clear a real paper pile in one sitting, hand nothing to the cloud, and physically throw
the paper away at the end without a flicker of doubt.

---

## 1. The three magic moments (demo choreography)

Each a sub-30-second wonder, in order:

1. **"It paired instantly."** Open the app on the Mac → a QR appears → point the iPhone at it →
   both screens show a green presence dot. Two devices, one private room, zero setup.
2. **"It saw the pile."** Point the phone at the paper pile → detected items pop as chips over the
   live view → they land on the Mac's queue in real time. The mess became a short stack of cards.
3. **"I threw the paper away."** Keep an item → it's OCR'd, labeled, filed into a backup-rotation
   folder → the desktop says *safe to discard* → you bin the physical paper. Kill → it's just gone.
   Ledger: **"7 papers gone · 0 information lost."** The relief is the product.

The privacy line under all three: **nothing you photographed ever left the house.**

## 2. The service blueprint

```
CUSTOMER        open app ──► scan QR ──► point at ──► items stream ──► keep / kill ──► file / bin ──► ledger
JOURNEY         on Mac       on phone     pile          to desktop      each item       the paper       "0 lost"
(emotions)      intent       trust        WONDER         momentum        control         lightness       relief
──────────────────────────────────────────────────────────────────────────────────── LINE OF INTERACTION
FRONTSTAGE      desktop:     QR +         phone (1b):    desktop queue   focused card    "safe to        running
(what they      "host a      presence     viewfinder +   fills with      (1a): Keep /    discard" +      ledger +
 see)           room" + QR   dots         detected chips  item cards      Kill + category  undo            streak
──────────────────────────────────────────────────────────────────────────────────── LINE OF VISIBILITY
BACKSTAGE       hub opens    hub binds    capture POST    WS push to      per-item FSM;   filesystem      ledger
(unseen,        session +    phone to     → ingest        desktop;        route() pre-    writer →        state on
 local on Mac)  WS; QR token session      (image on Mac)  queue store     fills fields    labeled file    disk
─────────────────────────────────────────────────────────────────────────────── LINE OF INTERNAL INTERACTION
SUPPORTING      mkcert HTTPS on LAN · llama-server (Bonsai, grammar-pinned {category,label} JSON,
PROCESSES       deterministic fallback) · Whisper (audio→transcript) · Swift Vision helper
(localhost)     (image→rects+text) · ~/PilePatrol folders → 3-tier backup (Mac→T7→Drive)
```

**The line of visibility is the whole privacy story.** Nothing below it receives raw media off the
Mac: the phone's photo is stored *on your own machine*, Vision emits text, Whisper emits text,
Bonsai emits JSON. "Runs on my private server" is only true *because of where that line sits* —
privacy is the architecture, not a settings page. (Bonsai's doctrine, applied.)

## 3. Concrete service map (processes + contracts)

| Service | Runtime | Exposes | Contract |
|---|---|---|---|
| `web/` SPA | Svelte/Vite (built) | — (served by hub) | one build; device-detected phone vs desktop UI |
| **hub** | Node/Bun on the Mac | HTTPS `:8443` (LAN) | static + `WS /api/session` · `POST /api/capture` · `POST /api/keep` · `POST /api/route` · `POST /api/ocr` · `WS /api/listen` |
| **Bonsai** | `llama-server` | `:8080` `/v1/chat/completions` | `response_format: json_schema` → `{category, label}` (grammar-pinned) |
| **Whisper** | whisper.cpp/MLX | localhost | audio stream → transcript text |
| **Vision helper** | Swift CLI | shelled out by hub | image → `{rects[], text}` (VNRecognizeText / doc-rect) |
| **Filesystem** | Mac FS | `~/PilePatrol/<mode>/<cat>/…` | image + sidecar JSON; folder is in the backup rotation |

`route()` grammar schema (the seam's contract — and, per bonsai Footgun #13, **the schema IS the
contract**: every field the card renders must be in it, or the model silently falls back):

```jsonc
// enum-pinned so a 1.7B ternary model "cannot NOT produce it"
{ "type":"object","required":["category","label","reason"],
  "properties":{
    "category":{"enum":["admin","knowledge-creative","personal"]},   // paper mode
    "label":{"type":"string","minLength":1,"maxLength":48},
    "reason":{"type":"string","minLength":10} } }                     // ≥10 chars or it fails validation
```

## 4. Context & reference patterns harvested from current projects

### From `pattern-map` (this repo) — reuse, don't reinvent
| Pattern | Source file | Use in Pile Patrol |
|---|---|---|
| Runes-store FSM | `lib/journey.svelte.js` | the pairing / capture / triage state machines |
| Addressable state | `lib/router.svelte.js` | `mode` + room id in the query string |
| Design tokens + card | `styles/global.css`, `ItemCard`-style components | Keep/Kill card + calm-room look |
| Local persistence | `lib/persisted.svelte.js`, `lib/storage.js` | session + ledger persistence |
| Data validator gate | `scripts/check-data.mjs` | validate `pileMap` → real pattern/lesson ids |
| Visual gate (Node 22) | `scripts/verify-visual.mjs` | desktop + phone layout gate; bind host so the checker reaches it |
| Copy voice + thesis | `context/`, Model-of-Understanding memory | every card = understanding + one adjustment, anti-shame |
| Product context | `data/patterns.json`, `data/lessons.json` | seed `pileMap.json` (mail→environment-cueing→lesson) |

### From `bonsai` — hard-won footguns, already paid for
| Pattern (bonsai ref) | Lesson | Use in Pile Patrol |
|---|---|---|
| Grammar-pinned JSON (Footgun #6) | ternary models can't freehand JSON; with a grammar they can't *not* | `route()` output pinned to the schema in §3 |
| Grammar **is** the contract (Footgun #13) | missing schema fields → silent bad fallback | every card field lives in the schema; fallback flagged |
| getUserMedia silent dead-end (Footgun #10) | unanswered permission never resolves/rejects; don't burn first-run | `startCaptureWithTimeout(8s)` + honest fallback; set "paired" only after the flow proceeds |
| Synthetic-input injection | oscillator-backed getUserMedia to test the mic on demand | **canvas-backed fake camera stream** → test capture with a fixture pile, no real camera |
| Deterministic fallbacks + verify gate | `make verify_bonsai`: no cloud, grammar-constrained, fallbacks intact | a hub verify gate; manual/deterministic `route()` fallback always present |
| TQ2_0 caveats | no Metal kernels (CPU-only), `<think>` blocks in raw completions | Bonsai launch notes (milestone 3); use grammar-constrained requests |
| Line-of-visibility = privacy | "nothing they sang left the device" | "nothing you photographed left the house" — §2 |

### From the `manage-backups` skill — the dispose target
The 3-tier rotation (Mac → T7 → Google Drive) is the reason "keep = file it" makes the paper safe
to discard. Align `~/PilePatrol/…` with the skill's folder conventions at implement time so kept
items ride the existing rotation with no new backup code.

### From HITL doctrine (ralph-mode / bonsai "interruption is the safety architecture")
The ambient voice agent is **suggestive, never destructive**: it pre-fills the focused item; the
human confirms; everything has undo. The interruption point is the safety, not a limitation.

---

## 5. What this implies we build first (milestone 1, ordered)
1. **hub skeleton** — HTTPS static serve over LAN (mkcert), one Svelte build, device-detected UI.
2. **session + WS + QR pairing** — desktop hosts a room/token, phone joins, presence dots.
3. **capture → desktop** — phone `startCaptureWithTimeout` → `POST /api/capture` → WS push → queue card.
4. **synthetic-camera test rig** — canvas-backed stream so the capture path is testable without a pile.
Triage actions, filesystem writes, and the model services are milestones 2–3 behind their seams.
