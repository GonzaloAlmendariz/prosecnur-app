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

    expect(selector).toContain("<GlidingRadioGroup");
    expect(selector).toContain("value={value}");
    expect(selector).toContain("options={methods}");
    expect(selector).toContain("getOptionValue={(method) => method.id}");
    expect(selector).toContain("onValueChange={onChange}");
    expect(selector).not.toContain("selectMethodFromKey");
    expect(selector).not.toContain("aria-pressed");
  });
});
