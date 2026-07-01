<script>
  import { hub, decide } from "../lib/hub.svelte.js";
  import { classify } from "../lib/route.js";
  import { categoriesFor } from "../lib/categories.js";
  import pileMap from "../data/pileMap.json";

  let { item } = $props();

  // What the item "says" — typed label or a spoken/heard hint. classify() turns
  // it into a suggested destination. Suggestive, never destructive: prefilled,
  // fully overridable, one tap to confirm.
  let text = $state("");
  const cats = $derived(categoriesFor(hub.mode));
  // The heard transcript from the ambient agent is offered as a hint when you
  // haven't typed anything yourself.
  const basis = $derived(text || hub.heard || item.hint || "");
  const suggestion = $derived(classify(basis, hub.mode));
  let chosen = $state(null);
  const category = $derived(chosen ?? suggestion.category);
  const patternNote = $derived(pileMap.byCategory?.[category]?.note ?? "");

  // reset when the focused item changes
  $effect(() => { item.id; text = ""; chosen = null; hub.heard = ""; });

  function keep() {
    decide(item.id, "keep", {
      category,
      label: text || suggestion.label,
      reason: suggestion.reason,
      ocrText: basis,
    });
  }
  function kill() { decide(item.id, "kill"); }
</script>

<div class="card">
  <img src={item.dataUrl} alt="captured item" />

  <div class="body">
    <input
      class="label"
      placeholder="What is it? (or just say it out loud)"
      bind:value={text}
      aria-label="item label"
    />

    <div class="chips">
      {#each cats as c}
        <button
          class="chip"
          class:active={category === c.id}
          onclick={() => (chosen = c.id)}
        >{c.label}</button>
      {/each}
    </div>

    <p class="reason" class:unsure={suggestion.confidence === 0 && !chosen}>{suggestion.reason}</p>
    {#if patternNote}<p class="pattern">{patternNote}</p>{/if}
  </div>

  <div class="actions">
    <button class="kill" onclick={kill}>
      <span class="ic">✕</span>Kill<small>bin the paper</small>
    </button>
    <button class="keep" onclick={keep}>
      <span class="ic">↓</span>Keep<small>back up + file, then bin</small>
    </button>
  </div>
</div>

<style>
  .card {
    background: var(--paper-2);
    border: 1px solid var(--line);
    border-radius: 22px;
    overflow: hidden;
    box-shadow: 0 2px 4px rgba(63, 66, 52, 0.06), 0 18px 40px rgba(63, 66, 52, 0.14);
    display: flex;
    flex-direction: column;
  }
  img { width: 100%; height: 260px; object-fit: cover; background: var(--paper-sunk); display: block; }
  .body { padding: 16px 18px 4px; }
  .label {
    width: 100%; border: none; background: transparent;
    font: 500 22px/1.15 var(--display); color: var(--ink);
    padding: 2px 0 10px; border-bottom: 1px solid var(--line);
  }
  .label:focus { outline: none; border-bottom-color: var(--ochre); }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0 0; }
  .chip {
    font: 600 12px var(--sans); color: var(--muted);
    background: var(--paper); border: 1px solid var(--line);
    padding: 7px 12px; border-radius: 99px;
  }
  .chip.active { color: var(--paper-2); background: var(--ochre); border-color: var(--ochre); }
  .reason { font-size: 13px; color: var(--muted); margin: 12px 2px 0; }
  .reason.unsure { color: var(--ochre); }
  .pattern {
    font-size: 12.5px; line-height: 1.45; color: var(--ink);
    margin: 8px 2px 0; padding: 10px 12px;
    background: var(--ochre-tint); border-left: 3px solid var(--ochre-light); border-radius: 8px;
  }
  .actions { display: grid; grid-template-columns: 1fr 1.4fr; gap: 10px; padding: 16px 18px 18px; }
  .actions button {
    min-height: 62px; border-radius: 15px; border: 1px solid var(--line);
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
    font: 600 14px var(--sans);
  }
  .actions small { font-weight: 400; font-size: 10.5px; opacity: 0.7; }
  .ic { font-size: 16px; }
  .kill { background: var(--paper); color: var(--muted); }
  .keep { background: var(--ochre); color: var(--paper-2); border-color: var(--ochre); box-shadow: 0 8px 22px rgba(154, 125, 79, 0.3); }
  .actions button:active { transform: translateY(1px); }
</style>
