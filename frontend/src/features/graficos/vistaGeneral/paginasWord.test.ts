// I11 del rediseño (2026-10-14), corregido tras el verificador de la fase (2026-10-15). El orden esperado sale de
// recorrer a mano `.word_documento` (api/R/reporte_word_documento.R ~l.101–175) con este plan. Mata: numerar capítulos
// con los números de la app, numerar gráficos desde 1 cuando «Cómo leer» ya gastó figuras, contar las cifras destacadas
// como figuras, o dejar fuera la «Introducción» que abre un texto antes de la primera sección.
import { describe, expect, it } from "vitest";
import { ENTRADAS_POR_PAGINA, contarFiguras, oracion, paginasWord, type ElementoWord, type PaginaWord } from "./paginasWord";

const g = (graficador: string, pregunta: string): ElementoWord => ({ clase: "grafico", graficador, pregunta, base: null });
const plan: ElementoWord[] = [
  { clase: "texto", titulo: "Objetivo" },
  { clase: "seccion", nivel: 1, titulo: "1. PERFIL DE LOS PÚBLICOS" },
  g("p_barras_categoricas", "Ciclo"), g("p_pie", "Sexo"),
  { clase: "cifras" },
  g("p_histograma", "Edad"),
  { clase: "seccion", nivel: 2, titulo: "Servicios" },
  g("p_barras_multiapiladas", "Tutoría"),
];
const capitulos = (ps: PaginaWord[]): unknown[] => ps.flatMap((p): unknown[] => (p.clase === "capitulo" ? [[p.titulos, p.figuras.map((f) => f.numero)]] : p.clase === "como-leer" ? [[`como-leer ${p.numero}`, p.figuras]] : []));

describe("páginas de la vista Word, con la numeración del motor", () => {
  it("Introducción, «Cómo leer» con sus figuras y los capítulos renumerados; las cifras no son figura", () => {
    const ps = paginasWord(plan, { tituloInforme: "Acreditación", hayEscalas: true, hayBottom: true });
    expect(capitulos(ps)).toEqual([
      [["1. Introducción", "1.1. Objetivo"], []],
      ["como-leer 2", [1, 2, 3]],
      [["3. Perfil de los públicos"], [4, 5, 6]],   // tres figuras por página: calibrado con el Word real (63 páginas del catálogo)
      [["3.1. Servicios"], [7]],
    ]);
    const indice = ps[1];
    expect(indice.clase === "indice" && indice.entradas.map((e) => `${e.numero} ${e.titulo}`)).toEqual([
      "1. Introducción", "1.1. Objetivo", "2. Cómo leer este informe", "3. Perfil de los públicos", "3.1. Servicios",
    ]);
    expect(contarFiguras(ps)).toBe(7);
  });

  it("sin escalas no hay «Cómo leer»; un gráfico sin capítulo abre «Resultados»", () => {
    const ps = paginasWord([g("p_pie", "Sexo")], { tituloInforme: "X", hayEscalas: false, hayBottom: false });
    expect(capitulos(ps)).toEqual([[["1. Resultados"], [1]]]);
  });

  it("sin Bottom Two Box, «Cómo leer» gasta dos figuras", () => {
    const ps = paginasWord([{ clase: "seccion", nivel: 1, titulo: "Escalas" }, g("p_barras_apiladas", "A")], { tituloInforme: "X", hayEscalas: true, hayBottom: false });
    expect(capitulos(ps)).toEqual([["como-leer 1", [1, 2]], [["2. Escalas"], [3]]]);
  });

  it("tipo oración como `.word_oracion`: sólo los títulos en mayúsculas", () => {
    expect(oracion("PERFIL DE LOS PÚBLICOS")).toBe("Perfil de los públicos");
    expect(oracion("Perfil de los Públicos")).toBe("Perfil de los Públicos");
    expect(oracion("TTB")).toBe("TTB");
  });

  it("un «Contenido» largo sigue en otra página y los folios siguientes corren", () => {
    const muchas: ElementoWord[] = Array.from({ length: ENTRADAS_POR_PAGINA + 3 }, (_, i) => ({ clase: "seccion", nivel: 1, titulo: `Capítulo ${i + 1}` }));
    const ps = paginasWord(muchas, { tituloInforme: "X", hayEscalas: false, hayBottom: false });
    const indices = ps.filter((p) => p.clase === "indice");
    expect(indices.map((p) => p.clase === "indice" && [p.entradas.length, p.folio, p.indices.length])).toEqual([[ENTRADAS_POR_PAGINA, 2, 0], [3, 3, 1]]);
    const primera = ps.find((p) => p.clase === "capitulo");
    expect(primera && "folio" in primera && primera.folio).toBe(4);
  });
});
