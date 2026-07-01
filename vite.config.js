import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// The Svelte SPA lives in web/ and builds to web/dist, which the hub serves.
// A single origin means the WebSocket and API share the app's host — no CORS,
// no cross-origin cookies, nothing to configure for the phone.
export default defineConfig({
  root: "web",
  plugins: [svelte()],
  build: { outDir: "dist", emptyOutDir: true },
  server: { host: true }, // dev: bind 0.0.0.0 so a phone on the LAN can reach Vite too
});
