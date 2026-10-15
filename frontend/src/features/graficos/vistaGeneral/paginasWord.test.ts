// I11 del rediseño (2026-10-14). Mata: una numeración de gráficos que se reinicia por capítulo, un índice sin los
// subcapítulos, más de dos figuras por página o un «Cómo leer» que no llega al Word.
import { describe, expect, it } from "vitest";
import type { FilaVistaGeneral } from "./modeloVistaGeneral";
import { contarFiguras, paginasWord } from "./paginasWord";

const lam = (id: string, titulo = id) => ({ id, titulo }) as never;
const tarjeta = (id: string, rol: "separador" | "subcapitulo" | "lamina" = "lamina", numero: string | null = null, titulo = id) =>
  ({ lamina: lam(id, titulo), rol, numero, graficos: [] });
const filas = [
  { id: "ap", clase: "bloque", titulo: "Apertura", numero: null, tarjetas: [tarjeta("portada")] },
  { id: "cl", clase: "bloque", titulo: "Cómo leer este informe", numero: null, tarjetas: [tarjeta("ttb")] },
  { id: "c1", clase: "capitulo", titulo: "Perfil", numero: "1", tarjetas: [tarjeta("s1", "separador", "1"), tarjeta("a"), tarjeta("b")] },
  { id: "c2", clase: "capitulo", titulo: "Escalas", numero: "2", tarjetas: [tarjeta("s2", "separador", "2"), tarjeta("sub", "subcapitulo", "2.1", "Servicios"), tarjeta("c")] },
] as unknown as FilaVistaGeneral[];
const g = (graficador: string, pregunta: string) => ({ graficador, pregunta });
const graficos = new Map([
  ["a", [g("p_barras_categoricas", "Ciclo"), g("p_pie", "Sexo")]],
  ["b", [g("p_histograma", "Edad")]],
  ["c", [g("p_barras_multiapiladas", "Tutoría")]],
]);

describe("páginas de la vista Word", () => {
  const paginas = paginasWord(filas, graficos, "Acreditación");

  it("portada, índice con subcapítulos, «Cómo leer», capítulos y contraportada", () => {
    expect(paginas.map((p) => p.clase)).toEqual(["portada", "indice", "texto", "graficos", "graficos", "graficos", "contraportada"]);
    const indice = paginas[1];
    expect(indice.clase === "indice" && indice.entradas).toEqual([
      { numero: "1.", titulo: "Perfil", nivel: 1 },
      { numero: "2.", titulo: "Escalas", nivel: 1 },
      { numero: "2.1.", titulo: "Servicios", nivel: 2 },
    ]);
  });

  it("numera los gráficos de corrido, dos por página; el subcapítulo sin gráficos antes va bajo el título del capítulo", () => {
    const g1 = paginas.filter((p) => p.clase === "graficos");
    expect(g1.map((p) => p.clase === "graficos" && [p.titulos, p.figuras.map((f) => f.numero)])).toEqual([
      [["1. Perfil"], [1, 2]],
      [[], [3]],
      [["2. Escalas", "2.1. Servicios"], [4]],
    ]);
    expect(contarFiguras(paginas)).toBe(4);
  });
});
