import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { AulasRendimientoPorFacultad } from "./AulasRendimientoPorFacultad";

/**
 * «Qué está rindiendo más» habla de PERSONAS, y las personas son enteras.
 *
 * El panel mostraba 26,8 · 25,7 · 23,3 mientras el de arriba —la serie— ya
 * truncaba a personas enteras hacia abajo. Dos paneles vecinos, la misma unidad,
 * dos formatos. Gonzalo: «hablar de que Educación deja veintiséis punto ocho
 * encuestas por aula no se interpreta bien; hay que ser más conservadores».
 *
 * El panel no tenía NINGUNA prueba: se pudo cambiar cada número visible sin que
 * la suite se moviera. Por eso este archivo fija las dos mitades del criterio,
 * que se contradicen entre sí y por eso hay que sujetar las dos:
 *
 * 1. lo que se LEE va truncado hacia abajo;
 * 2. lo que ORDENA conserva el decimal, o dos facultades de 28,9 y 28,1
 *    empatarían y el orden lo decidiría el alfabeto.
 */

function aula(faculty: string, asistentes: number, efectivas: number): MonitoreoRow {
  return {
    faculty,
    attendees_observed: asistentes,
    effective_surveys: efectivas,
  } as unknown as MonitoreoRow;
}

/** Lo que se pinta DENTRO de las barras, que es donde vive el número por aula. */
function porAulaEnPantalla(html: string): string[] {
  return [...html.matchAll(/<i[^>]*>([^<]*)<\/i>/g)].map((m) => m[1]);
}

describe("qué está rindiendo más, en personas enteras", () => {
  it("trunca hacia abajo lo que se lee: 28,9 se muestra como 28, nunca como 29", () => {
    // Diez aulas y 289 efectivas → 28,9 por aula. El fixture TIENE que dar un
    // decimal: con 81/3 salen 27 exactos y el aserto no podría fallar nunca.
    const partes = Array.from({ length: 10 }, (_, i) =>
      aula("Educacion", 40, i === 0 ? 37 : 28));
    const html = renderToStaticMarkup(
      <AulasRendimientoPorFacultad partes={partes} plan={[]} />);

    // Sobre la BARRA, no sobre el html entero: la lectura de arriba también dice
    // «28» y un `toContain` global se daba por satisfecho con ella mientras la
    // columna seguía mostrando 28,9.
    expect(porAulaEnPantalla(html)).toEqual(["28"]);
  });

  it("no deja ni un decimal en la columna por aula", () => {
    // 27,3 y 22,7: los dos con decimal, a propósito.
    const partes = [
      ...Array.from({ length: 3 }, (_, i) => aula("Letras", 40, i === 0 ? 28 : 27)),
      ...Array.from({ length: 3 }, (_, i) => aula("Ciencias", 40, i === 0 ? 24 : 22)),
    ];
    const html = renderToStaticMarkup(
      <AulasRendimientoPorFacultad partes={partes} plan={[]} />);

    const barras = porAulaEnPantalla(html);
    expect(barras.length).toBe(2);
    expect(barras.filter((t) => /\d+[.,]\d/.test(t))).toEqual([]);
  });

  it("ordena por el valor con decimales, no por el truncado", () => {
    // 28,9 y 28,1: truncadas empatan en 28 y el orden lo decidiría el alfabeto,
    // que pondría «Antropologia» delante aunque rinda menos.
    const partes = [
      ...Array.from({ length: 10 }, (_, i) => aula("Antropologia", 40, i === 0 ? 29 : 28)),
      ...Array.from({ length: 10 }, (_, i) => aula("Zoologia", 40, i === 0 ? 37 : 28)),
    ];
    const html = renderToStaticMarkup(
      <AulasRendimientoPorFacultad partes={partes} plan={[]} />);

    expect(porAulaEnPantalla(html)).toEqual(["28", "28"]);
    expect(html.indexOf("Zoologia")).toBeLessThan(html.indexOf("Antropologia"));
  });
});
