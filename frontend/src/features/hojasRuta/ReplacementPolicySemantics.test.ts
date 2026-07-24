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

    expect(selector).toContain("<GlidingRadioGroup");
    expect(selector).toContain("value={replacementPolicy}");
    expect(selector).toContain("options={replacementPolicyOptions}");
    expect(selector).toContain("onValueChange={(nextPolicy) => patchConfig({ replacement_policy: nextPolicy })}");
    expect(source).not.toContain("selectReplacementPolicyFromKey");
  });
});
