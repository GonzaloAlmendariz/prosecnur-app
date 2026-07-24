import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Hojas de ruta sample mode semantics", () => {
  it("exposes sample-size modes as a keyboard-selectable radio group", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "HojasRutaPage.tsx"),
      "utf8",
    );
    const anchor = source.indexOf('aria-label="Modo de muestra"');
    const selector = source.slice(
      source.lastIndexOf("<GlidingRadioGroup", anchor),
      source.indexOf("</GlidingRadioGroup>", anchor),
    );

    expect(selector).toContain("<GlidingRadioGroup");
    expect(selector).toContain("value={mode}");
    expect(selector).toContain("options={sampleModes}");
    expect(selector).toContain("getOptionValue={(item) => item}");
    expect(selector).toContain("onValueChange={onModeChange}");
    expect(source).not.toContain("selectSampleModeFromKey");
    expect(selector).not.toContain('role="tablist"');
    expect(selector).not.toContain('role="tab"');
    expect(selector).not.toContain("aria-selected=");
  });
});
