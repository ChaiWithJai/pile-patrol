// Error-discovery harness for the route() classifier — the seam most likely to
// be silently wrong. A diverse, labeled sample of real doom-pile items; run
// classify() over it; organize the misses into failure modes. Repeatable:
//   node scripts/eval-route.mjs
// This is the deterministic-fallback we ship; the native model must beat it.

import { classify } from "../web/src/lib/route.js";

const CASES = [
  // ---- paper: admin ----
  ["Electric utility bill, past due", "paper", "admin"],
  ["Chase bank statement March", "paper", "admin"],
  ["IRS tax form 1099", "paper", "admin"],
  ["Car insurance renewal notice", "paper", "admin"],
  ["Apartment lease agreement", "paper", "admin"],
  ["Medical bill from the clinic", "paper", "admin"],
  ["Amazon delivery receipt", "paper", "admin"],
  ["DMV registration renewal", "paper", "admin"],
  ["Jury duty summons letter", "paper", "admin"], // 'summons' unknown, 'letter' admin
  ["Warranty card for the blender", "paper", "admin"], // 'card' pulls personal — watch
  // ---- paper: knowledge-creative ----
  ["Handwritten notes from the workshop", "paper", "knowledge-creative"],
  ["Printout of a research paper", "paper", "knowledge-creative"],
  ["Sketch of the app wireframe", "paper", "knowledge-creative"],
  ["Book chapter draft", "paper", "knowledge-creative"],
  ["Meeting notes and ideas", "paper", "knowledge-creative"],
  ["Course outline for the class", "paper", "knowledge-creative"],
  ["Article I printed to read later", "paper", "knowledge-creative"],
  ["Diagram of the system architecture", "paper", "knowledge-creative"],
  // ---- paper: personal ----
  ["Birthday card from grandma", "paper", "personal"],
  ["Concert ticket stub", "paper", "personal"],
  ["Kid's drawing from school", "paper", "personal"],
  ["Wedding invitation", "paper", "personal"],
  ["Old photo of the family", "paper", "personal"],
  ["Recipe card for banana bread", "paper", "personal"],
  ["Postcard from the trip", "paper", "personal"],
  ["Restaurant menu takeout", "paper", "personal"],
  // ---- spoken hints (ambient agent) ----
  ["put this in admin", "paper", "admin"],
  ["that's for knowledge creative", "paper", "knowledge-creative"],
  ["this is personal", "paper", "personal"],
  // ---- move mode ----
  ["stack of dinner plates", "move", "kitchen"],
  ["winter sweaters and socks", "move", "bedroom"],
  ["laptop charger and cables", "move", "office"],
  ["tv remote and cushions", "move", "living"],
  ["towels and shampoo", "move", "bathroom"],
  ["this goes in the office", "move", "office"],
];

let correct = 0;
const misses = [];
const lowConf = [];
for (const [text, mode, expected] of CASES) {
  const r = classify(text, mode);
  const ok = r.category === expected;
  if (ok) correct++;
  else misses.push({ text, mode, expected, got: r.category, conf: r.confidence, source: r.source });
  if (r.confidence === 0) lowConf.push({ text, mode, got: r.category });
}

const acc = ((correct / CASES.length) * 100).toFixed(1);
console.log(`\nroute() accuracy: ${correct}/${CASES.length} (${acc}%)`);

if (misses.length) {
  console.log(`\nFAILURE MODES (${misses.length}):`);
  for (const m of misses) {
    console.log(`  ✗ [${m.mode}] "${m.text}"  expected ${m.expected}, got ${m.got}  (conf ${m.conf}, ${m.source})`);
  }
}
console.log(`\nLOW-CONFIDENCE (flagged to the user, not silent): ${lowConf.length}`);
for (const l of lowConf) console.log(`  ? [${l.mode}] "${l.text}" -> ${l.got}`);

// exit non-zero if accuracy regresses below the bar, so this is a real gate
const BAR = 85;
process.exit(Number(acc) >= BAR ? 0 : 1);
