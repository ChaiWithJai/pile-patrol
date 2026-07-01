// Pile Patrol hub — the only server. It runs on your Mac, serves the one Svelte
// build to both the desktop browser and the phone (over your LAN), and brokers a
// single paired session between them over a WebSocket. Captured images arrive
// here (your own machine — the backup target); "keep" writes them to disk.
//
// Transport is deliberately boring: plain WS on the LAN. The Mac is trusted, so
// there is no WebRTC, no signaling service, no cloud. HTTP on localhost is a
// secure context (camera works for a same-Mac demo); drop certs in ./certs to
// serve HTTPS for a real iPhone over the LAN.

import http from "node:http";
import https from "node:https";
import { promises as fs } from "node:fs";
import fss from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { writeKeep, deleteFiles } from "./store.js";
import { identify } from "./identify.js";
import { createStore } from "./db.js";
import { parseVoice } from "../web/src/lib/route.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "web", "dist");
const DATA_ROOT = process.env.PILE_DATA || path.join(os.homedir(), "PilePatrol-data");
const PORT = Number(process.env.PORT || 8443);

// The transaction ledger lives on disk next to the filed items.
fss.mkdirSync(DATA_ROOT, { recursive: true });
const db = createStore(path.join(DATA_ROOT, "pilepatrol.db"));

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon",
  ".woff2": "font/woff2", ".webmanifest": "application/manifest+json",
};

// ---- static file serving (SPA: unknown non-file routes fall back to index) ----
async function serveStatic(req, res) {
  const url = new URL(req.url, "http://x");
  let pathname = decodeURIComponent(url.pathname);
  let filePath = path.join(DIST, pathname);
  if (!filePath.startsWith(DIST)) { res.writeHead(403).end(); return; }
  try {
    const stat = await fs.stat(filePath).catch(() => null);
    if (!stat || stat.isDirectory()) filePath = path.join(DIST, "index.html");
    const ext = path.extname(filePath);
    const body = await fs.readFile(filePath);
    res.writeHead(200, { "content-type": MIME[ext] || "application/octet-stream" });
    res.end(body);
  } catch {
    // SPA fallback
    try {
      res.writeHead(200, { "content-type": MIME[".html"] });
      res.end(await fs.readFile(path.join(DIST, "index.html")));
    } catch { res.writeHead(404).end("build the app first: npm run build"); }
  }
}

function handleRequest(req, res) {
  if (req.url === "/healthz") { res.writeHead(200).end("ok"); return; }
  serveStatic(req, res);
}

// ---- server (https if certs exist, else http) ----
function makeServer() {
  const cert = path.join(ROOT, "certs", "cert.pem");
  const key = path.join(ROOT, "certs", "key.pem");
  // PILE_HTTP=1 forces plain HTTP (tests, or a localhost-only run) even when certs exist.
  if (process.env.PILE_HTTP !== "1" && fss.existsSync(cert) && fss.existsSync(key)) {
    const opts = { cert: fss.readFileSync(cert), key: fss.readFileSync(key) };
    return { server: https.createServer(opts, handleRequest), scheme: "https" };
  }
  return { server: http.createServer(handleRequest), scheme: "http" };
}

// ---- sessions: token -> { host, phone, items } ----
const sessions = new Map();
const send = (ws, msg) => { try { ws?.readyState === 1 && ws.send(JSON.stringify(msg)); } catch {} };
const broadcast = (s, msg) => { send(s.host, msg); send(s.phone, msg); };
function presence(s) {
  broadcast(s, { t: "presence", desktop: !!s.host, phone: !!s.phone });
}
const sidecarOf = (imageFile) => (imageFile ? imageFile.replace(/\.[^.]+$/, ".json") : null);

const { server, scheme } = makeServer();
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws) => {
  ws.session = null; ws.role = null;

  ws.on("message", async (raw) => {
    let m; try { m = JSON.parse(raw.toString()); } catch { return; }

    if (m.t === "hello") {
      if (m.role === "desktop") {
        const token = crypto.randomBytes(4).toString("hex");
        const s = { token, host: ws, phone: null, mode: "paper" };
        sessions.set(token, s);
        ws.session = s; ws.role = "desktop";
        send(ws, { t: "session", token });
        // hand the desktop the whole ledger so the log is populated on arrival
        send(ws, { t: "transactions", rows: db.list(100), summary: db.summary() });
        presence(s);
      } else if (m.role === "phone") {
        // Join by token (scanned QR). As a same-Mac demo convenience, a tokenless
        // phone joins the only open room — private single-user tool, one room.
        let s = m.token ? sessions.get(m.token) : (sessions.size === 1 ? [...sessions.values()][0] : null);
        if (!s) { send(ws, { t: "error", message: "session not found — re-scan the code" }); return; }
        s.phone = ws; ws.session = s; ws.role = "phone";
        send(ws, { t: "joined", token: s.token, mode: s.mode });
        presence(s);
      }
      return;
    }

    const s = ws.session;
    if (!s) return;

    // Desktop sets the active mode (paper | move); phone submissions use it.
    if (m.t === "mode" && ws.role === "desktop") {
      s.mode = m.mode || "paper";
      broadcast(s, { t: "mode", mode: s.mode });
      return;
    }

    // Live identification: phone streams frames, gets back overlay labels.
    if (m.t === "identify" && ws.role === "phone") {
      const r = await identify(m.frame);
      send(ws, { t: "identified", labels: r.labels, engine: r.engine });
      return;
    }

    // The heart of the real-time flow: phone submits an item + voice note; the
    // hub processes the note, auto-commits (keep files it / kill discards), and
    // records a transaction. Confirmation is the receipt + the ledger row.
    if (m.t === "submit" && ws.role === "phone") {
      const transcript = (m.transcript || "").trim();
      const parsed = parseVoice(transcript, s.mode);
      const action = m.action || parsed.action; // manual button overrides voice
      const capturedAt = m.capturedAt || new Date().toISOString();
      try {
        if (action === "kill") {
          const tx = db.insert({
            id: m.id, ts: capturedAt, kind: "kill",
            source: transcript ? "voice" : "manual",
            label: parsed.label, transcript,
          });
          broadcast(s, { t: "committed", tx, thumb: m.dataUrl, summary: db.summary() });
          send(ws, { t: "receipt", tx });
        } else {
          const category = m.category || parsed.category;
          const label = m.label || parsed.label;
          const ref = await writeKeep(DATA_ROOT, {
            id: m.id, dataUrl: m.dataUrl, audioDataUrl: m.audioDataUrl, capturedAt,
            mode: s.mode, category, label, transcript, reason: parsed.reason,
            filedAt: new Date().toISOString(),
          });
          const tx = db.insert({
            id: m.id, ts: capturedAt, kind: "keep",
            source: transcript ? "voice" : "manual",
            label, category, transcript,
            image_file: ref.imageFile, audio_file: ref.audioFile, backup_ref: ref.backupRef,
          });
          broadcast(s, { t: "committed", tx, thumb: m.dataUrl, summary: db.summary() });
          send(ws, { t: "receipt", tx });
        }
      } catch (e) {
        send(ws, { t: "error", message: "could not process: " + e.message });
      }
      return;
    }

    // Undo (from either device): reverse a committed transaction.
    if (m.t === "undo") {
      const tx = db.get(m.id);
      if (!tx || tx.status !== "committed") return;
      if (tx.kind === "keep") await deleteFiles([tx.image_file, sidecarOf(tx.image_file), tx.audio_file]);
      db.undo(m.id);
      broadcast(s, { t: "undone", id: m.id, summary: db.summary() });
      return;
    }
  });

  ws.on("close", () => {
    const s = ws.session;
    if (!s) return;
    if (ws.role === "desktop") { s.host = null; sessions.delete(s.token); }
    if (ws.role === "phone") { s.phone = null; presence(s); }
  });
});

function lanIPs() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const ni of list || []) {
      if (ni.family === "IPv4" && !ni.internal) out.push(ni.address);
    }
  }
  return out;
}

server.listen(PORT, "0.0.0.0", () => {
  const ips = lanIPs();
  console.log(`\n  Pile Patrol hub — ${scheme.toUpperCase()} on :${PORT}`);
  console.log(`  desktop (this Mac):  ${scheme}://localhost:${PORT}/`);
  for (const ip of ips) console.log(`  phone (same wifi):   ${scheme}://${ip}:${PORT}/`);
  if (scheme === "http" && ips.length) {
    console.log(`  ⚠  iPhone camera needs HTTPS — run "npm run certs" then trust the cert on the phone.`);
  }
  console.log(`  data root (→ back this up):  ${DATA_ROOT}\n`);
});
