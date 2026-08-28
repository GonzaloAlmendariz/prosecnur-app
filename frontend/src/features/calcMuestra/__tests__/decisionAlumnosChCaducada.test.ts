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

/**
 * El motor tiene DOS razones bajo el mismo código y redactan distinto.
 *
 * Medido sobre el SEGUNDO sorteo de HSVG 2026 el 2026-08-28: sus componentes
 * vienen calculados contra el marco del primero, así que `POST
 * /api/calc-muestra/calcular` devuelve 409 con `reason: "frame_stale"` y el
 * texto «La decisión de alumnos por CH no corresponde al marco vigente.» —no el
 * «cambió desde esta corrida» de `decision_stale`, que es contra el que se
 * escribió el reconocimiento por texto.
 */
describe("las dos redacciones del mismo código", () => {
  it("reconoce `frame_stale`, que es la que sale al abrir un sorteo posterior", () => {
    expect(
      esDecisionAlumnosChCaducada(
        new Error("La decisión de alumnos por CH no corresponde al marco vigente."),
      ),
    ).toBe(true);
  });

  it("sigue reconociendo `decision_stale`", () => {
    expect(
      esDecisionAlumnosChCaducada(
        new Error("La decisión de alumnos por CH cambió desde esta corrida."),
      ),
    ).toBe(true);
  });

  it("no se dispara con un fallo cualquiera que mencione el marco", () => {
    expect(esDecisionAlumnosChCaducada(new Error("El marco vigente no tiene aulas."))).toBe(false);
  });
});
