import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    clearMocks: true,
    setupFiles: ["./tests/setup.ts"],
    exclude: ["dist/**", "node_modules/**", "**/node_modules/**"],
  },
});
