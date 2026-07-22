import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    // 只运行 src 目录中的 Unit Test，不运行 e2e/*.spec.mjs
    include: ["src/**/*.test.{ts,tsx}"],

    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],

    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/app/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/test/**",
        "src/app/vite-env.d.ts",
        "src/app/data/seeds.ts",
      ],
    },
  },
});
