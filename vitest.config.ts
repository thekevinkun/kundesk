// Vitest configuration — jsdom environment for React component testing
// No tests written yet — infrastructure ready for Phase 9

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    // jsdom simulates browser environment for React component tests
    environment: "jsdom",

    // Auto-import testing utilities — no need to import in every test file
    globals: true,

    // Setup file runs before every test — imports jest-dom matchers
    setupFiles: ["./vitest.setup.ts"],

    // Only scan these paths for test files
    include: ["**/*.{test,spec}.{ts,tsx}"],

    // Exclude generated files
    exclude: ["node_modules", ".next"],
  },
  resolve: {
    // Mirror the @/ alias from tsconfig.json
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
