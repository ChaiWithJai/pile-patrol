<script>
  import QRCode from "qrcode";
  import { hub, setMode } from "../lib/hub.svelte.js";
  import { createListener, supported as voiceSupported } from "../lib/voice.js";
  import { MODES } from "../lib/categories.js";
  import ItemCard from "./ItemCard.svelte";
  import Ledger from "./Ledger.svelte";

  let qrDataUrl = $state("");
  $effect(() => {
    if (hub.joinUrl) QRCode.toDataURL(hub.joinUrl, { margin: 1, width: 220, color: { dark: "#3f4234", light: "#f6f3e8" } }).then((u) => (qrDataUrl = u));
  });

  // Ambient agent — Web Speech, suggestive only. Feeds hub.heard, which the
  // focused card reads as a hint.
  let listener = null;
  function toggleMic() {
    if (!listener) listener = createListener({
      onTranscript: (t) => (hub.heard = t),
      onState: (s) => (hub.listening = s === "listening"),
    });
    if (hub.listening) listener.stop();
    else listener.start();
  }

  const cleared = $derived(hub.ledger.keptFiled + hub.ledger.discarded);
</script>

<main class="room">
  <header>
    <div>
      <span class="kicker">Pile Patrol · the calm room</span>
      <h1>Point your phone at the pile. Clear it here.</h1>
    </div>
    <div class="presence">
      <span class="pdot" class:on={hub.presence.desktop}>desktop</span>
      <span class="pdot" class:on={hub.presence.phone}>phone</span>
    </div>
  </header>

  {#if !hub.presence.phone}
    <!-- Pairing -->
    <section class="pair">
      <div class="qr">
        {#if qrDataUrl}<img src={qrDataUrl} alt="scan to pair your phone" />{:else}<div class="qr-wait"></div>{/if}
      </div>
      <div class="pair-copy">
        <h2>Scan to pair your phone</h2>
        <p>Open the camera on your iPhone and point it at this code. Both devices stay on your wifi — nothing leaves the house.</p>
        {#if hub.joinUrl}<p class="mono url">{hub.joinUrl}</p>{/if}
        <p class="tiny">No phone handy? Open <span class="mono">{location.origin}/?role=phone&amp;synthetic=1</span> in another window — it joins this room and streams a synthetic pile.</p>
      </div>
    </section>
  {:else}
    <!-- Triage -->
    <div class="controls">
      <div class="modes">
        {#each Object.entries(MODES) as [id, m]}
          <button class="mode" class:active={hub.mode === id} onclick={() => setMode(id)}>{m.label}</button>
        {/each}
      </div>
      <button class="mic" class:live={hub.listening} onclick={toggleMic} disabled={!voiceSupported()}>
        <span class="mdot"></span>{hub.listening ? "Listening…" : voiceSupported() ? "Ambient agent" : "Voice n/a"}
      </button>
    </div>

    {#if hub.listening && hub.heard}<p class="heard">heard: "{hub.heard}"</p>{/if}

    <section class="grid">
      <div class="focus">
        {#if hub.focus}
          {#key hub.focus.id}<ItemCard item={hub.focus} />{/key}
          <p class="remaining">{hub.queue.length} in the queue</p>
        {:else}
          <div class="empty">
            <h2>{cleared > 0 ? "Pile clear." : "Nothing yet."}</h2>
            <p>{cleared > 0 ? "You cleared it without losing a thing. Bin the paper." : "Capture an item on your phone — it appears here."}</p>
          </div>
        {/if}
      </div>
      <aside class="side">
        <Ledger />
        {#if hub.queue.length > 1}
          <div class="upnext">
            <span class="kicker">Up next</span>
            <div class="thumbs">
              {#each hub.queue.slice(1, 7) as it}<img src={it.dataUrl} alt="queued item" />{/each}
            </div>
          </div>
        {/if}
      </aside>
    </section>
  {/if}
</main>

<style>
  .room { max-width: 1040px; margin: 0 auto; padding: 40px 28px 80px; }
  header { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; margin-bottom: 30px; }
  h1 { font: 500 30px/1.1 var(--display); letter-spacing: -0.015em; margin: 12px 0 0; max-width: 18ch; }
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
  .mic { display: inline-flex; align-items: center; gap: 8px; font: 600 13px var(--sans); color: var(--muted); background: var(--paper); border: 1px solid var(--line); padding: 9px 16px; border-radius: 99px; }
  .mic:disabled { opacity: 0.5; }
  .mic .mdot { width: 8px; height: 8px; border-radius: 99px; background: var(--line); }
  .mic.live { color: var(--ink); border-color: var(--ochre); }
  .mic.live .mdot { background: var(--ochre); box-shadow: 0 0 0 4px var(--ochre-tint); }
  .heard { font-size: 13px; color: var(--ochre); margin: -6px 2px 14px; }

  .grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 24px; align-items: start; }
  .remaining { text-align: center; font-size: 12px; color: var(--muted); margin: 12px 0 0; }
  .empty { background: var(--paper); border: 1px dashed var(--line); border-radius: 22px; padding: 60px 30px; text-align: center; }
  .empty h2 { font: 500 24px var(--display); margin: 0 0 8px; }
  .empty p { font-size: 14px; color: var(--muted); margin: 0; }
  .side { display: flex; flex-direction: column; gap: 18px; }
  .upnext { background: var(--paper); border: 1px solid var(--line); border-radius: 18px; padding: 14px 16px; }
  .thumbs { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
  .thumbs img { width: 52px; height: 52px; object-fit: cover; border-radius: 9px; border: 1px solid var(--line); }
  @media (max-width: 820px) { .grid { grid-template-columns: 1fr; } .pair { flex-direction: column; text-align: center; } }
</style>
