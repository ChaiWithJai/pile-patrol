// The transaction ledger — a real relational table (Node's built-in node:sqlite,
// zero deps). Every keep/kill is a committed row you can browse and undo. This is
// the "log of transactions" made literal: append-only in spirit, with an `undone`
// status rather than deletes, so the history stays honest.

// Load the built-in via createRequire so bundlers (Vitest/Vite) don't try to
// resolve "node:sqlite" through their own transform pipeline — they strip the
// node: prefix and fail. Plain node runs this fine too.
import { createRequire } from "node:module";
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS transactions (
  id           TEXT PRIMARY KEY,
  ts           TEXT NOT NULL,
  kind         TEXT NOT NULL,                 -- keep | kill
  source       TEXT NOT NULL,                 -- camera | voice | manual
  label        TEXT,
  category     TEXT,
  transcript   TEXT,
  image_file   TEXT,
  audio_file   TEXT,
  backup_ref   TEXT,
  status       TEXT NOT NULL DEFAULT 'committed',  -- committed | undone
  undone_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_tx_ts ON transactions (ts DESC);
`;

const COLS = ["id", "ts", "kind", "source", "label", "category", "transcript", "image_file", "audio_file", "backup_ref", "status", "undone_at"];

export function createStore(path = ":memory:") {
  const db = new DatabaseSync(path);
  db.exec(SCHEMA);

  const insertStmt = db.prepare(
    `INSERT INTO transactions (${COLS.join(", ")}) VALUES (${COLS.map(() => "?").join(", ")})`,
  );
  const undoStmt = db.prepare("UPDATE transactions SET status = 'undone', undone_at = ? WHERE id = ? AND status = 'committed'");
  const getStmt = db.prepare("SELECT * FROM transactions WHERE id = ?");
  const listStmt = db.prepare("SELECT * FROM transactions ORDER BY ts DESC LIMIT ?");

  return {
    insert(tx) {
      const row = {
        id: tx.id, ts: tx.ts ?? new Date().toISOString(), kind: tx.kind, source: tx.source ?? "manual",
        label: tx.label ?? null, category: tx.category ?? null, transcript: tx.transcript ?? null,
        image_file: tx.image_file ?? null, audio_file: tx.audio_file ?? null, backup_ref: tx.backup_ref ?? null,
        status: "committed", undone_at: null,
      };
      insertStmt.run(...COLS.map((c) => row[c]));
      return row;
    },
    undo(id) {
      const info = undoStmt.run(new Date().toISOString(), id);
      return info.changes > 0 ? getStmt.get(id) : null;
    },
    get(id) { return getStmt.get(id) ?? null; },
    list(limit = 100) { return listStmt.all(limit); },
    // Rolled-up counts for the ledger headline (committed only).
    summary() {
      const rows = db.prepare("SELECT kind, category, COUNT(*) n FROM transactions WHERE status='committed' GROUP BY kind, category").all();
      const s = { kept: 0, killed: 0, byCategory: {} };
      for (const r of rows) {
        if (r.kind === "keep") { s.kept += r.n; s.byCategory[r.category ?? "uncategorized"] = (s.byCategory[r.category ?? "uncategorized"] ?? 0) + r.n; }
        else if (r.kind === "kill") s.killed += r.n;
      }
      return s;
    },
    close() { db.close(); },
  };
}
