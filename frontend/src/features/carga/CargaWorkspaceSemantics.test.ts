import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Carga workspace tab semantics", () => {
  it("links Preparar and Ver base to the active workspace panel", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "CargaPage.tsx"),
      "utf8",
    );
    const tabs = source.slice(
      source.indexOf("function CargaWorkspaceTabs"),
      source.indexOf("function CargaWorkspaceSidebar"),
    );

    expect(tabs).toContain('role="tablist"');
    expect(tabs).toContain('role="tab"');
    expect(tabs).toContain('id={cargaWorkspaceTabId("insumos")}');
    expect(tabs).toContain('id={cargaWorkspaceTabId("base")}');
    expect(tabs).toContain("aria-controls={CARGA_WORKSPACE_PANEL_ID}");
    expect(source.match(/id=\{CARGA_WORKSPACE_PANEL_ID\}/g)).toHaveLength(2);
    expect(source.match(/role="tabpanel"/g)).toHaveLength(2);
    expect(source.match(/aria-labelledby=\{cargaWorkspaceTabId\(activeCargaTab\)\}/g)).toHaveLength(2);
  });
});
