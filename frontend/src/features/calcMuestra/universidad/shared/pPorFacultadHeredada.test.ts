import { describe, expect, it } from "vitest";

import { UNIVERSITY_REFERENCE_SUCCESS_RATE } from "./constants";

/**
 * La `p` por facultad que ve un estudio NUEVO no es neutra: sale de la
 * prevalencia medida en el estudio de referencia.
 *
 * La pantalla decía «Vacío = usa la p global (0.5)» y era falso: `study.ts`
 * rellena `p_facultad` desde esta tabla y sólo cae a la global cuando la
 * facultad no aparece. Verificado en un proyecto nuevo con las bases 2026:
 * Arte y Diseño 0,5 · Artes Escénicas 0,5 · Ciencias Contables 0,2 · Ciencias
 * e Ingeniería 0,2 — los de la tabla.
 *
 * Este test no discute si la inyección debe seguir —eso es decisión del
 * estudio—: fija que la tabla EXISTE y que sus valores NO son la global, que es
 * justo lo que la nota negaba.
 */
describe("la p por facultad heredada del estudio de referencia", () => {
  it("trae valores propios por facultad, distintos de la p global", () => {
    const global = 0.5;
    const distintos = Object.entries(UNIVERSITY_REFERENCE_SUCCESS_RATE)
      .filter(([, v]) => v !== global);
    expect(distintos.length).toBeGreaterThan(0);
  });

  it("y los que se ven en un proyecto nuevo salen de aquí", () => {
    // Las cuatro que leí en pantalla, para que renombrar una facultad o tocar
    // la tabla no pase inadvertido.
    expect(UNIVERSITY_REFERENCE_SUCCESS_RATE["ARTE Y DISEÑO"]).toBe(0.5);
    expect(UNIVERSITY_REFERENCE_SUCCESS_RATE["ARTES ESCÉNICAS"]).toBe(0.5);
    expect(UNIVERSITY_REFERENCE_SUCCESS_RATE["CIENCIAS CONTABLES"]).toBe(0.2);
    expect(UNIVERSITY_REFERENCE_SUCCESS_RATE["CIENCIAS E INGENIERIA"]).toBe(0.2);
  });

  it("cubre las variantes con y sin tilde, porque el DTI escribe de las dos formas", () => {
    // `EDUCACION` llega sin tilde en la base 2026 y `EDUCACIÓN` con ella en
    // otros insumos: si sólo estuviera una, media tabla caería a la global sin
    // que nadie lo notara.
    for (const par of [["EDUCACIÓN", "EDUCACION"], ["PSICOLOGÍA", "PSICOLOGIA"]]) {
      const [conTilde, sinTilde] = par;
      expect(UNIVERSITY_REFERENCE_SUCCESS_RATE[conTilde]).toBe(UNIVERSITY_REFERENCE_SUCCESS_RATE[sinTilde]);
    }
  });
});
