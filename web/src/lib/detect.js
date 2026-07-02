// Live, reactive region detection using plain Web Platform APIs — Canvas 2D +
// ImageData (MDN: CanvasRenderingContext2D, ImageData) — no ML model, no
// server round-trip, no native helper. This replaced a server-side static
// placeholder that always returned the same two boxes regardless of what was
// actually in frame; this genuinely reacts to the live pile because it's
// recomputed from the current video frame every tick.
//
// Method: downscale the frame to a small grid, score each cell by local
// contrast against its neighbors (a cheap edge-density proxy — a stack of
// papers or a mug against a table has real edges; a blank counter doesn't),
// then flood-fill neighboring high-score cells into bounding boxes. It's a
// region-of-interest proposal, not object recognition — labels stay honest
// ("item", "flat item") rather than claiming to know what something is.

const GRID_W = 24, GRID_H = 32;

function luma(r, g, b) { return 0.2126 * r + 0.7152 * g + 0.0722 * b; }

// The pure, DOM-free algorithmic core — takes a plain grayscale grid (any
// array-like of length gridW*gridH) and returns bounding boxes. Kept separate
// from detectRegions() so it's unit-testable without a browser/Canvas.
export function regionsFromGrid(gray, gridW, gridH, { maxBoxes = 3, minCells = 3 } = {}) {
  const n = gridW * gridH;
  const score = new Float32Array(n);
  let maxScore = 0;
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      const i = y * gridW + x;
      let s = 0, count = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= gridW || ny >= gridH) continue;
        s += Math.abs(gray[i] - gray[ny * gridW + nx]);
        count++;
      }
      score[i] = count ? s / count : 0;
      if (score[i] > maxScore) maxScore = score[i];
    }
  }
  if (maxScore < 4) return []; // too flat/uniform to honestly claim anything is there

  const threshold = maxScore * 0.35;
  const active = new Uint8Array(n);
  for (let i = 0; i < n; i++) active[i] = score[i] >= threshold ? 1 : 0;

  const seen = new Uint8Array(n);
  const boxes = [];
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      const i = y * gridW + x;
      if (!active[i] || seen[i]) continue;
      const stack = [[x, y]];
      seen[i] = 1;
      let minX = x, maxX = x, minY = y, maxY = y, cells = 0;
      while (stack.length) {
        const [cx, cy] = stack.pop();
        cells++;
        if (cx < minX) minX = cx; if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= gridW || ny >= gridH) continue;
          const ni = ny * gridW + nx;
          if (active[ni] && !seen[ni]) { seen[ni] = 1; stack.push([nx, ny]); }
        }
      }
      if (cells < minCells) continue; // noise
      const w = (maxX - minX + 1) / gridW, h = (maxY - minY + 1) / gridH;
      boxes.push({ box: [minX / gridW, minY / gridH, w, h], cells });
    }
  }
  boxes.sort((a, b) => b.cells - a.cells);
  return boxes.slice(0, maxBoxes).map((b) => ({
    label: b.box[2] > b.box[3] * 1.4 ? "flat item" : b.box[3] > b.box[2] * 1.4 ? "tall item" : "item",
    box: b.box,
    confidence: 0,
    placeholder: false,
  }));
}

// The live entry point: grab the current frame, downscale via Canvas, hand
// the grayscale grid to regionsFromGrid(). Runs client-side on the phone —
// no network hop, so results are as fresh as the last tick.
export function detectRegions(videoEl, opts) {
  const vw = videoEl.videoWidth, vh = videoEl.videoHeight;
  if (!vw || !vh) return [];
  const c = document.createElement("canvas");
  c.width = GRID_W; c.height = GRID_H;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(videoEl, 0, 0, GRID_W, GRID_H);
  const { data } = ctx.getImageData(0, 0, GRID_W, GRID_H);
  const gray = new Float32Array(GRID_W * GRID_H);
  for (let i = 0; i < GRID_W * GRID_H; i++) {
    gray[i] = luma(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
  }
  return regionsFromGrid(gray, GRID_W, GRID_H, opts);
}
