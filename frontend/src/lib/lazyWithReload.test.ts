import { describe, expect, test } from "vitest";
import { isDynamicImportLoadError } from "./lazyWithReload";

describe("isDynamicImportLoadError", () => {
  test("detects Vite dynamic import failures", () => {
    expect(
      isDynamicImportLoadError(
        new TypeError(
          "Failed to fetch dynamically imported module: http://127.0.0.1:8787/assets/DashboardPage-old.js",
        ),
      ),
    ).toBe(true);
  });

  test("detects common chunk load failures", () => {
    expect(isDynamicImportLoadError(new Error("Loading chunk 42 failed."))).toBe(true);
    expect(isDynamicImportLoadError(new Error("ChunkLoadError: loading CSS chunk failed"))).toBe(true);
  });

  test("ignores unrelated runtime errors", () => {
    expect(isDynamicImportLoadError(new Error("Cannot read properties of null"))).toBe(false);
  });
});
