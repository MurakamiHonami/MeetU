import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig, defineProject } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      defineProject({
        test: {
          name: "unit",
          include: [
            "tests/domain.test.ts",
            "tests/domain-extended.test.ts",
            "tests/validation.test.ts",
          ],
          coverage: {
            provider: "v8",
            reporter: ["text", "lcov"],
            include: ["src/domain/**/*.ts", "src/interfaces/validation/**/*.ts"],
            thresholds: {
              lines: 70,
              functions: 65,
              branches: 55,
              statements: 70,
            },
          },
        },
      }),
      defineProject({
        plugins: [
          cloudflareTest({
            wrangler: { configPath: "./wrangler.json" },
          }),
        ],
        test: {
          name: "integration",
          include: ["tests/api.test.ts", "tests/security.test.ts"],
          pool: "forks",
        },
      }),
      defineProject({
        test: {
          name: "staging",
          include: ["tests/staging.integration.test.ts"],
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      }),
    ],
  },
});
