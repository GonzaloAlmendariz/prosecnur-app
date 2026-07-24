import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

describe("Hojas allocation-mode semantics", () => {
  test("uses exclusive radio semantics with keyboard selection", () => {
    const source = fs.readFileSync(path.join(__dirname, "HojasRutaPage.tsx"), "utf8");
    const labelIndex = source.indexOf('aria-label="Modo de asignación"');
    const selector = source.slice(
      source.lastIndexOf("<", labelIndex),
      source.indexOf("{isCalculatorMode ?", labelIndex),
    );

    expect(selector).toContain("<GlidingRadioGroup");
    expect(selector).toContain("value={allocationMode}");
    expect(selector).toContain("options={allocationModes}");
    expect(selector).toContain("getOptionValue={(option) => option}");
    expect(selector).toContain("onValueChange={(nextMode) => onSampleSizeChange({ allocation_mode: nextMode })}");
    expect(source).not.toContain("selectAllocationModeFromKey");
  });
});
