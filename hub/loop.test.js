// End-to-end proof of the POC's core claim: a phone captures an item, it appears
// on the desktop, "keep" writes a labeled file to disk — over a real WebSocket to
// the real hub process. No browser, no mocks; the actual server.js.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocket } from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8471;
const DATA = path.join(os.tmpdir(), "pilepatrol-loop-" + PORT);
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

let child;

function connect() {
  return new WebSocket(`ws://localhost:${PORT}/ws`);
}
// Resolve with the first message whose `t` matches.
function waitFor(ws, t, timeout = 4000) {
  return new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error("timeout waiting for " + t)), timeout);
    ws.on("message", function onMsg(raw) {
      const m = JSON.parse(raw.toString());
      if (m.t === t) { clearTimeout(to); ws.off("message", onMsg); resolve(m); }
    });
  });
}
const send = (ws, m) => ws.send(JSON.stringify(m));
const open = (ws) => new Promise((r) => ws.on("open", r));

beforeAll(async () => {
  child = spawn(process.execPath, [path.join(__dirname, "server.js")], {
    env: { ...process.env, PORT: String(PORT), PILE_DATA: DATA },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error("hub did not start")), 5000);
    child.stdout.on("data", (b) => { if (b.toString().includes("Pile Patrol hub")) { clearTimeout(to); resolve(); } });
    child.stderr.on("data", (b) => process.stderr.write(b));
  });
});

afterAll(async () => {
  child?.kill("SIGKILL");
  await fs.rm(DATA, { recursive: true, force: true });
});

describe("full loop: pair → capture → keep → filed on disk", () => {
  it("writes a kept item into the dated backup folder", async () => {
    const desktop = connect();
    await open(desktop);
    send(desktop, { t: "hello", role: "desktop" });
    const session = await waitFor(desktop, "session");
    expect(session.token).toMatch(/^[0-9a-f]{8}$/);

    const phone = connect();
    await open(phone);
    send(phone, { t: "hello", role: "phone", token: session.token });
    await waitFor(phone, "joined");

    // desktop should see the phone as present
    const pres = await waitFor(desktop, "presence");
    expect(pres.phone).toBe(true);

    // phone captures
    const item = { id: "loop01", dataUrl: PNG, w: 1, h: 1, capturedAt: "2026-07-01T09:00:00.000Z" };
    send(phone, { t: "capture", item });
    const onDesk = await waitFor(desktop, "item");
    expect(onDesk.item.id).toBe("loop01");

    // desktop keeps it → admin
    send(desktop, { t: "decision", id: "loop01", action: "keep", mode: "paper", category: "admin", label: "Tax notice", reason: "reads like admin" });
    const filed = await waitFor(desktop, "filed");
    expect(filed.id).toBe("loop01");

    const img = path.join(DATA, "paper", "admin", "2026", "2026-07-01", "2026-07-01T09-00-00_loop01.png");
    const sidecar = img.replace(/\.png$/, ".json");
    expect((await fs.stat(img)).size).toBeGreaterThan(0);
    const meta = JSON.parse(await fs.readFile(sidecar, "utf8"));
    expect(meta.category).toBe("admin");
    expect(meta.label).toBe("Tax notice");

    desktop.close(); phone.close();
  });

  it("a kill removes the item and writes nothing", async () => {
    const desktop = connect();
    await open(desktop);
    send(desktop, { t: "hello", role: "desktop" });
    const session = await waitFor(desktop, "session");
    const phone = connect();
    await open(phone);
    send(phone, { t: "hello", role: "phone", token: session.token });
    await waitFor(phone, "joined");

    send(phone, { t: "capture", item: { id: "kill01", dataUrl: PNG, capturedAt: "2026-07-01T09:05:00.000Z" } });
    await waitFor(desktop, "item");
    send(desktop, { t: "decision", id: "kill01", action: "kill" });
    const removed = await waitFor(desktop, "removed");
    expect(removed.id).toBe("kill01");

    desktop.close(); phone.close();
  });
});
