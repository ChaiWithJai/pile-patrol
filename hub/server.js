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
import { writeKeep } from "./store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "web", "dist");
const DATA_ROOT = process.env.PILE_DATA || path.join(os.homedir(), "PilePatrol-data");
const PORT = Number(process.env.PORT || 8443);

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
  if (fss.existsSync(cert) && fss.existsSync(key)) {
    const opts = { cert: fss.readFileSync(cert), key: fss.readFileSync(key) };
    return { server: https.createServer(opts, handleRequest), scheme: "https" };
  }
  return { server: http.createServer(handleRequest), scheme: "http" };
}

// ---- sessions: token -> { host, phone, items } ----
const sessions = new Map();
const send = (ws, msg) => { try { ws?.readyState === 1 && ws.send(JSON.stringify(msg)); } catch {} };
function presence(s) {
  const p = { t: "presence", desktop: !!s.host, phone: !!s.phone };
  send(s.host, p); send(s.phone, p);
}

const { server, scheme } = makeServer();
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws) => {
  ws.session = null; ws.role = null;

  ws.on("message", async (raw) => {
    let m; try { m = JSON.parse(raw.toString()); } catch { return; }

    if (m.t === "hello") {
      if (m.role === "desktop") {
        const token = crypto.randomBytes(4).toString("hex");
        const s = { token, host: ws, phone: null, items: new Map() };
        sessions.set(token, s);
        ws.session = s; ws.role = "desktop";
        send(ws, { t: "session", token });
        presence(s);
      } else if (m.role === "phone") {
        // Join by token (scanned QR). As a same-Mac demo convenience, a tokenless
        // phone joins the only open room — private single-user tool, one room.
        let s = m.token ? sessions.get(m.token) : (sessions.size === 1 ? [...sessions.values()][0] : null);
        if (!s) { send(ws, { t: "error", message: "session not found — re-scan the code" }); return; }
        s.phone = ws; ws.session = s; ws.role = "phone";
        send(ws, { t: "joined", token: s.token });
        // replay any items captured before the phone (re)connected is not needed;
        presence(s);
      }
      return;
    }

    const s = ws.session;
    if (!s) return;

    if (m.t === "capture" && ws.role === "phone") {
      const item = { ...m.item, capturedAt: m.item.capturedAt || new Date().toISOString() };
      s.items.set(item.id, item);
      send(s.host, { t: "item", item });   // desktop shows it in the queue
      send(ws, { t: "ack", id: item.id }); // phone confirms sent
      return;
    }

    if (m.t === "decision" && ws.role === "desktop") {
      const item = s.items.get(m.id);
      if (!item) { send(ws, { t: "error", message: "unknown item " + m.id }); return; }
      if (m.action === "kill") {
        s.items.delete(m.id);
        send(s.host, { t: "removed", id: m.id });
        send(s.phone, { t: "removed", id: m.id });
        return;
      }
      // keep → write to disk under the data root (the backup target)
      try {
        const ref = await writeKeep(DATA_ROOT, {
          id: item.id, dataUrl: item.dataUrl, capturedAt: item.capturedAt,
          mode: m.mode || "paper", category: m.category, label: m.label,
          ocrText: m.ocrText, reason: m.reason, filedAt: new Date().toISOString(),
        });
        s.items.delete(m.id);
        const filed = { t: "filed", id: m.id, backupRef: ref.backupRef, dir: ref.dir };
        send(s.host, filed); send(s.phone, filed);
      } catch (e) {
        send(ws, { t: "error", message: "could not file: " + e.message });
      }
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
