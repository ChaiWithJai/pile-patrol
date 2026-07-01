<script>
  import QRCode from "qrcode";
  import { hub, setMode } from "../lib/hub.svelte.js";
  import { MODES, categoriesFor } from "../lib/categories.js";
  import { patternStats } from "../lib/pilemap.js";
  import TransactionLog from "./TransactionLog.svelte";

  let qrDataUrl = $state("");
  $effect(() => {
    if (hub.joinUrl) QRCode.toDataURL(hub.joinUrl, { margin: 1, width: 220, color: { dark: "#3f4234", light: "#f6f3e8" } }).then((u) => (qrDataUrl = u));
  });

  const noLan = $derived(hub.joinUrl && /\/\/(localhost|127\.0\.0\.1)[:/]/.test(hub.joinUrl));
  const cats = $derived(categoriesFor(hub.mode));
  const pats = $derived(patternStats(hub.transactions, hub.mode));
  const words = $derived(hub.mode === "move"
    ? { killed: "let go", kept: "boxed" }
    : { killed: "recycled", kept: "archived" });
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
        {#if noLan}<p class="warn">⚠ No wifi/ethernet address found on this Mac — this code points at localhost and your phone can't reach it. Check you're connected to wifi, then reload.</p>{/if}
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
        <span><strong>{hub.summary.killed}</strong> {words.killed}</span>
        <span><strong>{hub.summary.kept}</strong> {words.kept}</span>
        <span class="lost">· 0 info lost</span>
      </div>
    </div>

    <section class="grid">
      <TransactionLog />
      <aside class="side">
        {#if pats.length}
          <div class="pats">
            <span class="kicker">The patterns under your piles</span>
            <div class="prows">
              {#each pats as p (p.id)}
                <div class="prow">
                  <div class="ptop"><span class="pname mono">{p.id}</span><span class="ppct mono">{p.pct}%</span></div>
                  <div class="pbar"><div class="pfill" style="width:{p.pct}%"></div></div>
                </div>
              {/each}
            </div>
            {#if pats[0]}<p class="plead">{pats[0].name} is your biggest driver. {pats[0].line}</p>{/if}
          </div>
        {/if}
        <div class="cats">
          <span class="kicker">Filed by destination</span>
          <div class="rows">
            {#each cats as c}
              <div class="crow"><span>{c.label}</span><span class="mono">{hub.summary.byCategory[c.id] ?? 0}</span></div>
            {/each}
          </div>
        </div>
        <p class="hint">Hold the shutter on your phone and say where each item goes — "file this tax bill", "toss it". It commits instantly; undo anything here.</p>
        <p class="quote">"Clutter is postponed decisions." <span>— Barbara Hemphill. This log is those decisions, made.</span></p>
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
  .warn { font-size: 12px; line-height: 1.5; color: #9a4f4f; background: rgba(154, 79, 79, 0.1);
    border: 1px solid rgba(154, 79, 79, 0.3); border-radius: 10px; padding: 8px 11px; margin-top: 10px; max-width: 46ch; }
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
  .pats { background: var(--paper); border: 1px solid var(--line); border-radius: 18px; padding: 16px 18px; }
  .prows { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
  .ptop { display: flex; justify-content: space-between; margin-bottom: 5px; }
  .pname { font-size: 11px; color: var(--ochre); }
  .ppct { font-size: 11px; color: var(--muted); }
  .pbar { height: 6px; border-radius: 99px; background: var(--line); overflow: hidden; }
  .pfill { height: 100%; background: var(--ochre); }
  .plead { font-size: 12px; line-height: 1.5; color: var(--muted); margin: 12px 0 0; }
  .quote { font: italic 500 13px/1.5 var(--display); color: var(--ink); padding: 0 4px; }
  .quote span { font: 400 11.5px var(--sans); color: var(--muted); font-style: normal; }
  @media (max-width: 820px) { .grid { grid-template-columns: 1fr; } .pair { flex-direction: column; text-align: center; } }
</style>
