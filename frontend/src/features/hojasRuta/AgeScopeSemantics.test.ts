import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

describe("Hojas age-scope semantics", () => {
  test("uses exclusive radio semantics with keyboard selection", () => {
    const source = fs.readFileSync(path.join(__dirname, "HojasRutaPage.tsx"), "utf8");
    const labelIndex = source.indexOf('aria-label="Base para cortes automáticos"');
    const selector = source.slice(
      source.lastIndexOf("<", labelIndex),
      source.indexOf('<div className="hojas-ruta-age-preset-row"', labelIndex),
    );

    expect(selector).toContain("<GlidingRadioGroup");
    expect(selector).toContain("value={ageDraftScope}");
    expect(selector).toContain("options={ageScopeOptions}");
    expect(selector).toContain("onValueChange={setAgeDraftScope}");
    expect(source).not.toContain("selectAgeScopeFromKey");
  });
});
