import { describe, it, expect, afterAll } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseDataUrl, itemPath, writeKeep } from "./store.js";

// A 1x1 transparent PNG.
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

describe("parseDataUrl", () => {
  it("decodes a png data URL", () => {
    const { buffer, ext, mime } = parseDataUrl(PNG);
    expect(ext).toBe("png");
    expect(mime).toBe("image/png");
    expect(buffer.length).toBeGreaterThan(0);
  });
  it("throws on non-image input", () => {
    expect(() => parseDataUrl("nope")).toThrow();
  });
});

describe("itemPath", () => {
  it("builds a dated, sortable path under mode/category/year/day", () => {
    const p = itemPath("/data", {
      mode: "paper", category: "admin", id: "ab12cd34", ext: "png",
      capturedAt: "2026-07-01T14:03:09.123Z",
    });
    expect(p.dir).toBe(path.join("/data", "paper", "admin", "2026", "2026-07-01"));
    expect(p.imageFile).toMatch(/2026-07-01T14-03-09_ab12cd\.png$/);
    expect(p.sidecarFile).toMatch(/2026-07-01T14-03-09_ab12cd\.json$/);
  });
});

const tmp = path.join(os.tmpdir(), "pilepatrol-test-" + Math.abs(Date.parse("2026-07-01") % 100000));

describe("writeKeep", () => {
  it("writes the image + a sidecar carrying the label and ocr text", async () => {
    const res = await writeKeep(tmp, {
      id: "xyz789", mode: "paper", category: "admin", label: "Tax notice",
      ocrText: "Property tax due", reason: "Reads like admin.",
      capturedAt: "2026-07-01T14:03:09.123Z", dataUrl: PNG,
    });
    const img = await fs.readFile(res.imageFile);
    expect(img.length).toBeGreaterThan(0);
    const sidecar = JSON.parse(await fs.readFile(res.sidecarFile, "utf8"));
    expect(sidecar.label).toBe("Tax notice");
    expect(sidecar.ocrText).toBe("Property tax due");
    expect(sidecar.category).toBe("admin");
    expect(res.backupRef).toMatch(/^2026-07-01T14-03-09_xyz789$/);
  });
  afterAll(async () => { await fs.rm(tmp, { recursive: true, force: true }); });
});
