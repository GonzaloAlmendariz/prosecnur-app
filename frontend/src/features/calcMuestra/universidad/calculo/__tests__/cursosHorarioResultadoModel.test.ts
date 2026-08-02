import { describe, expect, it } from "vitest";
import type { CalcMuestraResultado } from "../../../../../api/client";
import {
  cursosHorarioDesdeResultado,
  estadoPlanCursosHorario,
  planCursosHorarioPublicado,
} from "../cursosHorarioResultadoModel";

function resultado(): CalcMuestraResultado {
  return {
    aulas_base_total: 7,
    aulas_extra_total: 2,
    aulas_total: 9,
    alumnos_por_ch_decision: {
      schema: "calc_muestra_alumnos_por_ch_decision_v1",
      frame_hash: "frame-i18",
      denominador: "elegible",
      estadistico_default: "p25",
      confirmado_at: "2026-08-02T05:00:00Z",
    },
    aulas_por_estrato: [{
      estrato: "Derecho", N: 500, cuota: 120, avg_conglomerado: 20,
      tau: 1, aulas_base: 7, aulas_reemplazo: 2, aulas_total: 9,
      tipo_aula: "mediana", precision_e: 0.05, estadistico_usado: "p25",
      alumnos_por_ch: {
        referencia: "marco_ejecutado", frame_hash: "frame-i18",
        denominador: "elegible", faculty_key: "derecho",
        estadistico: "p25", valor: 20,
      },
    }],
  } as CalcMuestraResultado;
}

describe("cursosHorarioDesdeResultado", () => {
  it("proyecta filas y totales publicados sin recalcularlos", () => {
    const model = cursosHorarioDesdeResultado(resultado());
    expect(model).toMatchObject({ aulasBaseTotal: 7, aulasExtraTotal: 2, aulasTotal: 9 });
    expect(planCursosHorarioPublicado(model!)).toEqual({ Derecho: 9 });
  });

  it("falla cerrado si la auditoría no firma el frame o falta", () => {
    const stale = resultado();
    stale.aulas_por_estrato![0].alumnos_por_ch!.frame_hash = "otro-frame";
    expect(cursosHorarioDesdeResultado(stale)).toBeNull();
    const legacy = resultado();
    delete legacy.alumnos_por_ch_decision;
    expect(cursosHorarioDesdeResultado(legacy)).toBeNull();
  });

  it("falla cerrado si filas y totales R no reconcilian", () => {
    const brokenRow = resultado();
    brokenRow.aulas_por_estrato![0].aulas_total = 8;
    expect(cursosHorarioDesdeResultado(brokenRow)).toBeNull();

    const brokenRoot = resultado();
    brokenRoot.aulas_total = 10;
    expect(cursosHorarioDesdeResultado(brokenRoot)).toBeNull();
  });

  it("solo acredita el plan publicado idéntico y sobre marco vigente", () => {
    const base = { confirmado: true, marcoDesactualizado: false, actual: { Derecho: 9 }, guardado: { Derecho: 9 } };
    expect(estadoPlanCursosHorario(base)).toEqual({ vigente: true, puedeConfirmar: false });
    expect(estadoPlanCursosHorario({ ...base, marcoDesactualizado: true }))
      .toEqual({ vigente: false, puedeConfirmar: false });
    expect(estadoPlanCursosHorario({ ...base, actual: { Derecho: 8 } }))
      .toEqual({ vigente: false, puedeConfirmar: true });
  });
});
