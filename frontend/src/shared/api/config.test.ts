import { describe, expect, it } from "vitest";
import { API_BASE } from "./config";

describe("API config", () => {
  it("exports API_BASE as a string", () => {
    expect(typeof API_BASE).toBe("string");
  });
});
