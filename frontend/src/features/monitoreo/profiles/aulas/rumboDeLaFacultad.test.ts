import { describe, expect, it } from "vitest";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { palabraDelRumbo, rumboDeLaFacultad } from "./rumboDeLaFacultad";

/**
 * El caso del ensayo, textual: «la serie de tres jornadas separa a la que debe
 * siete y venía debiendo veinte de la que debe siete y venía en cero. La
 * primera se está arreglando sola».
 */

const parte = (codigo: string, fecha: string, efectivas: number) =>
  ({ operational_code: codigo, classroom_id: codigo, faculty: "DERECHO",
     applied_at: fecha, effective_surveys: efectivas,
     observed_students: efectivas }) as unknown as MonitoreoRow;

const aula = (codigo: string, elegibles: number) =>
  ({ operational_code: codigo, classroom_id: codigo, faculty: "DERECHO",
     eligible_n: elegibles, expected_valid: Math.round(elegibles * 0.5) }) as unknown as MonitoreoRow;

describe("el rumbo de una facultad", () => {
  it("con una sola jornada NO declara rumbo: no hay con qué compararla", () => {
    // Decir «estable» con un punto sería inventar el rumbo, no medirlo.
    const r = rumboDeLaFacultad([parte("CH 1", "2026-09-08", 10)], [aula("CH 1", 20)], "DERECHO", 0.5);
    expect(r.verbo).toBeNull();
    expect(r.jornadas).toEqual([]);
  });

  it("la que venía debiendo mucho y ya debe poco: se está arreglando", () => {
    // Día 1: 20 elegibles al 0,5 → se esperaban 10 y llegaron 2. Debe 8.
    // Día 2: +20 elegibles → esperado acumulado 20, efectivas 19. Debe 1.
    const r = rumboDeLaFacultad(
      [parte("CH 1", "2026-09-08", 2), parte("CH 2", "2026-09-09", 17)],
      [aula("CH 1", 20), aula("CH 2", 20)],
      "DERECHO", 0.5,
    );
    expect(r.jornadas.map((j) => j.deuda)).toEqual([8, 1]);
    expect(r.verbo).toBe("mejora");
    expect(palabraDelRumbo(r)).toContain("venía debiendo 8");
  });

  it("la que empezó bien y se torció", () => {
    const r = rumboDeLaFacultad(
      [parte("CH 1", "2026-09-08", 12), parte("CH 2", "2026-09-09", 1)],
      [aula("CH 1", 20), aula("CH 2", 20)],
      "DERECHO", 0.5,
    );
    // Día 1: esperado 10, efectivas 12 → −2, va por encima.
    // Día 2: esperado 20, efectivas 13 → debe 7.
    expect(r.jornadas.map((j) => j.deuda)).toEqual([-2, 7]);
    expect(r.verbo).toBe("empeora");
    expect(palabraDelRumbo(r)).toContain("empezó sin deber");
  });

  it("la deuda negativa NO se recorta a cero: esconde a la que va sobrada", () => {
    const r = rumboDeLaFacultad(
      [parte("CH 1", "2026-09-08", 15), parte("CH 2", "2026-09-09", 15)],
      [aula("CH 1", 20), aula("CH 2", 20)],
      "DERECHO", 0.5,
    );
    expect(r.jornadas.every((j) => j.deuda < 0)).toBe(true);
  });

  it("sin tasa prevista no se inventa una deuda", () => {
    // La vara es la prevista de SU facultad; sin ella no hay contra qué medir,
    // y usar una media del estudio diría algo que nadie calculó.
    const r = rumboDeLaFacultad(
      [parte("CH 1", "2026-09-08", 2), parte("CH 2", "2026-09-09", 17)],
      [aula("CH 1", 20), aula("CH 2", 20)],
      "DERECHO", null,
    );
    expect(r.verbo).toBeNull();
  });

  it("una facultad que no está en los partes devuelve vacío, no ceros", () => {
    const r = rumboDeLaFacultad(
      [parte("CH 1", "2026-09-08", 2), parte("CH 2", "2026-09-09", 17)],
      [aula("CH 1", 20), aula("CH 2", 20)],
      "LETRAS", 0.5,
    );
    expect(r.jornadas).toEqual([]);
    expect(r.verbo).toBeNull();
  });
});
