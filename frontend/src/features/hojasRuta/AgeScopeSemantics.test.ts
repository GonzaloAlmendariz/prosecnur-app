import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

describe("Hojas age-scope semantics", () => {
  test("uses exclusive radio semantics with keyboard selection", () => {
    const source = fs.readFileSync(path.join(__dirname, "HojasRutaPage.tsx"), "utf8");
    const labelIndex = source.indexOf('aria-label="Base para cortes automaticos"');
    const selector = source.slice(
      source.lastIndexOf("<", labelIndex),
      source.indexOf('<div className="hojas-ruta-age-preset-row"', labelIndex),
    );

    expect(selector).toContain("<GlidingTabList");
    expect(selector).toContain('role="radiogroup"');
    expect(selector).toContain('role="radio"');
    expect(selector).toContain("aria-checked={ageDraftScope === scope}");
    expect(selector).toContain("data-gliding-key={scope}");
    expect(selector).toContain("onKeyDown={(event) => selectAgeScopeFromKey");
    expect(source).toContain(
      "if (nextScope !== ageDraftScope) setAgeRangeScope(nextScope)",
    );
  });
});
