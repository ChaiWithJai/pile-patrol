<script>
  import { onMount, onDestroy } from "svelte";
  import { hub, sendCapture } from "../lib/hub.svelte.js";
  import { startCamera, grabFrame, makeId } from "../lib/camera.js";

  let video;
  let source = $state("");
  let fellBack = $state("");
  let flash = $state(false);

  const params = new URLSearchParams(location.search);
  const synthetic = params.get("synthetic") === "1";

  onMount(async () => {
    const res = await startCamera(video, { synthetic });
    source = res.source;
    fellBack = res.fellBackBecause || "";
  });

  function capture() {
    const frame = grabFrame(video);
    sendCapture({ id: makeId(), dataUrl: frame.dataUrl, w: frame.w, h: frame.h, capturedAt: new Date().toISOString() });
    flash = true;
    setTimeout(() => (flash = false), 160);
  }
</script>

<div class="phone">
  <div class="bar">
    <span class="kicker">Pile Patrol · capture</span>
    <span class="dot" class:on={hub.presence.desktop}></span>
  </div>

  <div class="view">
    <!-- svelte-ignore a11y_media_has_caption -->
    <video bind:this={video} autoplay playsinline muted></video>
    <div class="reticle"></div>
    {#if flash}<div class="flash"></div>{/if}
    <div class="hud">
      {#if source === "synthetic"}synthetic pile{:else}live camera{/if}
      {#if fellBack}· camera {fellBack}{/if}
    </div>
    <div class="count">{hub.captureCount} sent</div>
  </div>

  <div class="controls">
    <p class="help">
      {#if hub.presence.desktop}Point at one item and tap. It lands on your desktop.
      {:else}Waiting for the desktop… keep this open.{/if}
    </p>
    <button class="shutter" onclick={capture} aria-label="capture item"></button>
  </div>
</div>

<style>
  .phone {
    max-width: 480px;
    margin: 0 auto;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    padding: calc(10px + env(safe-area-inset-top)) 14px calc(14px + env(safe-area-inset-bottom));
  }
  .bar { display: flex; align-items: center; justify-content: space-between; padding: 6px 4px 12px; }
  .dot { width: 9px; height: 9px; border-radius: 99px; background: var(--line); }
  .dot.on { background: var(--good); box-shadow: 0 0 0 4px rgba(143, 174, 122, 0.25); }
  .view {
    position: relative;
    flex: 1;
    border-radius: 24px;
    overflow: hidden;
    background: #000;
    border: 1px solid var(--line);
    box-shadow: inset 0 0 40px rgba(63, 66, 52, 0.2);
  }
  video { width: 100%; height: 100%; object-fit: cover; display: block; }
  .reticle {
    position: absolute; inset: 18% 14%;
    border: 1.5px dashed rgba(246, 243, 232, 0.9);
    border-radius: 14px; pointer-events: none;
  }
  .flash { position: absolute; inset: 0; background: var(--paper-2); animation: fade 0.16s ease; }
  @keyframes fade { from { opacity: 0.85; } to { opacity: 0; } }
  .hud {
    position: absolute; top: 12px; left: 12px;
    font: 600 10px var(--mono); letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--paper-2); background: rgba(63, 66, 52, 0.55);
    padding: 5px 9px; border-radius: 99px;
  }
  .count {
    position: absolute; top: 12px; right: 12px;
    font: 600 11px var(--sans); color: var(--paper-2);
    background: rgba(154, 125, 79, 0.9); padding: 5px 10px; border-radius: 99px;
  }
  .controls { padding: 18px 0 6px; text-align: center; }
  .help { font-size: 13px; color: var(--muted); margin: 0 0 14px; min-height: 2.4em; }
  .shutter {
    width: 74px; height: 74px; border-radius: 99px;
    border: 4px solid var(--ochre); background: var(--paper-2);
    box-shadow: 0 8px 22px rgba(154, 125, 79, 0.3);
  }
  .shutter:active { transform: scale(0.94); }
</style>
