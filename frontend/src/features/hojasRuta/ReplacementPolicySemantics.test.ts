import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

describe("Hojas replacement-policy semantics", () => {
  test("uses exclusive radio semantics with keyboard selection in Manzanas", () => {
    const source = fs.readFileSync(path.join(__dirname, "HojasRutaPage.tsx"), "utf8");
    const labelIndex = source.indexOf('aria-label="Ubicación del reemplazo de campo"');
    const selector = source.slice(
      source.lastIndexOf("<", labelIndex),
      source.indexOf('<div className="hojas-ruta-replacement-status">', labelIndex),
    );

    expect(selector).toContain("<GlidingTabList");
    expect(selector).toContain('role="radiogroup"');
    expect(selector).toContain('role="radio"');
    expect(selector).toContain("aria-checked={replacementPolicy === option.key}");
    expect(selector).toContain("data-gliding-key={option.key}");
    expect(selector).toContain("onKeyDown={(event) => selectReplacementPolicyFromKey");
    expect(source).toContain(
      "if (nextPolicy !== replacementPolicy) patchConfig({ replacement_policy: nextPolicy })",
    );
  });
});
