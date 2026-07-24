import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Hojas de ruta phase header semantics", () => {
  it("exposes Pilot and Field as pressed actions with non-activating roving focus", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "HojasRutaPage.tsx"),
      "utf8",
    );
    const control = source.slice(
      source.indexOf("function PhaseHeaderControl("),
      source.indexOf("function InlineHelp("),
    );

    expect(control).toContain('role="group"');
    expect(control).toContain('mode="tabs"');
    expect(control).toContain("aria-pressed={activePhase ===");
    expect(control).toContain('onPhaseChange("pilot")');
    expect(control).toContain('onPhaseChange("field")');
    expect(control).not.toContain('role="tablist"');
    expect(control).not.toContain('role="tab"');
    expect(control).not.toContain("aria-selected=");
    expect(control).not.toContain("onKeyDown=");
  });
});
