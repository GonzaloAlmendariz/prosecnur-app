import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Hojas de ruta stage rail semantics", () => {
  it("exposes workflow stages as current pressed buttons with roving focus", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "HojasRutaPage.tsx"),
      "utf8",
    );
    const rail = source.slice(
      source.indexOf("function HojasRutaStageRail("),
      source.indexOf("function PhaseHeaderControl("),
    );

    expect(rail).toContain('role="group"');
    expect(rail).toContain('mode="tabs"');
    expect(rail).toContain("aria-pressed={active}");
    expect(rail).toContain('aria-current={active ? "step" : undefined}');
    expect(rail).toContain("onChange(step.key)");
    expect(rail).not.toContain('as="nav"');
    expect(rail).not.toContain('role="tablist"');
    expect(rail).not.toContain('role="tab"');
    expect(rail).not.toContain("aria-selected=");
  });
});
