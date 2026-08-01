import { describe, expect, it } from "vitest";

import { resumenDeEquipo } from "./conteoDeEquipo";

// El bloque decía «8 responsables» en un estudio de cuatro encuestadores: los
// bloques vienen por (Actor, Responsable) y quien cubre dos componentes ocupa
// dos filas. Contar filas y llamarlas responsables duplica al equipo.

describe("resumenDeEquipo", () => {
  it("cuatro personas con dos asignaciones no son ocho responsables", () => {
    const filas = [
      "Jorge Del Solar", "Katherine Colan", "Mary Berrocal", "Silbia Cruzado",
      "Jorge Del Solar", "Katherine Colan", "Mary Berrocal", "Silbia Cruzado",
    ];
    const resumen = resumenDeEquipo(filas);

    expect(resumen.personas).toBe(4);
    expect(resumen.asignaciones).toBe(8);
    expect(resumen.etiqueta).toBe("4 responsables · 8 asignaciones");
  });

  it("con una asignación por persona no nombra las asignaciones", () => {
    // Decir «4 responsables · 4 asignaciones» sería ruido.
    expect(resumenDeEquipo(["Ana", "Beto", "Caro", "Dani"]).etiqueta).toBe("4 responsables");
  });

  it("una sola persona va en singular", () => {
    expect(resumenDeEquipo(["Ana"]).etiqueta).toBe("1 responsable");
    expect(resumenDeEquipo(["Ana", "Ana"]).etiqueta).toBe("1 responsable · 2 asignaciones");
  });

  it("el mismo nombre con otra caja o espacios es la misma persona", () => {
    const resumen = resumenDeEquipo(["Mary Berrocal", " mary berrocal ", "MARY BERROCAL"]);
    expect(resumen.personas).toBe(1);
    expect(resumen.asignaciones).toBe(3);
  });

  it("sin filas no inventa equipo", () => {
    expect(resumenDeEquipo([]).etiqueta).toBe("0 responsables");
    expect(resumenDeEquipo(["", "   "]).personas).toBe(0);
  });
});
