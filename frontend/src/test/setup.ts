import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// globals: true を使っていないため、自動 cleanup は効かない。明示的に後片付けする。
afterEach(() => {
  cleanup();
});
