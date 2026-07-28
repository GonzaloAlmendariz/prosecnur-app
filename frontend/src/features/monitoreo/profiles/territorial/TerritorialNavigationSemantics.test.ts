import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(__dirname, "TerritorialMonitoreoPage.tsx"),
  "utf8",
);

describe("Territorial local navigation semantics", () => {
  it("uses the canonical contextual tab rail without the legacy workbench rail", () => {
    expect(source).toContain('import { ContextTabRail } from "../../../../components/ContextTabRail"');
    expect(source).toContain("<ContextTabRail");
    expect(source).not.toContain("MonitoreoWorkbenchRail");
    // MonitoreoWorkbenchChrome ya emite la clase canónica; repetirla desde la
    // página territorial mezclaba responsabilidades y hacía más frágil el layout.
    expect(source).not.toContain('className="pulso-context-tab-layout"');
  });

  it("keeps local tabs addressable and synchronized with the inspector event", () => {
    expect(source).toContain("useMonitoreoDireccion(seccionActiva, pestanaActiva, \"territorial\"");
    expect(source).toContain('window.addEventListener("prosecnur:monitoreo-local-tab-active"');
    expect(source).toContain("changeLocalTab(key)");
    expect(source).toContain("panelId={contextPanelId}");
    expect(source).toContain("footer={(");
    expect(source).toContain("<MonitoreoRailLastUpdate");
    expect(source).toContain('value={state?.synced_at ?? ""}');
    expect(source).toContain("contentId={contextPanelId}");
    expect(source).toContain('contentRole="tabpanel"');
    expect(source).toContain("contentAriaLabelledBy={contextTabId(pestanaActiva)}");
  });

  it("preserves the Piloto/Campo control in the workbench head, outside the rail", () => {
    const head = source.slice(
      source.indexOf("const TerritorialWorkbenchHead"),
      source.indexOf("function StatTile"),
    );
    const rail = source.slice(
      source.indexOf("<ContextTabRail"),
      source.indexOf("head={("),
    );

    expect(head).toContain('role="group" aria-label="Piloto o campo"');
    expect(head).toContain("aria-pressed={phase === item.key}");
    expect(head).not.toContain('role="tab"');
    expect(head).toContain("onPhaseChange(item.key)");
    expect(rail).not.toContain("phase");
    expect(rail).not.toContain("status");
    expect(rail).not.toContain("summary");
  });
});
