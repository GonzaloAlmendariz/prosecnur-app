import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("CalcMuestra section rail semantics", () => {
  it("exposes the workflow sections as pressed controls instead of orphan tabs", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "CalcMuestraPage.tsx"),
      "utf8",
    );
    const rail = source.slice(
      source.indexOf("function CalcMuestraSectionRail"),
      source.indexOf("function CalcMuestraContextSidebar"),
    );

    expect(rail).toContain('role="group"');
    expect(rail).toContain('mode="tabs"');
    expect(rail).toContain("aria-pressed={active}");
    expect(rail).not.toContain('role="tablist"');
    expect(rail).not.toContain('role="tab"');
    expect(rail).not.toContain("aria-selected={active}");
  });
});
