import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

describe("Hojas age-method semantics", () => {
  test("uses a two-option radio group without replacing an active cut preset", () => {
    const source = fs.readFileSync(path.join(__dirname, "HojasRutaPage.tsx"), "utf8");
    const labelIndex = source.indexOf('aria-label="Forma de definir rangos de edad"');
    const selector = source.slice(
      source.lastIndexOf("<", labelIndex),
      source.indexOf('{ageDraftMode === "manual" ?', labelIndex),
    );

    expect(selector).toContain("<GlidingRadioGroup");
    expect(selector).toContain("value={ageMethod}");
    expect(selector).toContain("options={ageMethodOptions}");
    expect(selector).toContain("onValueChange={selectAgeMethod}");
    expect(source).not.toContain("selectAgeMethodFromKey");
    expect(source).toContain(
      'const ageMethod = ageDraftMode === "manual" ? "manual" : "cuts"',
    );
    expect(source).toContain("if (nextMethod === ageMethod) return");
  });
});
