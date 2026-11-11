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

  it("renders the five tabs without Equivalencias with a shared panel and active-tab ARIA", () => {
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
    expect(html).toMatch(/aria-label="Bases\.[^"]+"/);
    expect(html).toMatch(/aria-label="Respuestas\.[^"]+"/);
    // ADR 0142: el orden del catálogo y el grupo Consulta antes de Formulario.
    expect([...html.matchAll(/id="carga-workspace-tab-([a-z]+)"/g)].map((m) => m[1])).toEqual([
      "bases", "revision", "variables", "formulario", "respuestas",
    ]);
    expect(html).toMatch(/data-rail-grupo="Consulta"><\/span><button id="carga-workspace-tab-formulario"/);
    // Variables no afirma estado que no conoce.
    expect(html).toContain('aria-label="Variables. Columnas fuera del formulario y variables calculadas"');
    expect(html).toMatch(/aria-label="Revisión\.[^"]*(Atención|Requiere atención)/);
  });

  it("keeps pending and ready state cues in the accessible tab descriptions", () => {
    const emptyHtml = renderToStaticMarkup(
      <CargaWorkspaceNavigation
        active="bases"
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
        active="respuestas"
        context={{ ...ATTENTION_CONTEXT, hasReviewIssues: false }}
        onChange={vi.fn()}
      />,
    );

    expect(emptyHtml).toMatch(/aria-label="Bases\.[^"]*Pendiente/);
    expect(readyHtml).toMatch(/aria-label="Respuestas\.[^"]*List[oa]/);
  });
});
