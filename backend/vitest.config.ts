import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig, defineProject } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      defineProject({
        test: {
          name: "unit",
          include: ["tests/domain.test.ts", "tests/validation.test.ts"],
          coverage: {
            provider: "v8",
            reporter: ["text", "lcov"],
            include: ["src/domain/**/*.ts", "src/interfaces/validation/**/*.ts"],
            thresholds: {
              lines: 35,
              functions: 30,
              branches: 20,
              statements: 35,
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
    ],
  },
});
