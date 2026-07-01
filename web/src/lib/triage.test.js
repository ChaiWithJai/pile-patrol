import { describe, it, expect } from "vitest";
import { emptyLedger, ledgerReduce, ledgerHeadline, resolveInQueue } from "./triage.js";

describe("ledger", () => {
  it("counts a kept item under its category", () => {
    let l = emptyLedger();
    l = ledgerReduce(l, { action: "keep", category: "admin" });
    l = ledgerReduce(l, { action: "keep", category: "admin" });
    l = ledgerReduce(l, { action: "keep", category: "personal" });
    expect(l.keptFiled).toBe(3);
    expect(l.byCategory).toEqual({ admin: 2, personal: 1 });
  });

  it("a kill of true trash loses no information", () => {
    let l = emptyLedger();
    l = ledgerReduce(l, { action: "kill", backedUp: false });
    expect(l.discarded).toBe(1);
    expect(l.infoLost).toBe(0);
  });

  it("headline reports cleared / binned / info-lost", () => {
    let l = emptyLedger();
    l = ledgerReduce(l, { action: "keep", category: "admin" });
    l = ledgerReduce(l, { action: "kill", backedUp: false });
    const h = ledgerHeadline(l);
    expect(h.cleared).toBe(2);
    expect(h.discarded).toBe(1);
    expect(h.infoLost).toBe(0);
    expect(h.text).toContain("0 info lost");
  });

  it("does not mutate the input ledger", () => {
    const l = emptyLedger();
    ledgerReduce(l, { action: "keep", category: "admin" });
    expect(l.keptFiled).toBe(0);
  });
});

describe("queue", () => {
  const q = [{ id: "a" }, { id: "b" }, { id: "c" }];
  it("removes the resolved item and focuses the next", () => {
    const r = resolveInQueue(q, "a");
    expect(r.queue.map((x) => x.id)).toEqual(["b", "c"]);
    expect(r.focus.id).toBe("b");
  });
  it("focus is null when the pile is clear", () => {
    expect(resolveInQueue([{ id: "z" }], "z").focus).toBe(null);
  });
});
