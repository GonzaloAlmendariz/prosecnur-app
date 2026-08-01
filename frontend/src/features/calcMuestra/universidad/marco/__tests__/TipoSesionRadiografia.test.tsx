import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type {
  CalcMuestraAulasCriteriosRadiografia,
  CalcMuestraAulasExploracionFacultad,
} from "../../../../../api/client";
import { TipoSesionRadiografia } from "../TipoSesionRadiografia";

const facultad: CalcMuestraAulasExploracionFacultad = {
  facultad: "PSICOLOGÍA",
  ch_total: 12,
  ch_elegibles: 9,
  elegibles_total: 245,
  est_aula_mediana: 25,
  est_aula_media: 27.5,
  por_tipo_sesion: [{
    tipo: "Teórico",
    ch: 12,
    ch_elegibles: 9,
    elegibles: 245,
    media_elegibles: 27.5,
    elegibles_min: 8,
    elegibles_q1: 18,
    mediana_elegibles: 25,
    elegibles_q3: 33,
    elegibles_max: 54,
  }],
  por_nivel: [],
  por_condicion: [],
  n_multi_facultad: 0,
  n_local_externo: 0,
  n_sin_condicion: 0,
  top_cursos: [],
};

const radiografia: CalcMuestraAulasCriteriosRadiografia = {
  schema: "calc_muestra_aulas_criterios_radiografia_v1",
  owner: "calc_muestra_aulas_frame_v1.aula_frame",
  frame_hash: "frame-abc-123456789",
  momento: "marco_ejecutado",
  grano: "session_type_x_facultad_efectiva",
  unidad: "curso_horario_unico",
  filas: [
    {
      criterio: "session_type",
      facultad_key: "psicologia",
      facultad_label: "PSICOLOGÍA",
      categoria_key: "teorico",
      categoria_label: "Teórico",
      n_ch_total: 12,
      n_ch_elegibles: 9,
      n_matriculas_elegibles: 245,
      distribucion_elegible: { n_ch_con_dato: 9, media: 27.5, p10: 12, p25: 18, p50: 25, p75: 33, p90: 46 },
      contraste_total: { n_ch_con_dato: 12, media: 30.2 },
      delta_marginal: {
        referencia: "marco_ejecutado",
        accion: "quitar_categoria",
        delta_ch: -9,
        delta_matriculas_elegibles: -245,
      },
    },
    {
      criterio: "session_type",
      facultad_key: "psicologia",
      facultad_label: "PSICOLOGÍA",
      categoria_key: "laboratorio",
      categoria_label: "Laboratorio",
      n_ch_total: 3,
      n_ch_elegibles: 0,
      n_matriculas_elegibles: null,
      distribucion_elegible: { n_ch_con_dato: 0, media: null, p10: null, p25: null, p50: null, p75: null, p90: null },
      contraste_total: { n_ch_con_dato: 0, media: null },
      delta_marginal: {
        referencia: "marco_ejecutado",
        accion: "agregar_categoria",
        delta_ch: 3,
        delta_matriculas_elegibles: 81,
      },
    },
  ],
};

describe("TipoSesionRadiografia — contrato F1 completo", () => {
  it("muestra procedencia, denominadores, cinco cuantiles, ambas medias y deltas firmados", () => {
    const html = renderToStaticMarkup(
      <TipoSesionRadiografia
        facultad={facultad}
        facultadKey="psicologia"
        radiografia={radiografia}
        contexto="ejecutado"
      />,
    );
    expect(html).toContain(
      'class="cmv2-tsr-grid" data-qa-geometry-group="calc-muestra/session-type-radiografia" data-qa-geometry-contract="intrinsic"',
    );
    expect(html).toContain("data-qa-geometry-member");
    expect(html).toContain("Marco ejecutado");
    expect(html).toContain("calc_muestra_aulas_frame_v1.aula_frame");
    expect(html).toContain("frame-abc");
    expect(html).toContain("Media elegible");
    expect(html).toContain("27.5");
    expect(html).toContain("9 CH con dato");
    expect(html).toContain("Media total · contraste");
    expect(html).toContain("30.2");
    expect(html).toContain("12 CH con dato");
    for (const cuantile of ["P10", "P25", "P50", "P75", "P90"]) expect(html).toContain(cuantile);
    expect(html).toContain("Matrículas elegibles");
    expect(html).toContain("no alumnado único");
    expect(html).toContain("Quitar categoría");
    expect(html).toContain("-9 CH");
    expect(html).toContain("-245 matrículas elegibles");
    expect(html).toContain("Agregar categoría");
    expect(html).toContain("+3 CH");
    expect(html).toContain("+81 matrículas elegibles");
    expect(html).toContain("—");
  });

  it("en contexto editable declara que el borrador entra al recalcular", () => {
    const html = renderToStaticMarkup(
      <TipoSesionRadiografia
        facultad={facultad}
        facultadKey="psicologia"
        radiografia={radiografia}
        contexto="editable"
      />,
    );
    expect(html).toContain("Exploración previa · último marco ejecutado");
    expect(html).toContain("El borrador entra al recalcular");
  });

  it("sin contrato conserva el resumen legacy y no afirma que sea una radiografía F1 completa", () => {
    const html = renderToStaticMarkup(
      <TipoSesionRadiografia facultad={facultad} facultadKey="psicologia" radiografia={null} contexto="ejecutado" />,
    );
    expect(html).toContain("Distribución de PSICOLOGÍA por tipo de sesión");
    expect(html).toContain("Resumen legacy");
    expect(html).not.toContain("Radiografía F1 completa");
    expect(html).not.toContain("Media total · contraste");
  });
});
