import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    include: [
      "client/src/**/*.test.ts",
      "client/src/**/*.test.tsx",
      "server/**/*.test.ts",
    ],
    exclude: [
      "**/node_modules/**",
      "**/.cache/**",
      "**/dist/**",
    ],
    environmentMatchGlobs: [
      ["client/**", "jsdom"],
      ["server/**", "node"],
    ],
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      reporter: ["text", "lcov"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
});
