import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    root: ".",
    include: ["web/src/**/*.test.js", "hub/**/*.test.js"],
    environment: "node",
    // node:sqlite is a Node built-in; keep Vite from trying to bundle/resolve it.
    server: { deps: { external: ["node:sqlite", /node:/] } },
  },
  ssr: { external: ["node:sqlite"] },
  optimizeDeps: { exclude: ["node:sqlite"] },
});
