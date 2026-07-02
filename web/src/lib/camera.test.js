import { describe, it, expect } from "vitest";
import { coverMap } from "./camera.js";

describe("coverMap — undo object-fit:cover's crop when placing overlay boxes", () => {
  it("is the identity transform when source and container share an aspect ratio", () => {
    // The synthetic-pile demo accidentally matches aspect ratios, which is why
    // this bug passed unnoticed in that path: 720x960 source, 360x480 box.
    expect(coverMap([0.1, 0.2, 0.3, 0.4], 720, 960, 360, 480)).toEqual([0.1, 0.2, 0.3, 0.4]);
  });

  it("shifts a box when the container is wider than the source (crops top/bottom)", () => {
    // Real phone case: portrait camera frame (e.g. 720x1280, aspect .5625)
    // shown in a shorter/wider viewfinder box (e.g. 400x600, aspect .667).
    // The video is scaled to match width, so vertical content is cropped —
    // a box centered in the source should land higher up on screen than a
    // naive 1:1 percentage mapping would place it.
    const naive = [0.1, 0.45, 0.2, 0.1]; // centered vertically in the source
    const mapped = coverMap(naive, 720, 1280, 400, 600);
    expect(mapped[1]).not.toBeCloseTo(naive[1], 2);
    // Center of a vertically-centered source box should stay vertically
    // centered on screen too (crop is symmetric).
    const screenCenterY = mapped[1] + mapped[3] / 2;
    expect(screenCenterY).toBeCloseTo(0.5, 1);
  });

  it("shifts a box when the container is taller than the source (crops left/right)", () => {
    const naive = [0.45, 0.1, 0.1, 0.2];
    const mapped = coverMap(naive, 1280, 720, 400, 700);
    const screenCenterX = mapped[0] + mapped[2] / 2;
    expect(screenCenterX).toBeCloseTo(0.5, 1);
  });

  it("falls back to identity when dimensions aren't known yet (metadata not loaded)", () => {
    expect(coverMap([0.1, 0.1, 0.2, 0.2], 0, 0, 400, 600)).toEqual([0.1, 0.1, 0.2, 0.2]);
    expect(coverMap([0.1, 0.1, 0.2, 0.2], 720, 960, 0, 0)).toEqual([0.1, 0.1, 0.2, 0.2]);
  });
});
