// End-to-end proof of the real-time flow against the real hub: phone submits an
// item + voice note → hub auto-commits (files a keep / discards a kill) → writes
// a transaction → undo reverses it and deletes the file.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import fss from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocket } from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8473;
const DATA = path.join(os.tmpdir(), "pilepatrol-rt-" + PORT);
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const AUDIO = "data:audio/webm;base64,AAAA";

let child;
const connect = () => new WebSocket(`ws://localhost:${PORT}/ws`);
const open = (ws) => new Promise((r) => ws.on("open", r));
const send = (ws, m) => ws.send(JSON.stringify(m));
function waitFor(ws, t, timeout = 4000) {
  return new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error("timeout waiting for " + t)), timeout);
    ws.on("message", function onMsg(raw) {
      const m = JSON.parse(raw.toString());
      if (m.t === t) { clearTimeout(to); ws.off("message", onMsg); resolve(m); }
    });
  });
}

beforeAll(async () => {
  await fs.rm(DATA, { recursive: true, force: true });
  child = spawn(process.execPath, [path.join(__dirname, "server.js")], {
    env: { ...process.env, PORT: String(PORT), PILE_DATA: DATA, PILE_HTTP: "1" }, stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error("hub did not start")), 5000);
    child.stdout.on("data", (b) => { if (b.toString().includes("Pile Patrol hub")) { clearTimeout(to); resolve(); } });
    child.stderr.on("data", (b) => process.stderr.write(b));
  });
});
afterAll(async () => { child?.kill("SIGKILL"); await fs.rm(DATA, { recursive: true, force: true }); });

describe("real-time: submit voice note → auto-commit → transaction → undo", () => {
  it("session never hands the desktop a bare loopback join link — the phone can't reach localhost", async () => {
    const desktop = connect(); await open(desktop);
    send(desktop, { t: "hello", role: "desktop" });
    const sess = await waitFor(desktop, "session");
    // lanUrl must be present and point at a real interface, not the loopback —
    // this is what the client uses instead of its own (often "localhost") origin.
    expect(sess.lanUrl).toBeTruthy();
    expect(sess.lanUrl).not.toMatch(/localhost|127\.0\.0\.1/);
    desktop.close();
  });

  it("a keep note files the item and records a committed transaction", async () => {
    const desktop = connect(); await open(desktop);
    send(desktop, { t: "hello", role: "desktop" });
    const sess = await waitFor(desktop, "session");
    await waitFor(desktop, "transactions");

    const phone = connect(); await open(phone);
    send(phone, { t: "hello", role: "phone", token: sess.token });
    await waitFor(phone, "joined");
    await waitFor(desktop, "presence");

    send(phone, {
      t: "submit", id: "rt01", dataUrl: PNG, audioDataUrl: AUDIO,
      transcript: "file this property tax bill", capturedAt: "2026-07-01T09:00:00.000Z",
    });
    const committed = await waitFor(desktop, "committed");
    expect(committed.tx.kind).toBe("keep");
    expect(committed.tx.category).toBe("admin");
    expect(committed.tx.source).toBe("voice");
    expect(committed.summary.kept).toBe(1);

    const receipt = await waitFor(phone, "receipt");
    expect(receipt.tx.id).toBe("rt01");

    const img = path.join(DATA, "paper", "admin", "2026", "2026-07-01", "2026-07-01T09-00-00_rt01.png");
    expect(fss.existsSync(img)).toBe(true);

    desktop.close(); phone.close();
  });

  it("a 'throw it away' note commits a kill and writes no image", async () => {
    const desktop = connect(); await open(desktop);
    send(desktop, { t: "hello", role: "desktop" });
    const sess = await waitFor(desktop, "session"); await waitFor(desktop, "transactions");
    const phone = connect(); await open(phone);
    send(phone, { t: "hello", role: "phone", token: sess.token }); await waitFor(phone, "joined");

    send(phone, { t: "submit", id: "rt02", dataUrl: PNG, transcript: "this is junk, throw it away", capturedAt: "2026-07-01T09:02:00.000Z" });
    const committed = await waitFor(desktop, "committed");
    expect(committed.tx.kind).toBe("kill");
    expect(committed.summary.killed).toBe(1);
    desktop.close(); phone.close();
  });

  it("undo reverses a keep and deletes the filed image", async () => {
    const desktop = connect(); await open(desktop);
    send(desktop, { t: "hello", role: "desktop" });
    const sess = await waitFor(desktop, "session"); await waitFor(desktop, "transactions");
    const phone = connect(); await open(phone);
    send(phone, { t: "hello", role: "phone", token: sess.token }); await waitFor(phone, "joined");

    send(phone, { t: "submit", id: "rt03", dataUrl: PNG, transcript: "receipt for the printer", capturedAt: "2026-07-01T09:03:00.000Z" });
    await waitFor(desktop, "committed");
    const img = path.join(DATA, "paper", "admin", "2026", "2026-07-01", "2026-07-01T09-03-00_rt03.png");
    expect(fss.existsSync(img)).toBe(true);

    send(desktop, { t: "undo", id: "rt03" });
    const undone = await waitFor(desktop, "undone");
    expect(undone.id).toBe("rt03");
    expect(fss.existsSync(img)).toBe(false);
    desktop.close(); phone.close();
  });
});
