// Camera capture for the phone. Two hard-won details from bonsai:
//  - getUserMedia with an unanswered permission prompt neither resolves nor
//    rejects (Footgun #10). We race it against a timeout so onboarding can never
//    hang forever, and we only mark "ready" once a stream actually arrives.
//  - a synthetic, canvas-backed stream (Footgun: synthetic-mic injection, here a
//    synthetic *camera*) lets the whole capture path run with no real camera —
//    the demo works in any browser window and the path is CI-testable.

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(Object.assign(new Error(label), { name: "TimeoutError" })), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

// A fake "doom pile" drawn to a canvas and streamed via captureStream(). Used
// when there's no camera (or ?synthetic=1) so capture always has something real.
export function syntheticStream() {
  const c = document.createElement("canvas");
  c.width = 720; c.height = 960;
  const ctx = c.getContext("2d");
  const items = [
    { x: 60, y: 120, w: 240, h: 150, t: "mail stack" },
    { x: 360, y: 200, w: 190, h: 120, t: "coffee mug" },
    { x: 120, y: 420, w: 300, h: 180, t: "tax notice" },
    { x: 420, y: 520, w: 200, h: 160, t: "notebook" },
    { x: 200, y: 700, w: 260, h: 150, t: "phone charger" },
  ];
  let f = 0;
  function draw() {
    ctx.fillStyle = "#cfd0c2"; ctx.fillRect(0, 0, c.width, c.height);
    for (let y = 0; y < c.height; y += 26) { ctx.fillStyle = "#d8d9cc"; ctx.fillRect(0, y, c.width, 13); }
    for (const it of items) {
      ctx.fillStyle = "#e0ddcd"; ctx.fillRect(it.x, it.y, it.w, it.h);
      ctx.strokeStyle = "#9a7d4f"; ctx.lineWidth = 2; ctx.strokeRect(it.x, it.y, it.w, it.h);
      ctx.fillStyle = "#3f4234"; ctx.font = "22px ui-sans-serif, system-ui";
      ctx.fillText(it.t, it.x + 10, it.y + 30);
    }
    ctx.fillStyle = "rgba(63,66,52,.5)"; ctx.font = "16px ui-monospace, monospace";
    ctx.fillText("synthetic pile · " + (f++ % 1000), 18, c.height - 18);
    requestAnimationFrame(draw);
  }
  draw();
  return c.captureStream(12);
}

export async function startCamera(videoEl, { timeoutMs = 8000, synthetic = false } = {}) {
  const attach = async (stream, source) => {
    videoEl.srcObject = stream;
    videoEl.setAttribute("playsinline", "");
    videoEl.muted = true;
    await videoEl.play().catch(() => {});
    return { ok: true, stream, source };
  };

  if (synthetic || !navigator.mediaDevices?.getUserMedia) {
    return attach(syntheticStream(), "synthetic");
  }
  try {
    const stream = await withTimeout(
      navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false }),
      timeoutMs,
      "camera permission timed out",
    );
    return attach(stream, "camera");
  } catch (e) {
    // Honest fallback — never a blank screen. The user can still demo the loop.
    const reason = e?.name === "TimeoutError" ? "timeout" : e?.name === "NotAllowedError" ? "denied" : "unavailable";
    const res = await attach(syntheticStream(), "synthetic");
    return { ...res, fellBackBecause: reason };
  }
}

// Grab the current video frame as a JPEG data URL + dimensions.
export function grabFrame(videoEl) {
  const w = videoEl.videoWidth || 720;
  const h = videoEl.videoHeight || 960;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  c.getContext("2d").drawImage(videoEl, 0, 0, w, h);
  return { dataUrl: c.toDataURL("image/jpeg", 0.72), w, h };
}

// A small, cheap frame for the live identify stream (keeps WS traffic light).
export function grabThumb(videoEl, maxW = 320) {
  const vw = videoEl.videoWidth || 720, vh = videoEl.videoHeight || 960;
  const scale = Math.min(1, maxW / vw);
  const w = Math.round(vw * scale), h = Math.round(vh * scale);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  c.getContext("2d").drawImage(videoEl, 0, 0, w, h);
  return c.toDataURL("image/jpeg", 0.5);
}

// object-fit:cover scales the source frame up until it fully fills the
// container, cropping whichever axis overflows. A normalized box computed
// against the RAW source frame (0..1 of srcW×srcH) lands in the wrong place
// once rendered unless that crop is undone — this is the fix for boxes that
// drift off their real target whenever the camera's aspect ratio doesn't
// match the on-screen viewfinder (true on virtually every real phone).
export function coverMap([bx, by, bw, bh], srcW, srcH, dstW, dstH) {
  if (!srcW || !srcH || !dstW || !dstH) return [bx, by, bw, bh];
  const scale = Math.max(dstW / srcW, dstH / srcH);
  const cropX = (srcW * scale - dstW) / 2;
  const cropY = (srcH * scale - dstH) / 2;
  const x = (bx * srcW * scale - cropX) / dstW;
  const y = (by * srcH * scale - cropY) / dstH;
  const w = (bw * srcW * scale) / dstW;
  const h = (bh * srcH * scale) / dstH;
  return [x, y, w, h];
}

export function makeId() {
  return (crypto.randomUUID?.() || Math.random().toString(36).slice(2)).replace(/-/g, "").slice(0, 8);
}
