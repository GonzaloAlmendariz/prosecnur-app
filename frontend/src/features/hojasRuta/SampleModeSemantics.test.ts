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
      source.lastIndexOf("<GlidingTabList", anchor),
      source.indexOf("</GlidingTabList>", anchor),
    );

    expect(selector).toContain('role="radiogroup"');
    expect(selector).toContain('mode="tabs"');
    expect(selector).toContain('role="radio"');
    expect(selector).toContain("aria-checked={mode === item}");
    expect(selector).toContain("onKeyDown=");
    expect(selector).toContain("selectSampleModeFromKey(");
    expect(source).toContain("if (nextMode !== mode) onModeChange(nextMode)");
    expect(selector).not.toContain('role="tablist"');
    expect(selector).not.toContain('role="tab"');
    expect(selector).not.toContain("aria-selected=");
  });
});
