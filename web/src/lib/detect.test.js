import { describe, it, expect } from "vitest";
import { regionsFromGrid } from "./detect.js";

const W = 24, H = 32;
const flat = (v = 100) => new Float32Array(W * H).fill(v);

function paintPatch(grid, x0, y0, w, h, v) {
  const g = Float32Array.from(grid);
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) g[y * W + x] = v;
  return g;
}

describe("regionsFromGrid — the reactive-detection core (no DOM needed)", () => {
  it("finds nothing on a uniform frame — never invents an object that isn't there", () => {
    expect(regionsFromGrid(flat(), W, H)).toEqual([]);
  });

  it("finds one region where there's real local contrast against the background", () => {
    const grid = paintPatch(flat(0), 4, 6, 6, 6, 255);
    const boxes = regionsFromGrid(grid, W, H);
    expect(boxes.length).toBe(1);
    const [x, y, w, h] = boxes[0].box;
    // roughly covers the painted patch (edges score highest, so box may be
    // a bit smaller than the solid interior — that's expected for an
    // edge-density detector, not a flood-fill-the-whole-blob one)
    expect(x).toBeGreaterThanOrEqual(3 / W);
    expect(x).toBeLessThan(11 / W);
    expect(y).toBeGreaterThanOrEqual(5 / H);
    expect(w).toBeGreaterThan(0);
    expect(h).toBeGreaterThan(0);
  });

  it("reacts to a genuinely different frame — this is what a fixed placeholder could never do", () => {
    const gridA = paintPatch(flat(0), 2, 2, 4, 4, 255);
    const gridB = paintPatch(flat(0), 15, 20, 4, 4, 255);
    const boxesA = regionsFromGrid(gridA, W, H);
    const boxesB = regionsFromGrid(gridB, W, H);
    expect(boxesA[0].box).not.toEqual(boxesB[0].box);
  });

  it("caps the number of returned boxes at maxBoxes", () => {
    let grid = flat(0);
    grid = paintPatch(grid, 1, 1, 3, 3, 255);
    grid = paintPatch(grid, 10, 1, 3, 3, 255);
    grid = paintPatch(grid, 1, 20, 3, 3, 255);
    grid = paintPatch(grid, 18, 25, 3, 3, 255);
    const boxes = regionsFromGrid(grid, W, H, { maxBoxes: 2 });
    expect(boxes.length).toBeLessThanOrEqual(2);
  });

  it("labels a wide/flat region vs a tall/narrow one differently", () => {
    const wide = regionsFromGrid(paintPatch(flat(0), 2, 10, 16, 3, 255), W, H)[0];
    const tall = regionsFromGrid(paintPatch(flat(0), 10, 2, 3, 20, 255), W, H)[0];
    expect(wide.label).toBe("flat item");
    expect(tall.label).toBe("tall item");
  });
});
