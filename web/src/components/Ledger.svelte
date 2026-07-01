<script>
  import { hub } from "../lib/hub.svelte.js";
  import { ledgerHeadline } from "../lib/triage.js";
  import { categoriesFor } from "../lib/categories.js";

  const h = $derived(ledgerHeadline(hub.ledger));
  const cats = $derived(categoriesFor(hub.mode));
</script>

<div class="ledger">
  <span class="kicker">The ledger</span>
  <div class="big">
    <strong>{h.discarded}</strong> papers gone
    <span class="lost" class:zero={h.infoLost === 0}>· {h.infoLost} info lost</span>
  </div>
  <div class="rows">
    {#each cats as c}
      <div class="row">
        <span>{c.label}</span>
        <span class="mono">{hub.ledger.byCategory[c.id] ?? 0}</span>
      </div>
    {/each}
    <div class="row total">
      <span>Filed &amp; safe to bin</span>
      <span class="mono">{h.keptFiled}</span>
    </div>
  </div>
</div>

<style>
  .ledger { background: var(--paper); border: 1px solid var(--line); border-radius: 18px; padding: 16px 18px; }
  .big { font: 500 20px/1.2 var(--display); color: var(--ink); margin: 10px 0 14px; }
  .big strong { color: var(--ochre); }
  .lost { font-size: 13px; color: var(--muted); font-family: var(--sans); }
  .lost.zero { color: var(--good); }
  .rows { display: flex; flex-direction: column; gap: 7px; }
  .row { display: flex; justify-content: space-between; font-size: 13px; color: var(--muted); }
  .row.total { border-top: 1px solid var(--line); padding-top: 8px; margin-top: 3px; color: var(--ink); font-weight: 600; }
  .mono { font-family: var(--mono); }
</style>
