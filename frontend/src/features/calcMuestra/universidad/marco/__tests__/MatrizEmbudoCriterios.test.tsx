import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CalcMuestraMatrizEmbudo } from "../../../../../api/calcMuestraMatrizEmbudo";
import { MatrizEmbudoCriterios } from "../MatrizEmbudoCriterios";

const matriz: CalcMuestraMatrizEmbudo = {
  schema: "calc_muestra_aulas_criterios_matriz_embudo_v1",
  owner: "calc_muestra_aulas_frame_v1.criterios_radiografia.matriz_embudo",
  source_schema: "calc_muestra_aulas_criterios_radiografia_v2",
  frame_hash: "frame-i18",
  momento: "marco_ejecutado",
  grain: "facultad_efectiva_x_criterio",
  unit: "curso_horario_unico",
  faculty_dimension: "curso_horario_efectiva",
  columns: [{ criterion_id: "c1", card_id: "sesion", label: "Tipo de sesión", status: "disponible", order: 0 }],
  rows: [
    {
      faculty_key: "derecho",
      faculty_label: "Derecho",
      row_kind: "faculty",
      n_ch_bruto: 20,
      n_ch_elegibles: 12,
      cells: [{
        criterion_id: "c1",
        status: "disponible",
        delta: {
          reference: "marco_ejecutado",
          action: "reemplazar_regla",
          reconstruccion_valida: true,
          delta_ch: -3,
          delta_matriculas: -72,
          delta_estudiantes_unicos: -60,
        },
      }],
    },
    {
      faculty_key: "__total__",
      faculty_label: "Total",
      row_kind: "total",
      n_ch_bruto: 40,
      n_ch_elegibles: 25,
      cells: [{
        criterion_id: "c1",
        status: "sin_senal",
        delta: {
          reference: "marco_ejecutado",
          action: "no_aplica",
          reconstruccion_valida: false,
          delta_ch: null,
          delta_matriculas: null,
          delta_estudiantes_unicos: null,
        },
      }],
    },
  ],
};

describe("MatrizEmbudoCriterios", () => {
  it("mantiene Total visible primero y rotula los impactos como marginales/no aditivos", () => {
    const html = renderToStaticMarkup(<MatrizEmbudoCriterios matriz={matriz} rawPresent />);
    expect(html).toContain("impactos marginales, no aditivos");
    expect(html.indexOf("Total")).toBeLessThan(html.indexOf("Derecho"));
    expect(html).toContain("-3 CH");
    expect(html).toContain("-72 matrículas");
    expect(html).toContain('data-qa-geometry-contract="intrinsic"');
  });

  it("distingue ausencia de payload y contrato inválido", () => {
    expect(renderToStaticMarkup(<MatrizEmbudoCriterios matriz={null} rawPresent={false} />))
      .toContain("Reconstruye el marco para publicar");
    expect(renderToStaticMarkup(<MatrizEmbudoCriterios matriz={null} rawPresent />))
      .toContain("llegó incompleta");
  });
});
