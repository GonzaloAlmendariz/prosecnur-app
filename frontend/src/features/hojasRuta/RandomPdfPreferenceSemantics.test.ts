import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

describe("Hojas random PDF preference semantics", () => {
  test("uses exclusive radio semantics with keyboard selection", () => {
    const source = fs.readFileSync(path.join(__dirname, "HojasRutaPage.tsx"), "utf8");
    const labelIndex = source.indexOf('aria-label="Preferencia de PDF aleatorio"');
    const selector = source.slice(
      source.lastIndexOf("<", labelIndex),
      source.indexOf('<button\n                        type="button"', labelIndex),
    );

    expect(selector).toContain("<GlidingRadioGroup");
    expect(selector).toContain("value={randomPreference}");
    expect(selector).toContain("options={randomPreferenceOptions}");
    expect(selector).toContain("onValueChange={setRandomPreference}");
    expect(source).not.toContain("selectRandomPreferenceFromKey");
  });
});
