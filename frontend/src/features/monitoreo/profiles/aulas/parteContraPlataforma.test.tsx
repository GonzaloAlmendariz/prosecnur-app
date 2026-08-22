import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { parteContraPlataforma } from "./parteContraPlataforma";
import { AulasParteContraPlataforma } from "./AulasParteContraPlataforma";

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

  // ── Dos partes del mismo curso-horario ──────────────────────────────────
  //
  // El lado de plataforma siempre fue por código; el del parte se comparaba
  // fila a fila. Un curso-horario con dos partes —dos sesiones, o el libro
  // partido en dos filas— se comparaba DOS VECES contra el mismo total, así
  // que descuadraba dos veces aunque la suma cuadrara exacta.

  it("dos partes del mismo curso-horario se suman antes de comparar", () => {
    const r = parteContraPlataforma(
      [parte("A", 20), parte("A", 18)],
      [aula("A", 38)],
    );
    // Un curso-horario, no dos filas.
    expect(r.comparables).toBe(1);
    // Y la suma cuadra: 20 + 18 = 38. Antes daba 2 descuadres de un cruce perfecto.
    expect(r.descuadran).toBe(0);
    expect(r.conVariosPartes).toBe(1);
  });

  it("si la suma NO cuadra, el descuadre es uno solo y por el total", () => {
    const r = parteContraPlataforma(
      [parte("A", 20), parte("A", 18)],
      [aula("A", 30)],
    );
    expect(r.descuadran).toBe(1);
    expect(r.casos[0]).toMatchObject({ codigo: "A", declaradas: 38, enPlataforma: 30, diferencia: 8 });
  });

  it("sin partes repetidos no declara agrupación", () => {
    const r = parteContraPlataforma([parte("A", 20)], [aula("A", 20)]);
    expect(r.conVariosPartes).toBe(0);
  });

  it("los partes repetidos no inflan la sospecha del mapeo", () => {
    // 20 cursos-horario que cuadran, cada uno partido en dos filas. Fila a fila
    // eran 40 comparables y 40 descuadres: el panel habría acusado al mapeo de
    // estar roto en un operativo que cuadra perfecto.
    const partes = Array.from({ length: 20 }, (_, i) => [
      parte(`C${i}`, 10), parte(`C${i}`, 10),
    ]).flat();
    const agenda = Array.from({ length: 20 }, (_, i) => aula(`C${i}`, 20));
    const r = parteContraPlataforma(partes, agenda);
    expect(r.comparables).toBe(20);
    expect(r.descuadran).toBe(0);
    expect(r.fuentesSinCorrespondencia).toBe(false);
  });
});

// ── El panel declara la agrupación ────────────────────────────────────────
// Un campo que nadie consume no arregla nada: si el cruce agrupó partes, el
// lector tiene que verlo, porque «los 20 cuadran» significa otra cosa cuando
// detrás hay 40 partes.
describe("AulasParteContraPlataforma declara los partes agrupados", () => {
  const render = (partes: ReturnType<typeof parte>[], agenda: ReturnType<typeof aula>[]) =>
    renderToStaticMarkup(<AulasParteContraPlataforma partes={partes} agenda={agenda} />);

  it("con partes agrupados lo dice; sin ellos no ensucia el texto", () => {
    const con = render([parte("A", 10), parte("A", 10)], [aula("A", 20)]);
    expect(con).toContain("1 de ellos suman más de un parte de campo");

    const sin = render([parte("A", 20)], [aula("A", 20)]);
    expect(sin).not.toContain("parte de campo");
  });

  it("nombra la población por lo que es: cursos-horario, no aulas", () => {
    // Los dos lados del cruce son por curso-horario; «aulas» era la palabra de
    // otra población del mismo perfil.
    const html = render([parte("A", 20)], [aula("A", 20)]);
    expect(html).toContain("cursos-horario comparables");
    expect(html).not.toContain("aulas comparables");
  });
});
