import { describe, it, expect } from "vitest";
import { intent, parseVoice } from "./route.js";

describe("voice intent", () => {
  it("detects kill intent from a spoken note", () => {
    expect(intent("just throw this away")).toBe("kill");
    expect(intent("that's junk, toss it")).toBe("kill");
    expect(intent("shred this one")).toBe("kill");
  });
  it("defaults to keep otherwise", () => {
    expect(intent("file this as taxes")).toBe("keep");
    expect(intent("this is a birthday card")).toBe("keep");
  });
});

describe("parseVoice", () => {
  it("keep + destination from a filing note", () => {
    const r = parseVoice("file this property tax bill", "paper");
    expect(r.action).toBe("keep");
    expect(r.category).toBe("admin");
    expect(r.transcript).toContain("tax");
  });
  it("kill note routes to discard with a reason", () => {
    const r = parseVoice("this is junk mail, throw it away", "paper");
    expect(r.action).toBe("kill");
    expect(r.reason.length).toBeGreaterThanOrEqual(10);
  });
});
