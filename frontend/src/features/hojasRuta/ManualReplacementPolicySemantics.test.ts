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

    expect(selector).toContain("<GlidingRadioGroup");
    expect(selector).toContain("value={manualReplacementPolicy}");
    expect(selector).toContain("options={replacementPolicyOptions}");
    expect(selector).toContain("onValueChange={setManualReplacementPolicy}");
    expect(source).not.toContain("selectManualReplacementPolicyFromKey");
  });
});
