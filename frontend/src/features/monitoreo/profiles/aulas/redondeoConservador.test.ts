import { describe, expect, it } from "vitest";

import { personasPorAula, personasProyectadas } from "./redondeoConservador";

// «Recuerda que estamos hablando de personas [...] hablar de que Educación deja
// veintiséis punto ocho encuestas por aula no se entiende, no se interpreta
// bien. Si se aproxima hacia abajo, de cero punto seis hacia abajo, no tengo
// problema; hay que tratar de ser más conservadores, más cautos.»

describe("personas enteras y siempre hacia abajo", () => {
  it.each([
    [26.8, "26"],
    [26.9, "26"],
    [27.4, "27"],
    [23.2, "23"],
    [29.5, "29"],
    [1, "1"],
    [0.9, "0"],
  ])("%s se lee %s", (valor, esperado) => {
    expect(personasPorAula(valor)).toBe(esperado);
  });

  it("nunca redondea al alza, ni desde 0.9", () => {
    // Es la razón de existir del módulo: un decimal al alza promete una encuesta
    // que puede no llegar. En una pantalla que decide si hace falta agendar más
    // aulas, el error barato es quedarse corto.
    for (const v of [1.9, 12.99, 100.5]) {
      expect(Number(personasPorAula(v).replace(/\D/g, ""))).toBeLessThan(v);
    }
  });

  it("sin dato dice S/D y no 0", () => {
    // Un 0 por dato ausente es el patrón 17 del catálogo: una ausencia
    // presentada como un valor.
    expect(personasPorAula(null)).toBe("S/D");
    expect(personasPorAula(undefined)).toBe("S/D");
    expect(personasPorAula(Number.NaN)).toBe("S/D");
  });

  it("una proyección no baja de cero", () => {
    expect(personasProyectadas(-3)).toBe("0");
    expect(personasProyectadas(12.7)).toBe("12");
  });
});
