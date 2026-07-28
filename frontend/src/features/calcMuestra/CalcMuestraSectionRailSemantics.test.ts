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

  it("uses ContextTabRail only for the university courses-schedule desk", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "CalcMuestraPage.tsx"),
      "utf8",
    );
    const contextStart = source.indexOf("<ContextTabRail");
    const contextEnd = source.indexOf(') : desk !== "sin_definir"', contextStart);
    const universityBranch = source.slice(contextStart, contextEnd);

    expect(source).toContain('import { ContextTabRail } from "../../components/ContextTabRail"');
    expect(source).toContain('desk === "opinion_universitaria" ? (');
    expect(source).toContain('desk === "opinion_universitaria" ? " pulso-context-tab-layout" : ""');
    expect(universityBranch).toContain("items={universityContextItems}");
    expect(universityBranch).toContain("onChange={selectUniversityContextTab}");
    expect(universityBranch).not.toContain("cmv2-section-local-dot");
    expect(universityBranch).not.toContain("cmv2-section-local-flag");
    expect(source.slice(contextEnd, source.indexOf('<main className="cmv2-main">', contextEnd))).toContain("<CalcMuestraContextSidebar");
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
