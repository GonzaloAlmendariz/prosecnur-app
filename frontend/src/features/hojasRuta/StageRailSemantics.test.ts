import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Hojas de ruta stage rail semantics", () => {
  it("exposes workflow stages as current pressed buttons driven by the navigation model", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "HojasRutaPage.tsx"),
      "utf8",
    );
    const rail = source.slice(
      source.indexOf('<div className="hojas-ruta-stage-rail-wrap">'),
      source.indexOf('<div className="hojas-ruta-command-actions"'),
    );

    expect(rail).toContain("hojasRutaNavigation.sections.map((step)");
    expect(rail).toContain('role="group"');
    expect(rail).toContain('mode="tabs"');
    expect(rail).toContain("aria-pressed={active}");
    expect(rail).toContain('aria-current={active ? "step" : undefined}');
    expect(rail).toContain("selectStage(step.key)");
    expect(rail).toContain("{step.label}");
    expect(rail).not.toContain('as="nav"');
    expect(rail).not.toContain('role="tablist"');
    expect(rail).not.toContain('role="tab"');
    expect(rail).not.toContain("aria-selected=");
  });
});
