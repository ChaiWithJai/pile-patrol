import { describe, it, expect } from "vitest";
import { classify } from "./route.js";

describe("classify — paper mode", () => {
  it("routes a tax letter to admin with a reason ≥10 chars (the card contract)", () => {
    const r = classify("Property tax notice from the county", "paper");
    expect(r.category).toBe("admin");
    expect(r.reason.length).toBeGreaterThanOrEqual(10);
    expect(r.label.length).toBeGreaterThan(0);
    expect(r.label.length).toBeLessThanOrEqual(48);
  });

  it("routes a research draft to knowledge-creative", () => {
    expect(classify("draft of research notes on attention", "paper").category).toBe("knowledge-creative");
  });

  it("routes a birthday card to personal", () => {
    expect(classify("birthday card from mum", "paper").category).toBe("personal");
  });

  it("honors a spoken destination name as a strong signal", () => {
    expect(classify("put this in admin", "paper").category).toBe("admin");
  });

  it("an explicit override always wins and reports full confidence", () => {
    const r = classify("some ambiguous thing", "paper", { override: "personal" });
    expect(r.category).toBe("personal");
    expect(r.confidence).toBe(1);
    expect(r.source).toBe("override");
  });

  it("flags honest uncertainty instead of guessing silently", () => {
    const r = classify("zxcv qwer", "paper");
    expect(r.confidence).toBe(0);
    expect(r.source).toBe("fallback");
    expect(r.category).toBe("admin"); // first destination, but flagged low-confidence
  });

  it("rejects an invalid override and classifies normally", () => {
    const r = classify("bank statement", "paper", { override: "not-a-category" });
    expect(r.category).toBe("admin");
    expect(r.source).not.toBe("override");
  });
});

describe("classify — move mode", () => {
  it("routes kitchen items to the kitchen", () => {
    expect(classify("stack of plates and a mug", "move").category).toBe("kitchen");
  });
  it("routes a spoken room to that room", () => {
    expect(classify("this goes in the office", "move").category).toBe("office");
  });
});
