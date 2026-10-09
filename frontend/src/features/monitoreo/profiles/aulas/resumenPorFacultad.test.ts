import { describe, expect, it } from "vitest";

import { resumenPorFacultad } from "./resumenPorFacultad";

/**
 * «Quiero ver las respuestas efectivas de las facultades, quiero ver las aulas,
 * quiero ver cuántas se han aplicado» (Gonzalo, 2026-09-09). Ninguna de las
 * tres estaba por facultad en Resumen.
 */
const resp = (facultad: string, efectivas: number, observadas = efectivas) => ({
  facultad, efectivas, observadas, fuera_del_operativo: 0, no_pasan_criterio: observadas - efectivas,
});

describe("las tres cifras por facultad", () => {
  it("cruza respuestas con aulas y ordena por efectivas", () => {
    const filas = resumenPorFacultad(
      [resp("DERECHO", 51), resp("CIENCIAS E INGENIERIA", 202)],
      [{ facultad: "DERECHO", planificadas: 19, aplicadas: 3 },
       { facultad: "CIENCIAS E INGENIERIA", planificadas: 37, aplicadas: 12 }],
    );
    expect(filas.map((f) => f.facultad)).toEqual(["CIENCIAS E INGENIERIA", "DERECHO"]);
    expect(filas[1]).toMatchObject({ efectivas: 51, planificadas: 19, aplicadas: 3 });
  });

  it("una facultad que sólo está en UN bloque entra igual, con hueco declarado", () => {
    // Descartarla escondería una facultad entera por un hueco de datos.
    const filas = resumenPorFacultad(
      [resp("EDUCACION", 0)],
      [{ facultad: "GASTRONOMÍA", planificadas: 3, aplicadas: 0 }],
    );
    expect(filas).toHaveLength(2);
    const educacion = filas.find((f) => f.facultad === "EDUCACION");
    expect(educacion?.planificadas).toBeNull();
    const gastro = filas.find((f) => f.facultad === "GASTRONOMÍA");
    expect(gastro?.planificadas).toBe(3);
  });

  it("el cruce no distingue mayúsculas ni espacios sobrantes", () => {
    const filas = resumenPorFacultad(
      [resp(" derecho ", 51)],
      [{ facultad: "DERECHO", planificadas: 19, aplicadas: 3 }],
    );
    expect(filas).toHaveLength(1);
    expect(filas[0].aplicadas).toBe(3);
  });

  it("cero aplicadas es un dato, y `null` es «no lo sé»", () => {
    const filas = resumenPorFacultad(
      [resp("EDUCACION", 0)],
      [{ facultad: "EDUCACION", planificadas: 3, aplicadas: 0 }],
    );
    expect(filas[0].aplicadas).toBe(0);
    expect(filas[0].aplicadas).not.toBeNull();
  });

  it("una facultad sin nombre no entra", () => {
    expect(resumenPorFacultad([resp("  ", 9)], [])).toHaveLength(0);
  });

  it("sin ninguno de los dos bloques no hay filas", () => {
    expect(resumenPorFacultad(null, undefined)).toHaveLength(0);
  });
});
