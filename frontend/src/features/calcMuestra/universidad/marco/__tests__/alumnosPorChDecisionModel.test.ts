import { describe, expect, it } from "vitest";

import type {
  CalcMuestraAlumnosPorCh,
  CalcMuestraAlumnosPorChDecision,
} from "../../../../../api/calcMuestraAlumnosPorCh";
import {
  alumnosPorChDecisionIsCurrent,
  alumnosPorChDraftMatchesDecision,
  effectiveAlumnosPorChMethod,
  missingAlumnosPorChFaculties,
} from "../alumnosPorChDecisionModel";

const snapshot: CalcMuestraAlumnosPorCh = {
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
      faculty_key: "arte",
      faculty_label: "Arte",
      row_kind: "faculty",
      elegible: { n_ch: 0, n_ch_con_dato: 0, n_matriculas_elegibles: 0, distribution: { media: null, p25: null, p50: null } },
      contraste_total: { n_ch: 0, n_ch_con_dato: 0, n_matriculas_elegibles: 0, distribution: { media: null, p25: null, p50: null } },
    },
    {
      faculty_key: "__total__",
      faculty_label: "Total",
      row_kind: "total",
      elegible: { n_ch: 4, n_ch_con_dato: 4, n_matriculas_elegibles: 80, distribution: { media: 20, p25: 15, p50: 18 } },
      contraste_total: { n_ch: 5, n_ch_con_dato: 5, n_matriculas_elegibles: 110, distribution: { media: 22, p25: 16, p50: 20 } },
    },
  ],
};

function decision(frameHash = "frame-i18"): CalcMuestraAlumnosPorChDecision {
  return {
    schema: "calc_muestra_alumnos_por_ch_decision_v1",
    frame_hash: frameHash,
    denominador: "elegible",
    estadistico_default: "p25",
    por_facultad: { derecho: "mediana" },
    confirmado_at: "2026-08-02T05:00:00.000Z",
  };
}

describe("decisión Alumnos por CH", () => {
  it("resuelve override sin fabricar el estadístico", () => {
    expect(effectiveAlumnosPorChMethod("derecho", "p25", { derecho: "mediana" })).toBe("mediana");
    expect(effectiveAlumnosPorChMethod("otra", "p25", { derecho: "mediana" })).toBe("p25");
  });

  it("nombra facultades faltantes y no acredita una decisión incompleta", () => {
    expect(missingAlumnosPorChFaculties(snapshot, "p25", {})).toEqual(["Arte"]);
    expect(alumnosPorChDecisionIsCurrent(snapshot, decision())).toBe(false);
  });

  it("falla stale aunque el método exista", () => {
    const complete = { ...snapshot, filas: snapshot.filas.filter((row) => row.faculty_key !== "arte") };
    expect(alumnosPorChDecisionIsCurrent(complete, decision("otro-frame"))).toBe(false);
    expect(alumnosPorChDecisionIsCurrent(complete, decision())).toBe(true);
  });

  it("pasa de vigente a pendiente al editar el borrador y vuelve al confirmar", () => {
    const complete = { ...snapshot, filas: snapshot.filas.filter((row) => row.faculty_key !== "arte") };
    const saved = decision();
    expect(alumnosPorChDraftMatchesDecision(complete, saved, "p25", { derecho: "mediana" })).toBe(true);
    expect(alumnosPorChDraftMatchesDecision(complete, saved, "media", { derecho: "mediana" })).toBe(false);
    const confirmed = { ...saved, estadistico_default: "media" as const };
    expect(alumnosPorChDraftMatchesDecision(complete, confirmed, "media", { derecho: "mediana" })).toBe(true);
  });
});
