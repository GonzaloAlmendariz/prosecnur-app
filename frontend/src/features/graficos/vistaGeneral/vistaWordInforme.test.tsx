// I11 del rediseño (2026-10-14). Mata: una página de gráficos sin «Gráfico N», sin la pregunta o sin la fuente al pie,
// o un encabezado corrido que no nombra el capítulo.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PaginaWord } from "./paginasWord";

const paginas: PaginaWord[] = [
  { clase: "portada", titulo: "Acreditación" },
  { clase: "graficos", encabezado: "Perfil", titulos: ["1. Perfil"], figuras: [{ numero: 1, graficador: "p_pie", pregunta: "Sexo", base: "Base: 172 estudiantes" }], folio: 3 },
  { clase: "contraportada" },
];
vi.mock("./paginasWord", async (orig) => ({ ...(await orig<typeof import("./paginasWord")>()), paginasWord: () => paginas }));
vi.mock("../useVariables", () => ({ useVariables: () => ({ variables: [] }) }));

describe("vista Word del Informe", () => {
  it("cada figura con «Gráfico N», su pregunta y base y fuente al pie; encabezado corrido con el capítulo", async () => {
    const { VistaWordInforme } = await import("./VistaWordInforme");
    const html = renderToStaticMarkup(createElement(VistaWordInforme, { filas: [], slides: [] }));
    expect(html).toContain("Gráfico 1");
    expect(html).toContain('<span class="pulso-f6-vg-fig-q">Sexo</span>');
    expect(html).toContain("Base: 172 estudiantes. Fuente: PULSO PUCP.");
    expect(html).toMatch(/pulso-f6-vg-pag-enc"><span>Acreditación<\/span><b>Perfil<\/b>/);
    expect(html.match(/pulso-f6-vg-pagina /g)?.length).toBe(3);
  });
});
