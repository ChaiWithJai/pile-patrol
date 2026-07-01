import { describe, it, expect } from "vitest";
import { createStore } from "./db.js";

describe("transactions store", () => {
  it("inserts and lists newest-first", () => {
    const s = createStore(":memory:");
    s.insert({ id: "t1", ts: "2026-07-01T09:00:00Z", kind: "keep", source: "voice", category: "admin", label: "Tax bill" });
    s.insert({ id: "t2", ts: "2026-07-01T09:01:00Z", kind: "kill", source: "camera", label: "Junk mail" });
    const rows = s.list();
    expect(rows.map((r) => r.id)).toEqual(["t2", "t1"]);
    expect(rows[0].status).toBe("committed");
    s.close();
  });

  it("undo flips status to undone and stamps a time, only once", () => {
    const s = createStore(":memory:");
    s.insert({ id: "t1", kind: "keep", source: "voice", category: "admin" });
    const undone = s.undo("t1");
    expect(undone.status).toBe("undone");
    expect(undone.undone_at).toBeTruthy();
    expect(s.undo("t1")).toBe(null); // already undone → no-op
    s.close();
  });

  it("summary rolls up committed keeps by category and counts kills", () => {
    const s = createStore(":memory:");
    s.insert({ id: "a", kind: "keep", source: "voice", category: "admin" });
    s.insert({ id: "b", kind: "keep", source: "voice", category: "admin" });
    s.insert({ id: "c", kind: "keep", source: "camera", category: "personal" });
    s.insert({ id: "d", kind: "kill", source: "camera" });
    s.undo("b"); // undone shouldn't count
    const sum = s.summary();
    expect(sum.kept).toBe(2);
    expect(sum.killed).toBe(1);
    expect(sum.byCategory).toEqual({ admin: 1, personal: 1 });
    s.close();
  });
});
