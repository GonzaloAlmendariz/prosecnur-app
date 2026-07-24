import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

describe("Hojas manual replacement-policy semantics", () => {
  test("uses exclusive radio semantics with keyboard selection in Entrega", () => {
    const source = fs.readFileSync(path.join(__dirname, "HojasRutaPage.tsx"), "utf8");
    const labelIndex = source.indexOf('aria-label="Ubicación del reemplazo puntual"');
    const selector = source.slice(
      source.lastIndexOf("<", labelIndex),
      source.indexOf("{manualReplacementSelectedIds.length", labelIndex),
    );

    expect(selector).toContain("<GlidingTabList");
    expect(selector).toContain('role="radiogroup"');
    expect(selector).toContain('role="radio"');
    expect(selector).toContain("aria-checked={manualReplacementPolicy === option.key}");
    expect(selector).toContain("data-gliding-key={option.key}");
    expect(selector).toContain("onKeyDown={(event) => selectManualReplacementPolicyFromKey");
    expect(source).toContain(
      "if (nextPolicy !== manualReplacementPolicy) setManualReplacementPolicy(nextPolicy)",
    );
  });
});
