<script>
  import { hub, undoTx } from "../lib/hub.svelte.js";
  import { explainTx } from "../lib/pilemap.js";

  function time(ts) {
    try { return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
    catch { return ""; }
  }
</script>

<div class="log">
  <div class="head">
    <span class="kicker">Transactions</span>
    <span class="count mono">{hub.transactions.length}</span>
  </div>

  {#if hub.transactions.length === 0}
    <p class="empty">No transactions yet. Capture something on your phone — each keep or kill lands here.</p>
  {:else}
    <div class="rows">
      {#each hub.transactions as tx (tx.id)}
        <div class="tx" class:undone={tx.status === "undone"}>
          <div class="thumb">
            {#if tx._thumb}<img src={tx._thumb} alt="" />{:else}<span class="ph">{tx.kind === "kill" ? "✕" : "▦"}</span>{/if}
          </div>
          <div class="meta">
            <div class="line1">
              <span class="label">{tx.label || (tx.kind === "kill" ? "Tossed" : "Untitled")}</span>
              <span class="badge {tx.kind}">{tx.kind === "keep" ? "kept" : "killed"}</span>
            </div>
            <div class="line2">
              {#if tx.category}<span class="cat">{tx.category}</span>{/if}
              <span class="src">{tx.source}</span>
              <span class="t mono">{time(tx.ts)}</span>
              {#if tx.transcript}<span class="tr">"{tx.transcript}"</span>{/if}
            </div>
            {#if tx.status === "committed"}
              {@const ex = explainTx(tx, hub.mode)}
              <div class="line3">
                <span class="pat mono">{ex.pattern}</span>
                <span class="why">{ex.line}</span>
              </div>
            {/if}
          </div>
          <div class="act">
            {#if tx.status === "committed"}
              <button onclick={() => undoTx(tx.id)}>Undo</button>
            {:else}
              <span class="undonetag">undone</span>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .log { background: var(--paper); border: 1px solid var(--line); border-radius: 18px; padding: 16px 18px; }
  .head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
  .count { color: var(--muted); font-size: 12px; }
  .empty { font-size: 13px; color: var(--muted); margin: 6px 2px; }
  .rows { display: flex; flex-direction: column; }
  .tx { display: flex; gap: 12px; align-items: center; padding: 10px 0; border-top: 1px solid var(--line-soft); }
  .tx:first-child { border-top: none; }
  .tx.undone { opacity: 0.45; }
  .tx.undone .label { text-decoration: line-through; }
  .thumb { width: 46px; height: 46px; border-radius: 9px; overflow: hidden; background: var(--paper-sunk);
    border: 1px solid var(--line); flex: none; display: flex; align-items: center; justify-content: center; }
  .thumb img { width: 100%; height: 100%; object-fit: cover; }
  .thumb .ph { color: var(--muted); font-size: 16px; }
  .meta { flex: 1; min-width: 0; }
  .line1 { display: flex; align-items: center; gap: 8px; }
  .label { font: 500 15px var(--display); color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .badge { font: 600 9px var(--sans); text-transform: uppercase; letter-spacing: 0.06em; padding: 2px 7px; border-radius: 99px; }
  .badge.keep { color: var(--paper-2); background: var(--sage); }
  .badge.kill { color: var(--muted); background: var(--line); }
  .line2 { display: flex; align-items: center; gap: 8px; margin-top: 3px; font-size: 11.5px; color: var(--muted); }
  .cat { color: var(--ochre); font-weight: 600; }
  .line3 { display: flex; align-items: baseline; gap: 8px; margin-top: 5px; min-width: 0; }
  .pat { flex: none; font-size: 9px; letter-spacing: 0.04em; color: var(--ochre); background: rgba(154, 125, 79, 0.12);
    border: 1px solid rgba(194, 168, 120, 0.4); padding: 2px 7px; border-radius: 99px; }
  .why { font-size: 11.5px; line-height: 1.35; color: var(--muted); }
  .tr { font-style: italic; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 40ch; }
  .act button { font: 600 12px var(--sans); color: var(--muted); background: none; border: 1px solid var(--line);
    padding: 6px 12px; border-radius: 9px; }
  .undonetag { font: 600 10px var(--sans); text-transform: uppercase; color: var(--muted); }
</style>
