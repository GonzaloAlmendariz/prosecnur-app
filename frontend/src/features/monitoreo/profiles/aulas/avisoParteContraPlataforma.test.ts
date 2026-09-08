import { describe, expect, it } from "vitest";
import { avisoParteContraPlataforma, casosLejos } from "./avisoParteContraPlataforma";
import type { ParteContraPlataforma } from "./parteContraPlataforma";

/**
 * S8 (loop estética-aulas-sheets, 2026-09-07). La hoja publica las dos cuentas
 * juntas y el panel lista los descuadres, pero nadie avisaba cuando el parte y
 * la plataforma están LEJOS, que es el control de campo que el bloque existe
 * para dar. Medido el día 1: CH 76 declaró 23 y la plataforma da 38 (−39 %),
 * CH 72 23 contra 34 (−32 %), CH 108 12 contra 6 (+100 %); los otros cuatro
 * partes difieren en 1 o 2. El aviso nombra los lejos, dice la causa probable
 * de cada lado y la salida.
 */
const caso = (codigo: string, declaradas: number, enPlataforma: number) => ({
  codigo, facultad: "", declaradas, enPlataforma, diferencia: declaradas - enPlataforma,
});
const r = (casos: ReturnType<typeof caso>[], extra: Partial<ParteContraPlataforma> = {}): ParteContraPlataforma => ({
  comparables: 7, descuadran: casos.length, casos, fuentesSinCorrespondencia: false,
  conVariosPartes: 0, explicadasPorFiltro: 0, sinCrudo: false, ...extra,
});

describe("casosLejos", () => {
  it("lejos es a la vez 5 o más encuestas y 20 % o más del lado de la plataforma", () => {
    const lejos = casosLejos([
      caso("CH 76", 23, 38), caso("CH 72", 23, 34), caso("CH 108", 12, 6),
      caso("CH 103", 18, 16), caso("CH 43", 17, 16), caso("CH 38", 40, 39),
    ]);
    expect(lejos.map((c) => c.codigo)).toEqual(["CH 76", "CH 72", "CH 108"]);
  });

  it("una diferencia grande en proporción pero chica en encuestas no alarma", () => {
    expect(casosLejos([caso("CH 9", 3, 1)])).toEqual([]);
  });
});

describe("avisoParteContraPlataforma", () => {
  it("nombra los lejos con sus dos cuentas, dice la causa de cada lado y la salida", () => {
    const a = avisoParteContraPlataforma(r([caso("CH 76", 23, 38), caso("CH 72", 23, 34), caso("CH 108", 12, 6), caso("CH 43", 17, 16)]));
    expect(a.codigos).toEqual(["CH 76", "CH 72", "CH 108"]);
    expect(a.texto).toMatch(/^3 cursos-horario con el parte lejos de la plataforma: CH 76 \(parte 23, plataforma 38\), CH 72 \(parte 23, plataforma 34\), CH 108 \(parte 12, plataforma 6\)\./);
    expect(a.texto).toContain("Por debajo");
    expect(a.texto).toContain("Por encima");
    expect(a.texto).toContain("collectorID");
    expect(a.tono).toBe("atencion");
  });

  it("uno solo va en singular", () => {
    const a = avisoParteContraPlataforma(r([caso("CH 76", 23, 38)]));
    expect(a.texto).toMatch(/^1 curso-horario con el parte lejos de la plataforma: CH 76/);
  });

  it("con diferencias chicas no dice nada", () => {
    const a = avisoParteContraPlataforma(r([caso("CH 43", 17, 16), caso("CH 103", 18, 16)]));
    expect(a.texto).toBe("");
    expect(a.codigos).toEqual([]);
  });

  it("si las fuentes ya no se corresponden, calla: esa alarma la da el panel", () => {
    const a = avisoParteContraPlataforma(r([caso("CH 76", 23, 38)], { fuentesSinCorrespondencia: true }));
    expect(a.texto).toBe("");
  });

  it("más de cinco se resumen con «y N más», y sin em dashes", () => {
    const muchos = ["CH 1", "CH 2", "CH 3", "CH 4", "CH 5", "CH 6", "CH 7"].map((c) => caso(c, 10, 30));
    const a = avisoParteContraPlataforma(r(muchos));
    expect(a.texto).toContain("y 2 más");
    expect(a.texto).not.toContain("—");
  });
});
