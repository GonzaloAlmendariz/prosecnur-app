import { describe, expect, it } from "vitest";

import { tipoDeSesionLabel } from "./aulasPresentation";

/**
 * El tipo de sesión llega del DTI con la lista de subtipos entre paréntesis.
 *
 * Medido el 2026-08-24 sobre el plan de 193 titulares: 183 filas con
 * `TEORICO(TEORICO-PRACTICO,TEORICO-LABORATORIO)` —45 caracteres idénticos— y
 * 10 con `TALLER`. Esa lista es la misma para todas las aulas del tipo, así que
 * no dice nada de ESTA aula, y ensanchaba la tabla hasta empujar tres columnas
 * fuera de la vista.
 */
describe("tipoDeSesionLabel", () => {
  it("quita la lista de subtipos y deja el tipo legible", () => {
    expect(tipoDeSesionLabel("TEORICO(TEORICO-PRACTICO,TEORICO-LABORATORIO)")).toBe("Teorico");
    expect(tipoDeSesionLabel("TALLER")).toBe("Taller");
    expect(tipoDeSesionLabel("SEMINARIO")).toBe("Seminario");
  });

  it("un valor sin paréntesis se devuelve tal cual, sólo capitalizado", () => {
    // Si el DTI cambia el formato, se ve el crudo en vez de una traducción que
    // se quedó vieja: una lista cerrada se traga en silencio lo que no reconoce.
    expect(tipoDeSesionLabel("ACTIVIDAD")).toBe("Actividad");
    expect(tipoDeSesionLabel("Tipo nuevo del DTI")).toBe("Tipo nuevo del dti");
  });

  it("no inventa nada sobre el vacío", () => {
    expect(tipoDeSesionLabel("")).toBe("");
    expect(tipoDeSesionLabel(null)).toBe("");
    expect(tipoDeSesionLabel(undefined)).toBe("");
  });

  it("un valor que es SÓLO el paréntesis se devuelve entero", () => {
    // Recortar hasta dejar la celda vacía sería peor que enseñar el crudo:
    // desaparecería el dato en vez de verse raro.
    expect(tipoDeSesionLabel("(TEORICO-PRACTICO)")).toBe("(TEORICO-PRACTICO)");
  });
});
