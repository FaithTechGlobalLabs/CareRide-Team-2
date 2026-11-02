import { configDefaults, defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: [
      "src/**/*.integration.test.ts",
      "integration/**/*.test.ts",
      "test/integration/**/*.test.ts",
    ],
    exclude: [...configDefaults.exclude, "dist/**"],
    // One migrated database is shared by the files; tests isolate writes in transactions.
    fileParallelism: false,
    globalSetup: ["./test/integration/global-setup.ts"],
    environment: "node",
    hookTimeout: 30_000,
    testTimeout: 10_000,
  },
})
