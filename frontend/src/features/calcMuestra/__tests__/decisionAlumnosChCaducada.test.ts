import { describe, expect, it } from "vitest";

import { esDecisionAlumnosChCaducada } from "../CalcMuestraPage";

/**
 * F34 · El motor nombra la condición; la app no puede nombrar otra.
 *
 * Medido contra el backend vivo: `POST /api/calc-muestra/aulas/comparar-metodos`
 * devuelve 409 con `E_CALC_MUESTRA_ALUMNOS_CH_DECISION` y
 * `reason: "decision_stale"`. La app respondía «construye primero el marco de
 * cursos-horario» —con el marco ya construido— y la superficie seguía pidiendo
 * «vuelve a comparar»: un círculo donde lo único ofrecido es lo único que falla.
 */
describe("esDecisionAlumnosChCaducada", () => {
  it("reconoce el código del motor", () => {
    expect(
      esDecisionAlumnosChCaducada(
        Object.assign(new Error("cualquier texto"), {
          code: "E_CALC_MUESTRA_ALUMNOS_CH_DECISION",
        }),
      ),
    ).toBe(true);
  });

  it("reconoce el mensaje literal cuando el código se pierde en el camino", () => {
    expect(
      esDecisionAlumnosChCaducada(
        new Error(
          "La decisión de alumnos por CH cambió desde esta corrida. Recalcula y vuelve a generar los artefactos de Aulas.",
        ),
      ),
    ).toBe(true);
  });

  it("no se lleva por delante otros fallos de la comparación", () => {
    expect(esDecisionAlumnosChCaducada(new Error("No hay marco de cursos-horario."))).toBe(false);
    expect(esDecisionAlumnosChCaducada(new Error("Tiempo de espera agotado."))).toBe(false);
    expect(esDecisionAlumnosChCaducada(null)).toBe(false);
    expect(esDecisionAlumnosChCaducada(undefined)).toBe(false);
  });
});
