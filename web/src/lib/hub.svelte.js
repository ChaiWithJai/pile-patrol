// The client half of the LAN link — a thin WebSocket to the Mac hub, with all
// shared session state in one runes store (like pattern-map's router.svelte.js).
// The desktop is the host; the phone joins with a token. Triage decisions apply
// optimistically so the room feels instant; the hub confirms with filed/removed.

import { emptyLedger, ledgerReduce, resolveInQueue } from "./triage.js";

export const hub = $state({
  role: null,
  connected: false,
  token: null,
  joinUrl: "",
  presence: { desktop: false, phone: false },
  mode: "paper",
  queue: [],
  focus: null,
  ledger: emptyLedger(),
  filed: {}, // id -> backupRef
  error: "",
  captureCount: 0,
  heard: "", // last voice transcript, offered to the focused card as a hint
  listening: false,
});

let ws = null;

function wsUrl() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.host}/ws`;
}

export function connect(role, token) {
  hub.role = role;
  ws = new WebSocket(wsUrl());
  ws.onopen = () => {
    hub.connected = true;
    ws.send(JSON.stringify({ t: "hello", role, token }));
  };
  ws.onclose = () => { hub.connected = false; };
  ws.onerror = () => { hub.error = "connection lost — check you're on the same wifi"; };
  ws.onmessage = (e) => handle(JSON.parse(e.data));
}

function handle(m) {
  switch (m.t) {
    case "session":
      hub.token = m.token;
      hub.joinUrl = `${location.origin}/?join=${m.token}`;
      break;
    case "joined":
      hub.token = m.token;
      break;
    case "presence":
      hub.presence = { desktop: m.desktop, phone: m.phone };
      break;
    case "item":
      hub.queue = [...hub.queue, m.item];
      if (!hub.focus) hub.focus = m.item;
      break;
    case "filed":
      hub.filed = { ...hub.filed, [m.id]: m.backupRef };
      break;
    case "removed":
      // hub confirmation; queue already resolved optimistically
      break;
    case "ack":
      hub.captureCount += 1;
      break;
    case "error":
      hub.error = m.message;
      break;
  }
}

// ---- phone ----
export function sendCapture(item) {
  hub.error = "";
  ws?.send(JSON.stringify({ t: "capture", item }));
}

// ---- desktop ----
export function setMode(mode) { hub.mode = mode; }

export function decide(id, action, fields = {}) {
  const item = hub.queue.find((it) => it.id === id);
  if (!item) return;
  // optimistic: ledger + queue update immediately
  hub.ledger = ledgerReduce(hub.ledger, {
    action,
    category: fields.category,
    backedUp: action === "keep",
  });
  const r = resolveInQueue(hub.queue, id);
  hub.queue = r.queue;
  hub.focus = r.focus;
  ws?.send(JSON.stringify({ t: "decision", id, action, mode: hub.mode, ...fields }));
}
