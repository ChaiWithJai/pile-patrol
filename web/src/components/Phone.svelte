<script>
  import { onMount, onDestroy } from "svelte";
  import { hub, streamFrame, submitItem, undoTx, clearReceipt } from "../lib/hub.svelte.js";
  import { startCamera, grabFrame, grabThumb, makeId } from "../lib/camera.js";
  import { createListener } from "../lib/voice.js";
  import { startAudioRecording } from "../lib/recorder.js";

  let video;
  let source = $state("");
  let fellBack = $state("");
  let recording = $state(false);
  let transcript = $state("");
  let frozen = $state(null);

  let idTimer, recorder = null, listener = null;
  const params = new URLSearchParams(location.search);
  const synthetic = params.get("synthetic") === "1";

  onMount(async () => {
    const res = await startCamera(video, { synthetic });
    source = res.source; fellBack = res.fellBackBecause || "";
    // Live identification loop — stream a small frame ~1/sec when idle.
    idTimer = setInterval(() => {
      if (!recording && video?.videoWidth && hub.presence.desktop) streamFrame(grabThumb(video));
    }, 1000);
  });
  onDestroy(() => clearInterval(idTimer));

  async function startNote(e) {
    e.preventDefault();
    if (recording) return;
    frozen = grabFrame(video).dataUrl;
    transcript = "";
    recording = true;
    recorder = await startAudioRecording();
    listener = createListener({ onTranscript: (t) => (transcript = (transcript ? transcript + " " : "") + t) });
    listener.start();
  }

  async function endNote() {
    if (!recording) return;
    recording = false;
    listener?.stop();
    const audioDataUrl = recorder ? await recorder.stop() : null;
    submitItem({ id: makeId(), dataUrl: frozen, audioDataUrl, transcript: transcript.trim(), capturedAt: new Date().toISOString() });
    frozen = null; transcript = "";
  }

  // A quick toss without a note.
  function tossNow() {
    const dataUrl = grabFrame(video).dataUrl;
    submitItem({ id: makeId(), dataUrl, action: "kill", transcript: "", capturedAt: new Date().toISOString() });
  }

  const receipt = $derived(hub.receipt);
  $effect(() => {
    if (receipt) { const id = receipt.id; const t = setTimeout(() => { if (hub.receipt?.id === id) clearReceipt(); }, 6000); return () => clearTimeout(t); }
  });
</script>

<div class="phone">
  <div class="bar">
    <span class="kicker">Pile Patrol · capture</span>
    <span class="dot" class:on={hub.presence.desktop}></span>
  </div>

  <div class="view">
    <!-- svelte-ignore a11y_media_has_caption -->
    <video bind:this={video} autoplay playsinline muted></video>

    {#if !recording}
      {#each hub.identified as l}
        <div class="box" class:ph={l.placeholder}
          style="left:{l.box[0] * 100}%;top:{l.box[1] * 100}%;width:{l.box[2] * 100}%;height:{l.box[3] * 100}%">
          <span>{l.label}{l.placeholder ? " ?" : ""}</span>
        </div>
      {/each}
    {/if}

    {#if frozen}<img class="freeze" src={frozen} alt="captured" />{/if}

    <div class="hud">
      {#if source === "synthetic"}synthetic pile{:else}live camera{/if}
      {#if fellBack}· camera {fellBack}{/if}
      {#if hub.engine}· id: {hub.engine}{/if}
    </div>
    {#if recording}<div class="rec">● recording{transcript ? " · " + transcript : "…"}</div>{/if}
  </div>

  <div class="controls">
    <p class="help">
      {#if !hub.presence.desktop}Waiting for the desktop… keep this open.
      {:else if recording}Say what it is — "file this tax bill" or "toss it". Release to send.
      {:else}Hold to capture + talk. It files itself on your Mac.{/if}
    </p>
    <div class="row">
      <button class="toss" onclick={tossNow} disabled={!hub.presence.desktop}>Toss</button>
      <button class="shutter" class:live={recording}
        onpointerdown={startNote} onpointerup={endNote} onpointerleave={endNote}
        aria-label="hold to capture and narrate"></button>
      <span class="spacer"></span>
    </div>
  </div>

  {#if receipt}
    <div class="receipt">
      {#if receipt.kind === "keep"}✓ Filed{receipt.category ? " as " + receipt.category : ""}{:else}✓ Tossed{/if}
      <button onclick={() => { undoTx(receipt.id); clearReceipt(); }}>Undo</button>
    </div>
  {/if}
</div>

<style>
  .phone { max-width: 480px; margin: 0 auto; min-height: 100dvh; display: flex; flex-direction: column;
    padding: calc(10px + env(safe-area-inset-top)) 14px calc(14px + env(safe-area-inset-bottom)); }
  .bar { display: flex; align-items: center; justify-content: space-between; padding: 6px 4px 12px; }
  .dot { width: 9px; height: 9px; border-radius: 99px; background: var(--line); }
  .dot.on { background: var(--good); box-shadow: 0 0 0 4px rgba(143, 174, 122, 0.25); }
  .view { position: relative; flex: 1; border-radius: 24px; overflow: hidden; background: #000; border: 1px solid var(--line); }
  video, .freeze { width: 100%; height: 100%; object-fit: cover; display: block; }
  .freeze { position: absolute; inset: 0; }
  .box { position: absolute; border: 1.5px dashed rgba(246, 243, 232, 0.9); border-radius: 8px; }
  .box.ph { border-style: dotted; opacity: 0.75; }
  .box span { position: absolute; top: -9px; left: -1px; background: var(--ochre); color: var(--paper-2);
    font: 600 9px var(--mono); padding: 2px 5px; border-radius: 3px; }
  .hud { position: absolute; top: 12px; left: 12px; font: 600 10px var(--mono); letter-spacing: 0.05em;
    text-transform: uppercase; color: var(--paper-2); background: rgba(63, 66, 52, 0.55); padding: 5px 9px; border-radius: 99px; }
  .rec { position: absolute; bottom: 12px; left: 12px; right: 12px; font: 600 12px var(--sans); color: #fff;
    background: rgba(154, 125, 79, 0.92); padding: 8px 12px; border-radius: 12px; }
  .controls { padding: 16px 0 6px; text-align: center; }
  .help { font-size: 13px; color: var(--muted); margin: 0 0 12px; min-height: 2.4em; }
  .row { display: flex; align-items: center; justify-content: space-between; }
  .toss, .spacer { width: 72px; }
  .toss { font: 600 13px var(--sans); color: var(--muted); background: var(--paper); border: 1px solid var(--line);
    padding: 10px 0; border-radius: 12px; }
  .shutter { width: 74px; height: 74px; border-radius: 99px; border: 4px solid var(--ochre); background: var(--paper-2);
    box-shadow: 0 8px 22px rgba(154, 125, 79, 0.3); }
  .shutter.live { background: var(--ochre); transform: scale(1.06); }
  .receipt { position: fixed; bottom: calc(20px + env(safe-area-inset-bottom)); left: 50%; transform: translateX(-50%);
    display: flex; align-items: center; gap: 14px; background: var(--dark); color: var(--paper-2);
    padding: 12px 16px; border-radius: 14px; font: 600 14px var(--sans); box-shadow: 0 10px 30px rgba(63, 66, 52, 0.35); }
  .receipt button { background: none; border: 1px solid rgba(246, 243, 232, 0.5); color: var(--paper-2);
    padding: 6px 12px; border-radius: 9px; font: 600 12px var(--sans); }
</style>
