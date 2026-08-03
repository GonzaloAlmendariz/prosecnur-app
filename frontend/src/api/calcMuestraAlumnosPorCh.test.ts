import { describe, expect, it } from "vitest";

import {
  alumnosPorChValue,
  normalizeCalcMuestraAlumnosPorCh,
  normalizeCalcMuestraAlumnosPorChDecision,
} from "./calcMuestraAlumnosPorCh";

function snapshot(nCh = 8) {
  return {
    n_ch: nCh,
    n_ch_con_dato: nCh,
    n_matriculas_elegibles: 180,
    distribution: { media: 22.5, p25: 17, p50: 21 },
  };
}

function fixture(): Record<string, unknown> {
  return {
    schema: "calc_muestra_alumnos_por_ch_v1",
    owner: "calc_muestra_aulas_frame_v1.aula_frame",
    frame_hash: "frame-i18",
    referencia: "marco_ejecutado",
    grano: "facultad_efectiva",
    unidad: "curso_horario_unico",
    metrica: "eligible_n",
    filas: [
      {
        faculty_key: "fac-derecho",
        faculty_label: "Derecho",
        row_kind: "faculty",
        elegible: snapshot(),
        contraste_total: { ...snapshot(10), n_matriculas_elegibles: 240 },
      },
      {
        faculty_key: "__total__",
        faculty_label: "Total",
        row_kind: "total",
        elegible: snapshot(16),
        contraste_total: snapshot(20),
      },
    ],
  };
}

describe("normalizeCalcMuestraAlumnosPorCh", () => {
  it("acepta distribuciones R completas y expone p50 como mediana", () => {
    const result = normalizeCalcMuestraAlumnosPorCh(fixture());
    expect(result?.filas[0].elegible.distribution).toEqual({ media: 22.5, p25: 17, p50: 21 });
    expect(alumnosPorChValue(result!.filas[0].elegible, "mediana")).toBe(21);
    expect(alumnosPorChValue(result!.filas[0].elegible, "p25")).toBe(17);
  });

  it("conserva el snapshot incompleto que R degrada a NA, sin fabricar fallback", () => {
    const raw = fixture();
    const rows = raw.filas as Array<Record<string, unknown>>;
    const eligible = rows[0].elegible as Record<string, unknown>;
    rows[0] = {
      ...rows[0],
      elegible: {
        ...eligible,
        n_ch_con_dato: 7,
        n_matriculas_elegibles: null,
        distribution: { media: null, p25: null, p50: null },
      },
    };
    expect(normalizeCalcMuestraAlumnosPorCh(raw)?.filas[0].elegible).toMatchObject({
      n_ch: 8,
      n_ch_con_dato: 7,
      n_matriculas_elegibles: null,
      distribution: { media: null, p25: null, p50: null },
    });
  });

  it.each([
    ["owner", "otro.owner"],
    ["referencia", "exploracion"],
    ["grano", "facultad_de_alumno"],
    ["metrica", "total"],
  ])("rechaza deriva en %s", (field, value) => {
    expect(normalizeCalcMuestraAlumnosPorCh({ ...fixture(), [field]: value })).toBeNull();
  });
});

describe("normalizeCalcMuestraAlumnosPorChDecision", () => {
  const baseDecision = {
    schema: "calc_muestra_alumnos_por_ch_decision_v1",
    frame_hash: "frame-i18",
    denominador: "elegible",
    estadistico_default: "p25",
    confirmado_at: "2026-08-02T05:00:00.000Z",
  };

  it("acepta método global y overrides por facultad", () => {
    expect(normalizeCalcMuestraAlumnosPorChDecision({
      schema: "calc_muestra_alumnos_por_ch_decision_v1",
      frame_hash: "frame-i18",
      denominador: "elegible",
      estadistico_default: "p25",
      por_facultad: { "fac-derecho": "mediana" },
      confirmado_at: "2026-08-02T05:00:00.000Z",
    })).toMatchObject({
      estadistico_default: "p25",
      por_facultad: { "fac-derecho": "mediana" },
    });
  });

  it("acepta el array vacío que jsonlite publica para list() R", () => {
    expect(normalizeCalcMuestraAlumnosPorChDecision({
      ...baseDecision,
      por_facultad: [],
    })?.por_facultad).toEqual({});
  });

  it.each([
    [["p25"]],
    [[{ fac_derecho: "p25" }]],
  ])(
    "rechaza arrays no vacíos como mapa de overrides: %j",
    (porFacultad) => {
      expect(normalizeCalcMuestraAlumnosPorChDecision({
        ...baseDecision,
        por_facultad: porFacultad,
      })).toBeNull();
    },
  );

  it("rechaza método, denominador o fecha no acreditables", () => {
    const base = {
      ...baseDecision,
      por_facultad: {},
    };
    expect(normalizeCalcMuestraAlumnosPorChDecision({ ...base, estadistico_default: "promedio" })).toBeNull();
    expect(normalizeCalcMuestraAlumnosPorChDecision({ ...base, denominador: "total" })).toBeNull();
    expect(normalizeCalcMuestraAlumnosPorChDecision({ ...base, confirmado_at: "ayer" })).toBeNull();
  });
});
