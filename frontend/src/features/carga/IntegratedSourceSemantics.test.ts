import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Integrated instruments source semantics", () => {
  it("exposes Manual and SurveyMonkey as a keyboard-operable radio group", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "IntegratedInstrumentsWizard.tsx"),
      "utf8",
    );
    const anchor = source.indexOf('aria-label="Fuente de instrumentos hermanos"');
    const selector = source.slice(
      source.lastIndexOf("<GlidingTabList", anchor),
      source.indexOf("</GlidingTabList>", anchor),
    );

    expect(selector).toContain('role="radiogroup"');
    expect(selector).toContain('mode="tabs"');
    expect(selector).toContain('role="radio"');
    expect(selector).toContain("aria-checked=");
    expect(selector).toContain("onKeyDown=");
    expect(selector).toContain("selectSourceMode(");
    expect(selector).not.toContain('role="tablist"');
    expect(selector).not.toContain('role="tab"');
    expect(selector).not.toContain("aria-selected=");
  });
});
