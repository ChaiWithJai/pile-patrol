// The client half of the LAN link — a thin WebSocket to the Mac hub, all shared
// state in one runes store. Real-time flow: the phone streams frames for live
// identification and submits an item + voice note; the hub auto-commits and
// records a transaction; both devices see the ledger update. The desktop is the
// live transaction log; the phone gets a receipt it can undo.

export const hub = $state({
  role: null,
  connected: false,
  token: null,
  joinUrl: "",
  presence: { desktop: false, phone: false },
  mode: "paper",
  transactions: [], // desktop: rows (newest first), each may carry a _thumb
  summary: { kept: 0, killed: 0, byCategory: {} },
  identified: [], // phone: live overlay labels
  engine: "",
  receipt: null, // phone: last committed receipt
  error: "",
});

let ws = null;

function wsUrl() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.host}/ws`;
}

export function connect(role, token) {
  hub.role = role;
  ws = new WebSocket(wsUrl());
  ws.onopen = () => { hub.connected = true; ws.send(JSON.stringify({ t: "hello", role, token })); };
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
      if (m.mode) hub.mode = m.mode;
      break;
    case "presence":
      hub.presence = { desktop: m.desktop, phone: m.phone };
      break;
    case "mode":
      hub.mode = m.mode;
      break;
    case "transactions":
      hub.transactions = m.rows ?? [];
      if (m.summary) hub.summary = m.summary;
      break;
    case "committed": {
      const tx = { ...m.tx, _thumb: m.thumb ?? null };
      hub.transactions = [tx, ...hub.transactions];
      if (m.summary) hub.summary = m.summary;
      break;
    }
    case "undone":
      hub.transactions = hub.transactions.map((t) =>
        t.id === m.id ? { ...t, status: "undone" } : t);
      if (m.summary) hub.summary = m.summary;
      break;
    case "receipt":
      hub.receipt = m.tx;
      break;
    case "identified":
      hub.identified = m.labels ?? [];
      hub.engine = m.engine ?? "";
      break;
    case "error":
      hub.error = m.message;
      break;
  }
}

const sendMsg = (m) => ws?.readyState === 1 && ws.send(JSON.stringify(m));

// ---- desktop ----
export function setMode(mode) { hub.mode = mode; sendMsg({ t: "mode", mode }); }
export function undoTx(id) { sendMsg({ t: "undo", id }); }

// ---- phone ----
export function streamFrame(frame) { sendMsg({ t: "identify", frame }); }
export function submitItem(item) {
  hub.error = "";
  sendMsg({ t: "submit", ...item });
}
export function clearReceipt() { hub.receipt = null; }
