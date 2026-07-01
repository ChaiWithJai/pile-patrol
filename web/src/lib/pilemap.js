// pilemap — the canonical JTBD layer. Every destination knows which ADHD pattern
// runs its pile and what the one-line explain is, so each transaction delivers
// understanding, not just mechanics (the pattern-map thesis: explain + one
// adjustment, never thin). Copy voice: first person, lived, no clinical jargon.
//
// Grounding (docs/2026-07-01-canonical-jtbd.md):
//   Hemphill — "clutter is postponed decisions"; the log is those decisions, made.
//   Pinsky — one-step access; capture is the open box.
//   Barkley — externalize at the point of performance; the phone at the pile.
//   Davis — care tasks are morally neutral; stopping mid-pile counts.
//   Tuckman — undo makes instant decisions cheap.

export const PATTERNS = {
  "activation-friction": {
    name: "Activation friction",
    line: "Starting was the mountain. One touch was the whole climb.",
  },
  "environment-cueing": {
    name: "Environment cueing",
    line: "If it isn't visible it doesn't exist — the archive stays findable; the pile never was.",
  },
  "working-memory-overload": {
    name: "Open loops",
    line: "Anything left in your head runs in the background. This one's out now.",
  },
  "reward-mismatch": {
    name: "Reward mismatch",
    line: "Boring-but-important needs a win you can see. The count is the win.",
  },
  "shame-loop": {
    name: "Shame loop",
    line: "A pile is a setup gap, not a verdict.",
  },
  "time-blindness": {
    name: "Time blindness",
    line: "'Later' isn't real until it's visible.",
  },
};

// Destination → pattern + per-action explain. keep = the info is safe so the
// object can go; kill = a postponed decision, closed.
const MAP = {
  paper: {
    admin: {
      pattern: "activation-friction",
      keep: "Opening it was the whole mountain. Filed and backed up — the paper can go.",
      kill: "One postponed decision, closed for good.",
    },
    "knowledge-creative": {
      pattern: "environment-cueing",
      keep: "Search will find this faster than the pile ever did. It stops haunting the desk.",
      kill: "The idea was already yours — the printout wasn't.",
    },
    personal: {
      pattern: "working-memory-overload",
      keep: "The photo keeps it. One less loop humming in the background.",
      kill: "Looked at it, let it go. That's the move.",
    },
  },
  move: {
    _default: {
      pattern: "working-memory-overload",
      keep: "In the manifest. Ask for it later and a photo answers — the box can't go doom.",
      kill: "One less thing to pack. Fewer things need less system.",
    },
    misc: {
      pattern: "environment-cueing",
      keep: "Even 'unsorted' is findable now — the photo remembers where words didn't.",
      kill: "One less thing to pack. Fewer things need less system.",
    },
  },
};

// The explain for a committed transaction: { pattern, name, line }.
export function explainTx(tx, mode = "paper") {
  const table = MAP[mode] ?? MAP.paper;
  const entry = (tx.category && table[tx.category]) || table._default || table.admin;
  const patternId = entry.pattern;
  return {
    pattern: patternId,
    name: PATTERNS[patternId].name,
    line: (tx.kind === "kill" ? entry.kill : entry.keep) || PATTERNS[patternId].line,
  };
}

// Roll committed transactions up into "the patterns under your piles" —
// the desktop's understanding layer (design treatment 1e).
export function patternStats(transactions, mode = "paper") {
  const counts = new Map();
  let total = 0;
  for (const tx of transactions) {
    if (tx.status !== "committed") continue;
    const { pattern } = explainTx(tx, mode);
    counts.set(pattern, (counts.get(pattern) ?? 0) + 1);
    total += 1;
  }
  return [...counts.entries()]
    .map(([id, n]) => ({ id, name: PATTERNS[id].name, line: PATTERNS[id].line, count: n, pct: Math.round((n / total) * 100) }))
    .sort((a, b) => b.count - a.count);
}

// The Deal (design treatment 1a): a bounded session. Never more than ten —
// a pile is cleared in hands, not marathons. Stopping mid-deal still counts.
export const DEAL = {
  size: 10,
  hint: "Ten and you're done.",
  done: "That's a full patrol. Ten handled — stopping now is the design, not a failure.",
};

// Anti-shame microcopy (Davis: care tasks are morally neutral). Rotates on the
// phone after each commit.
export const AFFIRM = [
  "No wrong answers.",
  "Stop any time — it still counts.",
  "That was a postponed decision, made.",
  "Partial is progress.",
];
