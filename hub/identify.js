// identify() — the real-time vision seam. The phone streams frames; this turns a
// frame into labeled regions the phone overlays live. v1 is a PLACEHOLDER that
// returns steady generic regions so the streaming + overlay loop is real and
// verifiable end-to-end; Apple Vision (a Swift VNRecognizeText / detection helper
// the hub shells out to) drops in here with the same return shape.
//
// Return: { engine, labels: [{ label, box:[x,y,w,h] (normalized 0..1), confidence, placeholder }] }

export async function identify(frameDataUrl) {
  if (typeof frameDataUrl !== "string" || !frameDataUrl.startsWith("data:image/")) {
    return { engine: "placeholder", labels: [] };
  }
  // Steady placeholder regions — clearly flagged, so the UI can render them as
  // "identifying…" rather than pretending to recognize content it can't yet see.
  return {
    engine: "placeholder",
    labels: [
      { label: "document", box: [0.12, 0.16, 0.44, 0.30], confidence: 0, placeholder: true },
      { label: "object", box: [0.55, 0.52, 0.30, 0.26], confidence: 0, placeholder: true },
    ],
  };
}
