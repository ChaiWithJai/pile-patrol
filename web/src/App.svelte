<script>
  import { onMount } from "svelte";
  import { hub, connect } from "./lib/hub.svelte.js";
  import Desktop from "./components/Desktop.svelte";
  import Phone from "./components/Phone.svelte";

  // Role is addressable: ?join=<token> means you're the phone joining a room;
  // otherwise you're the desktop host. ?role= forces it (handy for a same-Mac demo).
  const params = new URLSearchParams(location.search);
  const joinToken = params.get("join");
  const role = params.get("role") || (joinToken ? "phone" : "desktop");

  onMount(() => connect(role, joinToken));
</script>

{#if role === "phone"}
  <Phone />
{:else}
  <Desktop />
{/if}

{#if hub.error}
  <div class="toast">{hub.error}</div>
{/if}

<style>
  .toast {
    position: fixed;
    bottom: calc(16px + env(safe-area-inset-bottom));
    left: 50%;
    transform: translateX(-50%);
    background: var(--dark);
    color: var(--paper-2);
    padding: 10px 16px;
    border-radius: 12px;
    font-size: 13px;
    box-shadow: 0 10px 30px rgba(63, 66, 52, 0.3);
    z-index: 50;
    max-width: 90vw;
  }
</style>
