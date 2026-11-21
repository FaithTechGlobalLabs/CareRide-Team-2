import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "src/**/*.integration.test.ts",
      "integration/**/*.test.ts",
      "test/integration/**/*.test.ts",
    ],
    exclude: [...configDefaults.exclude, "dist/**"],
    // Database suites own independent containers and close them in afterAll.
    fileParallelism: true,
    environment: "node",
    hookTimeout: 150_000,
    testTimeout: 10_000,
  },
});
