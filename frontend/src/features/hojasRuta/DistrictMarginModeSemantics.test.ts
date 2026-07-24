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

    expect(selector).toContain("<GlidingTabList");
    expect(selector).toContain('role="radiogroup"');
    expect(selector).toContain('mode="tabs"');
    expect(selector.match(/role="radio"/g)).toHaveLength(2);
    expect(selector.match(/aria-checked=/g)).toHaveLength(2);
    expect(selector.match(/data-gliding-key=/g)).toHaveLength(2);
    expect(selector.match(/onKeyDown=/g)).toHaveLength(2);
    expect(source).toContain(
      "if (nextMode !== enforceFloor) onSampleSizeChange({ enforce_district_floor: nextMode })",
    );
  });
});
