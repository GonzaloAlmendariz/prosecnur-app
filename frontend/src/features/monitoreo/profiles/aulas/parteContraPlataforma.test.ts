import { describe, expect, it } from "vitest";

import { parteContraPlataforma } from "./parteContraPlataforma";

const parte = (operational_code: string, effective_surveys: number) => ({ operational_code, effective_surveys });
const aula = (operational_code: string, respuestas_validas: number, faculty = "Derecho") =>
  ({ operational_code, respuestas_validas, faculty });

describe("parteContraPlataforma", () => {
  it("unos pocos descuadres son casos que mirar", () => {
    const r = parteContraPlataforma(
      [parte("A", 20), parte("B", 18), parte("C", 15)],
      [aula("A", 20), aula("B", 12), aula("C", 15)],
    );
    expect(r.comparables).toBe(3);
    expect(r.descuadran).toBe(1);
    expect(r.casos[0]).toMatchObject({ codigo: "B", declaradas: 18, enPlataforma: 12, diferencia: 6 });
    expect(r.fuentesSinCorrespondencia).toBe(false);
  });

  it("cuando descuadra CASI TODO, no es el campo: es el mapeo", () => {
    // El caso que este módulo encontró nada más nacer: en el fixture de QA las
    // respuestas y los partes se siembran sin correspondencia, y 151 de 152
    // aulas «descuadran». Listarlas sería acusar al equipo de un error de
    // configuración.
    const partes = Array.from({ length: 25 }, (_, i) => parte(`CH ${i}`, 20));
    const agenda = Array.from({ length: 25 }, (_, i) => aula(`CH ${i}`, 4));
    const r = parteContraPlataforma(partes, agenda);
    expect(r.descuadran).toBe(25);
    expect(r.fuentesSinCorrespondencia).toBe(true);
  });

  it("con pocas aulas, descuadrar todo NO delata el mapeo", () => {
    // Tres de tres es una proporción del 100 % que no significa nada: el
    // umbral pide casos, no sólo porcentaje.
    const r = parteContraPlataforma(
      [parte("A", 20), parte("B", 18), parte("C", 15)],
      [aula("A", 1), aula("B", 2), aula("C", 3)],
    );
    expect(r.descuadran).toBe(3);
    expect(r.fuentesSinCorrespondencia).toBe(false);
  });

  it("un aula sin la otra fuente no es un descuadre", () => {
    // Sin parte no hay nada que comparar, y contarlo como diferencia inflaría
    // el hallazgo con huecos.
    const r = parteContraPlataforma([parte("A", 20)], [aula("A", 20), aula("B", 30)]);
    expect(r.comparables).toBe(1);
    expect(r.descuadran).toBe(0);
  });

  it("ordena por la separación más grande, caiga del lado que caiga", () => {
    const r = parteContraPlataforma(
      [parte("A", 20), parte("B", 5), parte("C", 12)],
      [aula("A", 18), aula("B", 30), aula("C", 12)],
    );
    expect(r.casos.map((c) => c.codigo)).toEqual(["B", "A"]);
    expect(r.casos[0].diferencia).toBe(-25);
  });
});
