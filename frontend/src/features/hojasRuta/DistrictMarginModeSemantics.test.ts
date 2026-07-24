import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

describe("Hojas district-margin mode semantics", () => {
  test("uses exclusive radio semantics with keyboard selection", () => {
    const source = fs.readFileSync(path.join(__dirname, "HojasRutaPage.tsx"), "utf8");
    const labelIndex = source.indexOf('aria-label="Uso del margen distrital"');
    const selector = source.slice(
      source.lastIndexOf("<", labelIndex),
      source.indexOf('className="hojas-ruta-sample-note"', labelIndex),
    );

    expect(selector).toContain("<GlidingRadioGroup");
    expect(selector).toContain("value={enforceFloor}");
    expect(selector).toContain("options={[true, false] as const}");
    expect(selector).toContain('getOptionKey={(option) => option ? "enforce" : "warn"}');
    expect(selector).toContain("onValueChange={(nextMode) => onSampleSizeChange({ enforce_district_floor: nextMode })}");
    expect(source).not.toContain("selectDistrictMarginModeFromKey");
  });
});
