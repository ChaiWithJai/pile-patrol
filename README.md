# Pile Patrol

**Point your phone at a paper doom pile. Keep or kill each item on your Mac. Kept
items are labeled and filed so the paper is safe to throw away. Nothing leaves the house.**

A private, local-first POC: your Mac is the only server, your iPhone is the camera,
they talk over your home wifi. No cloud, no accounts, no deploy. The core reframe:
for paper, *keeping the object is the trap* — so **keep = keep the information, kill
the paper.** Win condition: how much of the pile you can discard while losing zero information.

## Demo it in 60 seconds (no phone needed)

```bash
npm install
npm run serve          # builds the app + starts the hub
```

Open the printed **desktop** URL (`http://localhost:8443/`) on your Mac — you'll see a
pairing QR. Then, in another window, open the printed **phone** URL with a synthetic pile:

```
http://localhost:8443/?role=phone&synthetic=1
```

It joins the room and streams a fake pile. Tap the shutter a few times → items land on
the desktop → type/​say what each is → **Keep** (filed) or **Kill** (binned). Watch the
ledger: *N papers gone · 0 info lost.* Kept files appear under the data root the hub prints.

## Demo with your real iPhone

iOS Safari only grants the camera over HTTPS, so make a LAN cert first:

```bash
npm run certs          # mkcert (best) or self-signed; trust it once on the phone
npm run serve
```

On the iPhone (same wifi), open the Camera app and point it at the desktop's QR code.
Point at a real pile; tap to capture; triage on the Mac.

## What's real vs. staged

| Piece | This POC | Native upgrade (same seam) |
|---|---|---|
| phone ↔ Mac link | **real** — WebSocket over your LAN | — |
| keep → file on disk | **real** — image + sidecar JSON into a dated folder | point the data root at your 3-tier backup |
| `route()` labels → destination | **real** — deterministic classifier (100% on `npm run eval`) | Ternary-Bonsai via llama.cpp (grammar-pinned) |
| ambient voice agent | **real** — Web Speech (Chrome desktop), suggestive + overridable | local Whisper |
| detection / OCR | tap-to-capture one item | Apple Vision (VNRecognizeText) helper |

The data root defaults to `~/PilePatrol-data` (override with `PILE_DATA`). Put it inside
your backup rotation and a filed item is genuinely safe to discard.

## Verify

```bash
npm run verify   # unit + full pair→capture→keep→filed-on-disk e2e + classifier eval
```

## Layout

```
web/    Svelte SPA — phone (capture) + desktop (triage) UIs, one build
hub/    Node server — HTTPS static, WS session, keep→filesystem writer
scripts/eval-route.mjs   error-discovery harness for the classifier
docs/   design spec + service map
```

Not a diagnosis or treatment. A tool for the brain you actually have.
