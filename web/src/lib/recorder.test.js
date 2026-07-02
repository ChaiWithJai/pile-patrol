import { describe, it, expect, afterEach, vi } from "vitest";
import { requestMic } from "./recorder.js";

afterEach(() => { vi.unstubAllGlobals(); });

describe("requestMic — permission must never hang the flow", () => {
  it("resolves to null (not hang forever) when the permission prompt is never answered", async () => {
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: () => new Promise(() => {}) } });
    const result = await requestMic(30);
    expect(result).toBeNull();
  });

  it("resolves to null when permission is denied", async () => {
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: () => Promise.reject(new Error("denied")) } });
    const result = await requestMic(30);
    expect(result).toBeNull();
  });

  it("returns the real stream when permission is granted promptly", async () => {
    const fakeStream = { getTracks: () => [] };
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: () => Promise.resolve(fakeStream) } });
    const result = await requestMic(30);
    expect(result).toBe(fakeStream);
  });
});
