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
      source.indexOf("function chooseSourceSheet"),
    );

    expect(rail).toContain('role="group"');
    expect(rail).toContain('mode="tabs"');
    expect(rail).toContain("aria-pressed={active}");
    expect(rail).not.toContain('role="tablist"');
    expect(rail).not.toContain('role="tab"');
    expect(rail).not.toContain("aria-selected={active}");
  });

  it("uses the shared ContextTabRail for every desk, with no rail of its own (L16)", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "CalcMuestraPage.tsx"),
      "utf8",
    );
    const contextStart = source.indexOf("<ContextTabRail");
    const branch = source.slice(contextStart, source.indexOf('<main className="cmv2-main">', contextStart));

    expect(source).toContain('import { ContextTabRail } from "../../components/ContextTabRail"');
    expect(source).toContain('desk !== "sin_definir" && !sinRailLocal ? " pulso-context-tab-layout" : ""');
    expect(branch).toContain("items={contextItems}");
    expect(branch).toContain("onChange={selectContextTab}");
    expect(branch).not.toContain("cmv2-section-local-dot");
    expect(source).not.toContain("CalcMuestraContextSidebar");
  });

  it("keeps guided progress accessible in descriptions and labels panels from the active tab", () => {
    const pageSource = fs.readFileSync(
      path.join(__dirname, "CalcMuestraPage.tsx"),
      "utf8",
    );
    const deskSource = fs.readFileSync(
      path.join(__dirname, "universidad", "UniversidadDesk.tsx"),
      "utf8",
    );

    expect(pageSource).toContain('description: `${tab.detail} · ${guidedStatusLabel(tab.status)}`');
    expect(pageSource).not.toContain("disabled: tab.status");
    expect(deskSource).toContain("const activeContextTabId = universityContextTabId(selectedSection, activeContextTabKey)");
    expect(deskSource.match(/aria-labelledby=\{activeContextTabId\}/g)).toHaveLength(5);
  });
});
