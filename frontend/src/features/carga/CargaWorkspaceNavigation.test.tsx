import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CargaWorkspaceNavigation } from "./CargaWorkspaceNavigation";
import type { CargaWorkspaceContext } from "./CargaWorkspaceModel";

const ATTENTION_CONTEXT: CargaWorkspaceContext = {
  hasInstrument: true,
  hasData: true,
  hasBase: true,
  hasReviewIssues: true,
  isMultiBase: true,
  baseCount: 3,
};

describe("CargaWorkspaceNavigation", () => {
  it("delegates an icon-only tablist to ContextTabRail without widening the shared rail", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "CargaWorkspaceNavigation.tsx"),
      "utf8",
    );
    const css = fs.readFileSync(
      path.join(__dirname, "CargaWorkspaceNavigation.css"),
      "utf8",
    );

    expect(source).toContain("ContextTabRail");
    expect(source).toContain('from "../../components/ContextTabRail"');
    expect(source).toContain("<ContextTabRail");
    expect(source).not.toMatch(/<ContextTabRail[\s\S]*?\bshowLabels\b/);
    expect(css).not.toContain("--pulso-rail-width");
    expect(source).not.toContain('role="tablist"');
    expect(source).not.toContain('role="tab"');
  });

  it("renders all five reachable tabs with a shared panel and active-tab ARIA", () => {
    const html = renderToStaticMarkup(
      <CargaWorkspaceNavigation
        active="revision"
        context={ATTENTION_CONTEXT}
        panelId="carga-workspace-panel"
        onChange={vi.fn()}
      />,
    );

    expect(html.match(/role="tab"/g)).toHaveLength(5);
    expect(html.match(/aria-controls="carga-workspace-panel"/g)).toHaveLength(5);
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(html).not.toContain('aria-disabled="true"');
    expect(html).not.toContain('disabled=""');
    expect(html).toContain('aria-label="Pestañas de carga"');
    expect(html).toMatch(/aria-label="Plan\.[^"]+"/);
    expect(html).toMatch(/aria-label="Datos\.[^"]+"/);
    expect(html).toMatch(/aria-label="Revisión\.[^"]*(Atención|Requiere atención)/);
  });

  it("keeps pending and ready state cues in the accessible tab descriptions", () => {
    const emptyHtml = renderToStaticMarkup(
      <CargaWorkspaceNavigation
        active="plan"
        context={{
          hasInstrument: false,
          hasData: false,
          hasBase: false,
          hasReviewIssues: false,
          isMultiBase: false,
          baseCount: 0,
        }}
        onChange={vi.fn()}
      />,
    );
    const readyHtml = renderToStaticMarkup(
      <CargaWorkspaceNavigation
        active="datos"
        context={{ ...ATTENTION_CONTEXT, hasReviewIssues: false }}
        onChange={vi.fn()}
      />,
    );

    expect(emptyHtml).toMatch(/aria-label="Fuentes\.[^"]*Pendiente/);
    expect(readyHtml).toMatch(/aria-label="Datos\.[^"]*List[oa]/);
  });
});
