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

    expect(selector).toContain("<GlidingTabList");
    expect(selector).toContain('role="radiogroup"');
    expect(selector).toContain('mode="tabs"');
    expect(selector).toContain('role="radio"');
    expect(selector).toContain("aria-checked={allocationMode === m}");
    expect(selector).toContain("data-gliding-key={m}");
    expect(selector).toContain("onKeyDown={(event) => selectAllocationModeFromKey");
    expect(source).toContain(
      "if (nextMode !== allocationMode) onSampleSizeChange({ allocation_mode: nextMode })",
    );
  });
});
