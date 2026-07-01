import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    root: ".",
    include: ["web/src/**/*.test.js", "hub/**/*.test.js"],
    environment: "node",
  },
});
