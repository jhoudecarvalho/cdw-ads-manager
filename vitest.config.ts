import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next", "src/generated/**", "tests/e2e/**"],
    setupFiles: ["./tests/setup.ts"],
    // Testes de isolamento RLS hitam Neon — single thread evita pisar uns
    // nos outros via set_config compartilhado entre transações concorrentes.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
