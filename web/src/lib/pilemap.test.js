import { describe, it, expect } from "vitest";
import { explainTx, patternStats, PATTERNS, DEAL, AFFIRM } from "./pilemap.js";
import { MODES } from "./categories.js";

describe("pilemap — the JTBD layer", () => {
  it("every destination in every mode resolves to a real pattern and both action lines", () => {
    for (const [mode, def] of Object.entries(MODES)) {
      for (const c of def.categories) {
        for (const kind of ["keep", "kill"]) {
          const ex = explainTx({ category: c.id, kind }, mode);
          expect(PATTERNS[ex.pattern], `${mode}/${c.id} pattern`).toBeDefined();
          expect(ex.name).toBeTruthy();
          expect(ex.line.length, `${mode}/${c.id}/${kind} line`).toBeGreaterThan(10);
        }
      }
    }
  });

  it("survives a category-less kill (quick Toss) and unknown categories", () => {
    expect(explainTx({ kind: "kill" }, "paper").line).toBeTruthy();
    expect(explainTx({ category: "garage", kind: "keep" }, "move").pattern).toBe("working-memory-overload");
  });

  it("copy voice: no clinical jargon leaks into the lines", () => {
    const banned = /executive function|dopamine|dysfunction|disorder|symptom|optimize/i;
    const all = [
      ...Object.values(PATTERNS).map((p) => p.line),
      ...["paper", "move"].flatMap((m) =>
        MODES[m].categories.flatMap((c) =>
          ["keep", "kill"].map((k) => explainTx({ category: c.id, kind: k }, m).line))),
      DEAL.done, DEAL.hint, ...AFFIRM,
    ];
    for (const line of all) expect(line).not.toMatch(banned);
  });

  it("patternStats rolls up committed transactions and ignores undone", () => {
    const txs = [
      { category: "admin", kind: "keep", status: "committed" },
      { category: "admin", kind: "kill", status: "committed" },
      { category: "personal", kind: "keep", status: "committed" },
      { category: "admin", kind: "keep", status: "undone" },
    ];
    const stats = patternStats(txs, "paper");
    expect(stats[0].id).toBe("activation-friction");
    expect(stats[0].count).toBe(2);
    expect(stats[0].pct).toBe(67);
    expect(stats.reduce((n, s) => n + s.count, 0)).toBe(3);
  });

  it("the deal is bounded at ten (design treatment 1a)", () => {
    expect(DEAL.size).toBe(10);
  });
});
