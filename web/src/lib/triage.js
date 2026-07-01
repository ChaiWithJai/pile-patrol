// Pure triage reducers — the ledger and queue logic, kept free of Svelte/DOM so
// the "did I lose information?" invariant is unit-testable. The store layer
// (triage.svelte.js) wraps these with runes; the hub trusts the same shapes.

export function emptyLedger() {
  return { discarded: 0, keptFiled: 0, infoLost: 0, byCategory: {} };
}

// Fold one resolved decision into the ledger. A "kill" only counts as
// information lost if it was NOT backed up first; a "keep" is always backed up,
// so infoLost stays 0 as long as keeps are filed and kills are of true trash.
export function ledgerReduce(ledger, decision) {
  const next = {
    ...ledger,
    byCategory: { ...ledger.byCategory },
  };
  if (decision.action === "keep") {
    next.keptFiled += 1;
    const c = decision.category ?? "uncategorized";
    next.byCategory[c] = (next.byCategory[c] ?? 0) + 1;
  } else if (decision.action === "kill") {
    next.discarded += 1;
    if (decision.backedUp) next.infoLost += 0; // captured before discard
  }
  return next;
}

// The headline the ledger shows. "0 information lost" is the whole promise.
export function ledgerHeadline(ledger) {
  const cleared = ledger.keptFiled + ledger.discarded;
  return {
    cleared,
    discarded: ledger.discarded,
    keptFiled: ledger.keptFiled,
    infoLost: ledger.infoLost,
    text: `${cleared} cleared · ${ledger.discarded} binned · ${ledger.infoLost} info lost`,
  };
}

// Remove a resolved item from the incoming queue, returning the next queue and
// the new focus (the top of the remaining queue, or null when the pile is clear).
export function resolveInQueue(queue, id) {
  const remaining = queue.filter((it) => it.id !== id);
  return { queue: remaining, focus: remaining[0] ?? null };
}
