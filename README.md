# Pile Patrol

**Point your phone at a paper doom pile. Narrate it — "file this tax bill", "toss it" —
and it commits itself on your Mac: kept items labeled and filed so the paper is safe to
throw away, every action logged as a transaction you can undo. Nothing leaves the house.**

A private, local-first POC: your Mac is the only server, your iPhone is the camera, they
talk over your home wifi. No cloud, no accounts, no deploy. The core reframe: for paper,
*keeping the object is the trap* — so **keep = keep the information, kill the paper.** Win
condition: how much of the pile you can discard while losing zero information.

## The real-time loop

```
 iPhone (live camera)                LAN                 Mac hub                 Desktop (calm room)
 stream frames ──identify──▶  labels overlaid    identify() → labels
 hold shutter + say it ─────submit(item+voice)─▶ transcribe + route()
                                                 auto-commit: keep files it / kill bins it
                                                 write a transaction row (SQLite) ──▶ live log + undo
                                                 keep → labeled file ──▶ 3-tier backup
 receipt: "✓ filed as admin · undo"
```

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

It joins the room, streams a fake pile, and overlays live identification. **Hold the
shutter** and say what an item is ("file this tax bill", "toss it") — release to send. The
Mac routes it, commits instantly, and the **transaction log** on the desktop fills in with
a thumbnail, destination, and an **Undo**. Quick **Toss** bins without a note. Watch the
headline: *N binned · N filed · 0 info lost.* Kept files + the `pilepatrol.db` ledger land
under the data root the hub prints.

## Demo with your real iPhone

iOS Safari only grants camera/mic over HTTPS, so make a LAN cert first:

```bash
npm run certs          # mkcert (best) or self-signed; trust it once on the phone
npm run serve
```

On the iPhone (same wifi), open the Camera app and point it at the desktop's QR code.
Hold the shutter, narrate a real pile, triage lands on the Mac.

## What's real vs. staged

| Piece | This POC | Native upgrade (same seam) |
|---|---|---|
| phone ↔ Mac link | **real** — WebSocket over your LAN | — |
| live identification | streaming loop is real; labels are **placeholders** | Apple Vision (VNRecognizeText / detection) helper |
| voice note → destination | **real** — phone records audio + Web Speech transcript; hub routes it (100% on `npm run eval`) | local Whisper + Ternary-Bonsai (grammar-pinned) |
| auto-commit + receipt + undo | **real** | — |
| keep → file on disk | **real** — image + voice note + sidecar into a dated folder | point the data root at your 3-tier backup |
| transaction log | **real** — Node's built-in `node:sqlite` relational table | — |

The data root defaults to `~/PilePatrol-data` (override with `PILE_DATA`). Put it inside
your backup rotation and a filed item is genuinely safe to discard.

## Verify

```bash
npm run verify   # unit + real e2e (submit voice note → auto-commit → transaction → undo) + classifier eval
```

## Layout

```
web/    Svelte SPA — phone (live capture + voice) + desktop (transaction log), one build
hub/    Node server — WS session, identify() seam, voice routing, keep→filesystem, node:sqlite ledger
scripts/eval-route.mjs   error-discovery harness for the classifier
docs/   design spec + service map
```

Not a diagnosis or treatment. A tool for the brain you actually have.
