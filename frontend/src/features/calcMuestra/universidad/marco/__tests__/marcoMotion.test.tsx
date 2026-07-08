/**
 * Smoke SSR del glow-up de motion del marco: ganchos de animación por clase
 * (crecimiento de barras opt-in, índice de stagger del histograma, línea del
 * mínimo con trazo dibujable, stagger de hallazgos y micro-entrada del vacío).
 * La animación en sí vive en marco.css bajo prefers-reduced-motion.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CalcMuestraAulasState, CalcMuestraWorkspace } from "../../../../../api/client";
import { ClassroomBarPlot } from "../marcoCharts";
import { MarcoAulasHistograma } from "../marcoCards";
import { MarcoConsistenciaTab } from "../MarcoConsistenciaTab";

const baseWorkspace = {
  version: 2,
  frame_mode: "sin_definir",
  variable_mappings: [],
  escenarios: [],
} as unknown as CalcMuestraWorkspace;

describe("motion del marco", () => {
  it("ClassroomBarPlot solo crece al montar cuando growOnMount está activo", () => {
    const rows = [{ label: "FCI", value: 120 }, { label: "Derecho", value: 80 }];
    const conGrow = renderToStaticMarkup(
      <ClassroomBarPlot rows={rows} ariaLabel="por facultad" growOnMount />,
    );
    const sinGrow = renderToStaticMarkup(
      <ClassroomBarPlot rows={rows} ariaLabel="carreras" />,
    );
    expect(conGrow).toContain("cmv2-marco-grow");
    expect(sinGrow).not.toContain("cmv2-marco-grow");
  });

  it("el histograma expone índice de stagger por bin y línea del mínimo dibujable", () => {
    const state = {
      frame: {
        aula_frame: [
          { eligible_n: 8 },
          { eligible_n: 22 },
          { eligible_n: 47 },
        ],
      },
    } as unknown as CalcMuestraAulasState;
    const html = renderToStaticMarkup(
      <MarcoAulasHistograma frame={state.frame} workspace={baseWorkspace} minElegibles={15} />,
    );
    expect(html).toContain("--marco-histo-i:0");
    expect(html).toContain("--marco-histo-i:12");
    // El trazo de la línea vive en un <i> interior para dibujarse sin deformar la etiqueta.
    expect(html).toMatch(/cmv2-marco-histo-minline[^>]*>\s*<i><\/i>/);
    // Sin hover no hay banda resaltada ni bins atenuados.
    expect(html).not.toContain("data-resalta");
    expect(html).not.toContain("data-atenuada");
  });

  it("Consistencia: hallazgos con stagger y vacío de una sola base con micro-entrada", () => {
    const dosBases = renderToStaticMarkup(
      <MarcoConsistenciaTab
        workspace={{ ...baseWorkspace, source_mode: "dos_bases" } as CalcMuestraWorkspace}
        aulasState={{
          frame: {
            audit: [],
            warnings: [],
            relation_audit: { used: true, status: "revisar", match_rate_classrooms: 0.8, issues: [] },
          },
        } as unknown as CalcMuestraAulasState}
      />,
    );
    expect(dosBases).toContain("cmv2-frame-issue-list cmv2-uni-stagger");

    const unaBase = renderToStaticMarkup(
      <MarcoConsistenciaTab
        workspace={{ ...baseWorkspace, source_mode: "base_madre" } as CalcMuestraWorkspace}
        aulasState={{ frame: { audit: [], warnings: [] } } as unknown as CalcMuestraAulasState}
      />,
    );
    expect(unaBase).toContain("cmv2-marco-vacio");
  });
});
