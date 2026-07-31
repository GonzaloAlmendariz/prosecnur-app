import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("BaseDatosTab view semantics", () => {
  it("treats Códigos and Etiquetas as exclusive representations of the same content", () => {
    const source = fs.readFileSync(path.join(__dirname, "index.tsx"), "utf8");
    const selectorStart = source.indexOf(
      '<GlidingTabList\n            className="dash-source-segments"',
    );
    const selectorEnd = source.indexOf("</GlidingTabList>", selectorStart);
    const selector = source.slice(selectorStart, selectorEnd);

    expect(selectorStart).toBeGreaterThanOrEqual(0);
    expect(selectorEnd).toBeGreaterThan(selectorStart);
    expect(selector).toContain('mode="tabs"');
    expect(selector).toContain('role="radiogroup"');
    expect(selector.match(/role="radio"/g)).toHaveLength(2);
    expect(selector.match(/aria-checked=/g)).toHaveLength(2);
    expect(selector).toContain("onRovingKeyChange=");
    expect(selector).not.toContain('role="tab"');
    expect(selector).not.toContain("aria-selected=");
    expect(selector).not.toContain("aria-controls=");
    expect(source).not.toContain('role="tabpanel"');
    expect(source).not.toContain("BASE_DATA_VIEW_A11Y");
  });
});
