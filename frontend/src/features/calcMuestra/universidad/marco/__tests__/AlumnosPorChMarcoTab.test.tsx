import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { CalcMuestraAulasState, CalcMuestraWorkspace } from "../../../../../api/client";
import { AlumnosPorChMarcoTab } from "../AlumnosPorChMarcoTab";

const workspace = {
  version: 2,
  frame_mode: "opinion_universitaria",
  aulas_config: {},
} as unknown as CalcMuestraWorkspace;

function state(): CalcMuestraAulasState {
  return {
    frame: {
      frame_hash: "frame-i18",
      alumnos_por_ch: {
        schema: "calc_muestra_alumnos_por_ch_v1",
        owner: "calc_muestra_aulas_frame_v1.aula_frame",
        frame_hash: "frame-i18",
        referencia: "marco_ejecutado",
        grano: "facultad_efectiva",
        unidad: "curso_horario_unico",
        metrica: "eligible_n",
        filas: [
          {
            faculty_key: "derecho",
            faculty_label: "Derecho",
            row_kind: "faculty",
            elegible: { n_ch: 4, n_ch_con_dato: 4, n_matriculas_elegibles: 80, distribution: { media: 20, p25: 15, p50: 18 } },
            contraste_total: { n_ch: 5, n_ch_con_dato: 5, n_matriculas_elegibles: 110, distribution: { media: 22, p25: 16, p50: 20 } },
          },
          {
            faculty_key: "__total__",
            faculty_label: "Total",
            row_kind: "total",
            elegible: { n_ch: 4, n_ch_con_dato: 4, n_matriculas_elegibles: 80, distribution: { media: 20, p25: 15, p50: 18 } },
            contraste_total: { n_ch: 5, n_ch_con_dato: 5, n_matriculas_elegibles: 110, distribution: { media: 22, p25: 16, p50: 20 } },
          },
        ],
      },
      aula_frame: [],
      audit: [],
      warnings: [],
    },
  } as unknown as CalcMuestraAulasState;
}

describe("AlumnosPorChMarcoTab", () => {
  it("muestra elegible primario, contraste total, recomendación P25 y confirmación", () => {
    const html = renderToStaticMarkup(
      <AlumnosPorChMarcoTab workspace={workspace} aulasState={state()} onConfirmDecision={vi.fn()} />,
    );
    // S2/S4 (F6): el contraste y la jerarquía elegible/total ya no se explican
    // en prosa — se rotulan en la propia tabla y se ven en la tira comparable.
    expect(html).toContain("Distribución del marco elegible");
    expect(html).toContain("Todos los CH");
    expect(html).toContain("Recomendado");
    expect(html).toContain("Confirmar decisión");
    expect(html).toContain('data-qa-geometry-contract="intrinsic"');
  });

  it("T7: una decisión guardada con método vacío no bloquea la confirmación", () => {
    // Trampa medida: `estadistico_default: ""` no es undefined, así que el
    // `?? "p25"` no caía al recomendado; sin método, ninguna facultad resolvía
    // valor y el botón que repara el estado quedaba deshabilitado para siempre.
    const heredado: CalcMuestraWorkspace = {
      ...workspace,
      aulas_config: {
        ...workspace.aulas_config,
        alumnos_por_ch_decision: {
          schema: "",
          frame_hash: "",
          denominador: "",
          estadistico_default: "",
          por_facultad: {},
          confirmado_at: "",
        },
      },
    } as unknown as CalcMuestraWorkspace;

    const html = renderToStaticMarkup(
      <AlumnosPorChMarcoTab workspace={heredado} aulasState={state()} onConfirmDecision={vi.fn()} />,
    );
    // El botón de confirmar no puede quedar bloqueado por el estado heredado.
    const confirmar = html.slice(html.indexOf("Confirmar decisión") - 400, html.indexOf("Confirmar decisión"));
    expect(confirmar).not.toContain("disabled");
    // Y si algún día vuelve a bloquearse, la causa se nombra.
    expect(html).not.toContain("cmv2-alumnos-ch-bloqueo");
  });

  it("S2/S4: la distribución se compara sobre una escala común con el Total de referencia", () => {
    const html = renderToStaticMarkup(
      <AlumnosPorChMarcoTab workspace={workspace} aulasState={state()} onConfirmDecision={vi.fn()} />,
    );
    // La escala se declara una sola vez, no por fila.
    expect((html.match(/Escala compartida/g) ?? [])).toHaveLength(1);
    // Cada fila dibuja sus tres marcas y el Total como referencia.
    expect(html).toContain('data-mark="p25"');
    expect(html).toContain('data-mark="p50"');
    expect(html).toContain('data-mark="media"');
    expect(html).toContain('data-mark="referencia"');
    // Comparar no cuesta precisión: las cifras siguen literales.
    expect(html).toContain("P25");
  });

  it("no aplica fallback cuando falta o deriva el snapshot", () => {
    const invalid = state();
    invalid.frame!.alumnos_por_ch = { ...invalid.frame!.alumnos_por_ch!, frame_hash: "viejo" };
    const html = renderToStaticMarkup(
      <AlumnosPorChMarcoTab workspace={workspace} aulasState={invalid} onConfirmDecision={vi.fn()} />,
    );
    expect(html).toContain("no se aplicará ningún fallback en React");
    expect(html).not.toContain("Confirmar decisión");
  });

  it("no permite reconfirmar una firma idéntica", () => {
    const vigente = {
      ...workspace,
      aulas_config: {
        alumnos_por_ch_decision: {
          schema: "calc_muestra_alumnos_por_ch_decision_v1",
          frame_hash: "frame-i18",
          denominador: "elegible",
          estadistico_default: "p25",
          por_facultad: {},
          confirmado_at: "2026-08-02T05:00:00Z",
        },
      },
    } as CalcMuestraWorkspace;
    const html = renderToStaticMarkup(
      <AlumnosPorChMarcoTab workspace={vigente} aulasState={state()} onConfirmDecision={vi.fn()} />,
    );
    expect(html).toContain("Decisión vigente");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[\s\S]*Confirmar decisión<\/button>/);
  });
});
