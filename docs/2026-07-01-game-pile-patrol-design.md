# Pile Patrol — a private, local-first doom-pile triage app (Mac hub + iPhone)

**Status:** design approved (shaping) · **Date:** 2026-07-01
**Shape:** a **standalone repo**, not a surface in the pattern-map app. Runs entirely on the user's
**Apple Silicon Mac** as a private LAN server, with the user's **own iPhone** as the camera client.
Nothing leaves the house; no cloud, no accounts, no deploy.
**Supersedes** the earlier draft of this file (which targeted a `/game` surface with Cloudflare-DO
signaling + WebRTC + browser-WebGPU models). Those decisions are reversed — see §3.

---

## 1. The problem, in the user's words

> "I point the camera at the doom pile and get a way to action it. Most of my doom piling is
> random papers and mail for knowledge work and admin — and helping me pack and plan my move."

The doom pile is mostly **paper**: mail, admin, printouts, notes. The trap is that *keeping the
object* feels safer than dealing with it, so the pile grows. The reframe driving the design:

**For paper, "keep" almost always means "keep the *information*, kill the *paper*."**

Win condition is not "sort the pile" — it's **"how much of the physical pile can you discard while
losing zero information."** Every kept item is digitized, labeled, and filed so the paper itself is
safe to throw away. On the Model-of-Understanding thesis: each item delivers *understanding* (what
this is, which ADHD pattern it sits on) + *one adjustment* (keep-and-file, or kill) — never thin.

## 2. North-star loop

```
 iPhone Safari (capture)        HOME LAN            Mac hub (server)              Desktop (triage)
 point at pile ──capture──▶  https / WS  ──▶  session state + queue  ──serves──▶  keep / kill
                                              ├─ Bonsai: route + label
                                              ├─ Vision: detect + OCR
                                              ├─ Whisper: ambient voice
                                              └─ filesystem: keep = write labeled file
                                                                     └──▶ 3-tier backup (Mac→T7→Drive)
```

Two modes share the loop: **Paper triage** and **Move / packing**.

## 3. Decisions locked (with rationale)

| Decision | Choice | Why |
|---|---|---|
| Deployment | **Local-first private server** | Runs on the user's Mac; iPhone on same LAN. No cloud, no ops. |
| Repo | **New standalone repo** (`pile-patrol`) | Isolated so we nail the experience; reuses pattern-map design tokens + `ItemCard`, drops journey/atlas/router. |
| Stack | **Svelte SPA (`web/`) + Node/Bun hub (`hub/`)** | Max reuse of existing Svelte design work; hub is a thin local server + model proxy. |
| Network | **LAN client-server** — iPhone ↔ Mac hub over WS/HTTP | The Mac is trusted and on the LAN, so WebRTC + Cloudflare DO are unnecessary. Images land on the Mac (the backup target). |
| Intelligence | **Native local models on Apple Silicon** | Real Ternary-Bonsai (llama.cpp/MLX), Apple **Vision** for OCR/detection, local **Whisper** for voice — called over localhost from the hub. The in-browser WebGPU ceiling (and the ternary-kernel footgun) is gone. |
| Dispose target | **Mac filesystem folders** that feed the existing 3-tier backup | "Keep" writes a labeled file into a backup-rotation folder → the paper is genuinely safe to discard. |
| Modes | **Both** (paper + move) | Both are live personal needs; a mode switch + two data models. |

## 4. Architecture

### 4.1 Topology
- **Mac hub** = the only server. Serves the built SPA over **HTTPS** (see §6 mkcert), holds the
  single active **session**, and proxies the local model services.
- **Two browser clients** off the one hub: the **desktop triage UI** (Mac browser) and the
  **phone capture UI** (iPhone Safari over LAN).
- No P2P, no signaling server, no TURN. Item payloads go phone → hub (that's where they're stored
  and backed up anyway).

### 4.2 The hub (`hub/`, Node or Bun)
Responsibilities, each a small module:
- **Static + HTTPS:** serve `web/dist` over the LAN with an mkcert cert (iOS camera requires a
  secure context).
- **Session + WS:** one active session (your two devices). Phone POSTs captures; hub pushes item
  events to the desktop over a WebSocket. Reconnect-safe (revisit the URL rejoins).
- **Model proxies:** `POST /api/route` → Bonsai · `POST /api/ocr` and `POST /api/detect` → Vision
  helper · `WS /api/listen` → Whisper stream. All localhost.
- **Filesystem dispose:** `POST /api/keep` writes the image + a sidecar (`ocrText`, `category`,
  `label`, `capturedAt`) into `~/PilePatrol/<mode>/<category>/…` — a folder already in the backup
  rotation.

### 4.3 State machines (small runes stores in `web/src/lib/`)
- **Pairing:** desktop `idle → hosting(QR: https URL + token)`; phone `scanning → joining(token) → paired`; hub binds phone to the session. `reconnecting` on drop.
- **Capture** (phone; treatment 1b Lanes): `framing → detect() → captured[item] → sent(POST)`.
- **Triage** (desktop; treatments 1e + 1a): queue of items; per focused item
  `pending → routing(voice | manual) → keep{category, label, backupRef} | kill → done`; ledger
  tallies `{discarded, keptFiled, infoLost: 0}`.
- **Ambient voice** (desktop): `idle → listening(Whisper) → transcript → route() → apply → idle`.
- **Mode:** `paper | move` — swaps the category model + card fields + filesystem root.

### 4.4 Seams — now backed by native local services
Every seam is an **async interface** (the UI renders loading/empty states). By the end of v1
(milestone 3) each is backed by a real native service; earlier milestones use a
deterministic/manual fallback behind the *same* interface, so swapping in the native service never
touches components. `session` and `store` are real from milestones 1–2; `route`/`ocr`/`detect`/
`listen` go native at milestone 3.

| Seam | Backed by | Notes |
|---|---|---|
| `session` (link) | hub WS/HTTP over LAN | replaces WebRTC+DO |
| `route(item, hint) → {category, label}` | **Bonsai** via llama.cpp, grammar-constrained JSON | reuse bonsai's "JSON the model can't get wrong" pattern |
| `ocr(crop) → text` / `detect(frame) → items[]` | **Apple Vision** helper (Tesseract.js fallback) | Swift CLI the hub shells out to |
| `listen() → transcript` | **Whisper** (whisper.cpp/MLX) | streamed from desktop mic |
| `store(item) → backupRef` | Mac filesystem | folder is in the 3-tier backup |

### 4.5 Modes / data models + filesystem layout
- **Paper** — `item = { id, crop, ocrText, category ∈ {admin, knowledge-creative, personal}, label, backedUp }`.
  Categories link to a pattern + lesson (ported `pileMap.json`, seeded from pattern-map's
  `patterns.json` / `lessons.json`). Files land in `~/PilePatrol/paper/<category>/YYYY/`.
- **Move** — `space (room) → box → item`, `item = { id, crop, room, box, label, fragile? }`.
  Output: a printable **box manifest** + room-by-room pack plan. Files land in
  `~/PilePatrol/move/<room>/<box>/`.

### 4.6 Surfaces + repo layout
- **Phone = capture** → treatment **1b Lanes** (full-bleed viewfinder, detected chips, flick to capture).
- **Desktop = triage / calm room** → treatment **1e**: incoming queue, focused **Keep/Kill** card
  (**1a**), ambient-agent bar (listening + live transcript), ledger, mode switch.
- Treatments **1c Lava** / **1d Sprint** are **deferred** optional layers.
- Repo:
  ```
  pile-patrol/
    web/    # Svelte SPA — phone + desktop UIs (Vite); reuse tokens + ItemCard
    hub/    # Node/Bun — HTTPS static, WS session, model proxies, fs writes
    models/ # launch scripts + notes for llama.cpp(Bonsai), whisper, Vision helper (no weights)
    docs/   # this spec moves here on scaffold
  ```

## 5. Local model services (the native intelligence)
- **Bonsai (routing/labeling):** run `llama-server` with the Ternary-Bonsai gguf; hub calls its
  OpenAI-compatible endpoint with a **grammar** constraining output to `{category, label}`. Ships
  in milestone 3; the `route()` interface exists from milestone 2 with a deterministic fallback.
- **Vision (OCR + document detect):** a tiny **Swift** helper wrapping `VNRecognizeTextRequest` /
  document rectangle detection; the hub shells out to it. Fallback: Tesseract.js in-hub. Milestone 3.
- **Whisper (voice):** whisper.cpp/MLX server; hub streams desktop-mic audio → transcript → `route()`.
  Milestone 3.

## 6. Error / edge handling
- **iOS secure-context footgun:** `http://<lan-ip>` grants **no camera** on iOS Safari. Required
  setup: `mkcert` a local CA, trust it once on the iPhone, serve `https://mac.local:port`. This is
  a first-class setup step, not an afterthought (same class as the Node-22 `127.0.0.1`-bind gotcha).
- **Connection drop** → `reconnecting`; revisiting the URL rejoins the session (token persists).
- **Camera / mic permission denied** → degrade: mic-denied → manual keep/kill+category; camera-denied
  → file-upload capture. Never `await` a bare getUserMedia prompt (treat unresolved as its own state).
- **Voice is suggestive, never destructive** → `route()` pre-fills the focused item; user confirms;
  everything has undo.
- **Model/service down** → hub returns a typed "unavailable"; UI falls back to manual, no crash.
- **Reduced motion** → scan/ring animations respect `prefers-reduced-motion`.

## 7. Testing
- **Unit (vitest):** each FSM's transitions (pairing, capture, triage keep/kill + counts, voice apply);
  `route()` intent shape; `pileMap` resolves to valid pattern/lesson ids; filesystem writer produces
  the right path + sidecar (mock fs).
- **Hub integration:** session/WS handshake against a fake client; model proxies against fake model
  servers (contract tests, no weights needed in CI).
- **Visual gate:** desktop triage + phone capture layouts (Node 22 local; hub bound so the checker
  can reach it over the cert).

## 8. Milestones (one product, built in order)
Milestone 1 is specified at implementation resolution; 2–3 are roadmap resolution and each gets its
own detailed plan when reached. **"v1" = the full product across milestones 1–3**; the first
implementation plan covers **milestone 1 only**.

1. **Hub + LAN link** *(this plan)* — scaffold `web/` + `hub/`; hub serves the SPA over HTTPS
   (mkcert) reachable on the LAN; session + WS; QR pairing (desktop hosts, phone joins); phone
   captures a photo → POST → hub pushes to desktop → item appears in a queue. Triage UI scaffolded
   but inert. Proves the private spine: your two devices, your LAN, capture→desktop.
2. **Triage + filesystem dispose** — Keep/Kill + categorize + write labeled files into backup-rotation
   folders + ledger + both mode data models + `pileMap` wiring. Deterministic `route()` fallback.
3. **Native intelligence** — Bonsai routing + Whisper ambient voice + Vision OCR/detection over
   localhost, replacing the deterministic/manual fallbacks.

## 9. Explicit non-goals
- No cloud, no accounts, no deploy, no stranger matching (the "peer" is *your own* two devices).
- No WebRTC / signaling / TURN (LAN client-server instead).
- No in-browser WebGPU models (native on the Mac instead).
- 1c/1d treatments and Drive-direct upload are later cycles (files reach Drive via the existing
  3-tier backup, not the app).

## 10. Prerequisites (part of the design, since it's local-first)
- Node ≥ 22 (or Bun) on the Mac; Vite for `web/`.
- `mkcert` local CA installed + trusted on the iPhone.
- (Milestone 3) llama.cpp + a Ternary-Bonsai gguf; whisper.cpp/MLX; Xcode command-line tools for the
  Swift Vision helper.
