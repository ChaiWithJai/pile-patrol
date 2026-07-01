<script>
  import QRCode from "qrcode";
  import { hub, setMode } from "../lib/hub.svelte.js";
  import { MODES, categoriesFor } from "../lib/categories.js";
  import TransactionLog from "./TransactionLog.svelte";

  let qrDataUrl = $state("");
  $effect(() => {
    if (hub.joinUrl) QRCode.toDataURL(hub.joinUrl, { margin: 1, width: 220, color: { dark: "#3f4234", light: "#f6f3e8" } }).then((u) => (qrDataUrl = u));
  });

  const cats = $derived(categoriesFor(hub.mode));
</script>

<main class="room">
  <header>
    <div>
      <span class="kicker">Pile Patrol · the calm room</span>
      <h1>Narrate the pile from your phone. It files itself here.</h1>
    </div>
    <div class="presence">
      <span class="pdot" class:on={hub.presence.desktop}>desktop</span>
      <span class="pdot" class:on={hub.presence.phone}>phone</span>
    </div>
  </header>

  {#if !hub.presence.phone}
    <section class="pair">
      <div class="qr">{#if qrDataUrl}<img src={qrDataUrl} alt="scan to pair your phone" />{:else}<div class="qr-wait"></div>{/if}</div>
      <div class="pair-copy">
        <h2>Scan to pair your phone</h2>
        <p>Open the camera on your iPhone and point it at this code. Both devices stay on your wifi — nothing leaves the house.</p>
        {#if hub.joinUrl}<p class="mono url">{hub.joinUrl}</p>{/if}
        <p class="tiny">No phone handy? Open <span class="mono">{location.origin}/?role=phone&amp;synthetic=1</span> in another window.</p>
      </div>
    </section>
  {:else}
    <div class="controls">
      <div class="modes">
        {#each Object.entries(MODES) as [id, m]}
          <button class="mode" class:active={hub.mode === id} onclick={() => setMode(id)}>{m.label}</button>
        {/each}
      </div>
      <div class="summary">
        <span><strong>{hub.summary.killed}</strong> binned</span>
        <span><strong>{hub.summary.kept}</strong> filed</span>
        <span class="lost">· 0 info lost</span>
      </div>
    </div>

    <section class="grid">
      <TransactionLog />
      <aside class="side">
        <div class="cats">
          <span class="kicker">Filed by destination</span>
          <div class="rows">
            {#each cats as c}
              <div class="crow"><span>{c.label}</span><span class="mono">{hub.summary.byCategory[c.id] ?? 0}</span></div>
            {/each}
          </div>
        </div>
        <p class="hint">Hold the shutter on your phone and say where each item goes — "file this tax bill", "toss it". It commits instantly; undo anything here.</p>
      </aside>
    </section>
  {/if}
</main>

<style>
  .room { max-width: 1040px; margin: 0 auto; padding: 40px 28px 80px; }
  header { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; margin-bottom: 28px; }
  h1 { font: 500 30px/1.1 var(--display); letter-spacing: -0.015em; margin: 12px 0 0; max-width: 20ch; }
  .presence { display: flex; gap: 8px; }
  .pdot { font: 600 10px var(--sans); text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); padding: 5px 10px; border-radius: 99px; background: var(--paper); border: 1px solid var(--line); }
  .pdot.on { color: var(--paper-2); background: var(--sage); border-color: var(--sage); }

  .pair { display: flex; gap: 34px; align-items: center; background: var(--paper); border: 1px solid var(--line); border-radius: 24px; padding: 34px; }
  .qr img, .qr-wait { width: 220px; height: 220px; border-radius: 14px; background: var(--paper-2); }
  .pair-copy h2 { font: 500 22px var(--display); margin: 0 0 10px; }
  .pair-copy p { font-size: 14px; line-height: 1.55; color: var(--muted); max-width: 46ch; margin: 0 0 10px; }
  .url { font-size: 12px; color: var(--ochre); word-break: break-all; }
  .tiny { font-size: 12px; color: var(--muted); opacity: 0.85; }

  .controls { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
  .modes { display: flex; gap: 8px; }
  .mode { font: 600 13px var(--sans); color: var(--muted); background: var(--paper); border: 1px solid var(--line); padding: 9px 16px; border-radius: 99px; }
  .mode.active { color: var(--paper-2); background: var(--ink); border-color: var(--ink); }
  .summary { display: flex; gap: 14px; font: 500 15px var(--display); color: var(--ink); align-items: baseline; }
  .summary strong { color: var(--ochre); }
  .summary .lost { font-family: var(--sans); font-size: 13px; color: var(--good); }

  .grid { display: grid; grid-template-columns: 1.6fr 1fr; gap: 24px; align-items: start; }
  .side { display: flex; flex-direction: column; gap: 16px; }
  .cats { background: var(--paper); border: 1px solid var(--line); border-radius: 18px; padding: 16px 18px; }
  .cats .rows { display: flex; flex-direction: column; gap: 7px; margin-top: 10px; }
  .crow { display: flex; justify-content: space-between; font-size: 13px; color: var(--muted); }
  .hint { font-size: 12.5px; line-height: 1.5; color: var(--muted); padding: 0 4px; }
  @media (max-width: 820px) { .grid { grid-template-columns: 1fr; } .pair { flex-direction: column; text-align: center; } }
</style>
