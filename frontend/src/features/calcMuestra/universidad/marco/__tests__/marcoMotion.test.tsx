/**
 * Smoke SSR del glow-up de motion del marco: ganchos de animación por clase
 * (crecimiento de barras opt-in, índice de stagger del histograma, línea del
 * mínimo con trazo dibujable, reconciliación, stagger de hallazgos y micro-entrada del vacío).
 * La animación en sí vive en marco.css bajo prefers-reduced-motion.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CalcMuestraAulasState, CalcMuestraWorkspace } from "../../../../../api/client";
import { ClassroomBarPlot, ClassroomStackedCrossPlot } from "../marcoCharts";
import { MarcoAulasCapacidad, MarcoAulasHistograma } from "../marcoCards";
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

  it("las comparaciones de sexo usan escala porcentual y marcan la referencia del 50%", () => {
    const barras = renderToStaticMarkup(
      <ClassroomBarPlot
        rows={[{ label: "Hombre", value: 110 }, { label: "Mujer", value: 90 }]}
        ariaLabel="Sexo o género"
        total={200}
        colorBySex
      />,
    );
    expect(barras).toContain("is-share-comparison");
    expect(barras).toContain("Referencia 50%");
    expect(barras).toContain("width:55%");
    expect(barras).toContain("width:45%");
    expect(barras.match(/cmv2-share-reference-line/g)).toHaveLength(2);

    const apiladas = renderToStaticMarkup(
      <ClassroomStackedCrossPlot
        table={{
          columns: ["Hombre", "Mujer"],
          rows: [{ label: "Facultad", total: 200, values: { Hombre: 110, Mujer: 90 } }],
        }}
        ariaLabel="Sexo por facultad"
        sortByMaleSurplus
        showSegmentLabels
      />,
    );
    expect(apiladas).toContain("is-share-comparison");
    expect(apiladas).toContain("Referencia 50%");
    expect(apiladas.match(/cmv2-share-reference-line/g)).toHaveLength(1);
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
      <MarcoAulasHistograma
        frame={state.frame}
        workspace={{
          ...baseWorkspace,
          aulas_config: {
            grupos_tamano: [
              { id: "G1", label: "G1", min: 15, max: 20, descripcion: "aulas pequenas o especializadas" },
              { id: "G2", label: "G2", min: 21, max: 30, descripcion: "aulas medianas" },
              { id: "G3", label: "G3", min: 31, max: 40, descripcion: "aulas estandar" },
              { id: "G4", label: "G4", min: 41, max: null, descripcion: "aulas grandes o masivas" },
            ],
          },
        } as unknown as CalcMuestraWorkspace}
        minElegibles={15}
      />,
    );
    expect(html).toContain("--marco-histo-i:0");
    expect(html).toContain("--marco-histo-i:12");
    // El trazo de la línea vive en un <i> interior para dibujarse sin deformar la etiqueta.
    expect(html).toMatch(/cmv2-marco-histo-minline[^>]*>\s*<i><\/i>/);
    expect(html).toContain("cursos-horario pequeños o especializados");
    expect(html).toContain("cursos-horario grandes o masivos");
    expect(html).not.toContain("aulas pequeñas");
    // Sin hover no hay banda resaltada ni bins atenuados.
    expect(html).not.toContain("data-resalta");
    expect(html).not.toContain("data-atenuada");
  });

  it("la capacidad usa el ancho completo como una sola cuadrícula de cuatro lecturas", () => {
    const html = renderToStaticMarkup(
      <MarcoAulasCapacidad
        frame={{
          aula_frame: [
            { included: true, eligible_n: 18, docente: "A" },
            { included: true, eligible_n: 24, docente: "B" },
          ],
        } as unknown as CalcMuestraAulasState["frame"]}
        workspace={baseWorkspace}
      />,
    );
    expect(html).toContain("cmv2-dashboard-insights");
    expect(html).not.toContain("cmv2-dashboard-intelligence");
    expect(html).toContain("Cursos-horario válidos");
    expect(html).toContain("Cursos-horario pequeños");
  });

  it("Consistencia: hallazgos con stagger y vacío de una sola base con micro-entrada", () => {
    const dosBases = renderToStaticMarkup(
      <MarcoConsistenciaTab
        workspace={{ ...baseWorkspace, source_mode: "dos_bases" } as CalcMuestraWorkspace}
        aulasState={{
          frame: {
            aula_frame: [{ classroom_id: "CH-1" }],
            audit: [],
            warnings: [],
            relation_audit: { used: true, status: "revisar", match_rate_classrooms: 0.8, issues: [] },
          },
        } as unknown as CalcMuestraAulasState}
      />,
    );
    expect(dosBases).toContain("cmv2-frame-issue-list cmv2-uni-stagger");
    expect(dosBases).toContain("cmv2-marco-reconciliation");

    const unaBase = renderToStaticMarkup(
      <MarcoConsistenciaTab
        workspace={{ ...baseWorkspace, source_mode: "base_madre" } as CalcMuestraWorkspace}
        aulasState={{ frame: { audit: [], warnings: [] } } as unknown as CalcMuestraAulasState}
      />,
    );
    expect(unaBase).toContain("cmv2-marco-vacio");
  });
});
