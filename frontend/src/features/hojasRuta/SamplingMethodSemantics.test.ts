import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

describe("Hojas sampling-method selector semantics", () => {
  test("uses exclusive radio semantics with arrow-key selection", () => {
    const source = fs.readFileSync(path.join(__dirname, "HojasRutaPage.tsx"), "utf8");
    const selector = source.slice(
      source.indexOf("function SamplingMethodExplainer("),
      source.indexOf("type MatrixAgeValues"),
    );

    expect(selector).toContain("<GlidingTabList");
    expect(selector).toContain('role="radiogroup"');
    expect(selector).toContain('mode="tabs"');
    expect(selector).toContain('role="radio"');
    expect(selector).toContain("aria-checked={active}");
    expect(selector).toContain("data-gliding-key={method.id}");
    expect(selector).toContain("onKeyDown={(event) => selectMethodFromKey");
    expect(selector).toContain("if (nextMethod !== value) onChange(nextMethod)");
    expect(selector).not.toContain("aria-pressed");
  });
});
