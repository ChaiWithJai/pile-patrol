// route() — the steering seam. Given some text about an item (an OCR string, a
// typed label, or a spoken hint like "that's taxes") and the active mode, decide
// which destination it belongs to and a short human label.
//
// v1 is a deterministic keyword classifier: reliable, on-device, zero setup, and
// it IS the fallback the native model degrades to. When a real Bonsai endpoint is
// wired (hub /api/route), it returns the SAME shape — grammar-pinned to this exact
// contract (see docs/service-map §3), so swapping it in never touches the UI.
//
// The contract (every field the card renders lives here — bonsai Footgun #13):
//   { category, label, reason, confidence, source }

import { categoriesFor, isCategory } from "./categories.js";

// Keyword → destination signals, per mode. Earliest + most hits wins; a direct
// mention of a destination name is the strongest signal of all.
const SIGNALS = {
  paper: {
    admin: ["bill", "invoice", "tax", "taxes", "bank", "statement", "insurance",
      "receipt", "mail", "letter", "notice", "form", "contract", "lease", "medical",
      "dmv", "utility", "account", "payment", "renewal", "policy", "warranty",
      "summons", "jury", "subscription", "deed", "passport", "registration"],
    "knowledge-creative": ["note", "notes", "sketch", "draft", "idea", "ideas",
      "article", "book", "research", "notebook", "printout", "manuscript", "essay",
      "diagram", "reference", "study", "outline"],
    personal: ["card", "photo", "ticket", "invitation", "kid", "kids", "school",
      "reminder", "birthday", "postcard", "recipe", "menu", "flyer", "coupon"],
  },
  move: {
    kitchen: ["pan", "pot", "plate", "mug", "cup", "knife", "utensil", "kitchen", "food", "spice"],
    bedroom: ["pillow", "blanket", "sheet", "clothes", "shirt", "sock", "bedroom", "hanger", "sweater"],
    office: ["cable", "charger", "laptop", "monitor", "pen", "paper", "office", "keyboard", "notebook", "book"],
    living: ["remote", "cushion", "candle", "frame", "living", "lamp", "vase", "throw"],
    bathroom: ["towel", "soap", "shampoo", "toothbrush", "bathroom", "razor", "lotion"],
    misc: ["misc", "random", "stuff", "junk", "unknown"],
  },
};

const CLEAN = (s) => String(s ?? "").toLowerCase();
const TITLE = (s) =>
  s.replace(/\s+/g, " ").trim().replace(/^\w/, (c) => c.toUpperCase()).slice(0, 48);

// Pull a short label out of the raw text: first meaningful line/phrase.
function deriveLabel(text) {
  const first = String(text ?? "")
    .split(/[\n.·•|]/)[0]
    .replace(/[^\p{L}\p{N}\s'&/-]/gu, " ")
    .trim();
  return TITLE(first || "Item") || "Item";
}

export function classify(text, mode = "paper", { override } = {}) {
  const cats = categoriesFor(mode);
  const signals = SIGNALS[mode] ?? SIGNALS.paper;
  const hay = CLEAN(text);

  // An explicit override (user tapped a category, or said its exact name) wins.
  if (override && isCategory(mode, override)) {
    return { category: override, label: deriveLabel(text), reason: "You chose this destination.", confidence: 1, source: "override" };
  }

  const scores = new Map(cats.map((c) => [c.id, 0]));
  // Direct destination-name mention: strong.
  for (const c of cats) {
    if (hay.includes(c.id.replace(/-/g, " ")) || hay.includes(c.label.toLowerCase())) {
      scores.set(c.id, scores.get(c.id) + 5);
    }
  }
  // Keyword hits: earlier hits weigh a touch more.
  for (const [cat, words] of Object.entries(signals)) {
    if (!scores.has(cat)) continue;
    for (const w of words) {
      const i = hay.indexOf(w);
      if (i >= 0) scores.set(cat, scores.get(cat) + 2 + Math.max(0, 1 - i / 120));
    }
  }

  let best = null, bestScore = 0;
  for (const [cat, s] of scores) if (s > bestScore) { best = cat; bestScore = s; }

  const label = deriveLabel(text);
  if (!best || bestScore === 0) {
    // Honest uncertainty — default to the first destination, flag low confidence.
    return {
      category: cats[0].id,
      label,
      reason: "Couldn't place this one — confirm the destination.",
      confidence: 0,
      source: "fallback",
    };
  }
  const catLabel = cats.find((c) => c.id === best)?.label ?? best;
  const confidence = Math.min(1, bestScore / 6);
  return {
    category: best,
    label,
    reason: `Reads like ${catLabel.toLowerCase()} — filing it there so the paper can go.`,
    confidence: Number(confidence.toFixed(2)),
    source: "keyword",
  };
}

// Voice notes carry an ACTION as well as a destination. "throw this away" is a
// kill; anything else defaults to keep-and-file. Kept deliberately literal — the
// native model refines it behind the same shape later.
const KILL_WORDS = ["trash", "toss", "throw away", "throw it away", "throw this away",
  "chuck", "shred", "junk", "recycle", "get rid", "bin it", "bin this", "discard", "don't need", "do not need"];

export function intent(text) {
  const t = CLEAN(text);
  return KILL_WORDS.some((w) => t.includes(w)) ? "kill" : "keep";
}

// Turn a spoken note into a full proposed action: what to do + where + a label.
export function parseVoice(text, mode = "paper") {
  const action = intent(text);
  const c = classify(text, mode);
  return {
    action,
    category: c.category,
    label: c.label,
    reason: action === "kill" ? "Heard 'toss it' — binning, nothing to file." : c.reason,
    confidence: c.confidence,
    transcript: String(text ?? ""),
  };
}
