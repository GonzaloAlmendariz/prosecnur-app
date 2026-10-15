// I11 del rediseño (2026-10-14). Mata: una página de gráficos sin «Gráfico N», sin la pregunta o sin la fuente al pie,
// o un encabezado corrido que no nombra el capítulo.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PaginaWord } from "./paginasWord";

const paginas: PaginaWord[] = [
  { clase: "portada", titulo: "Acreditación", sub: "", fecha: "" },
  { clase: "como-leer", numero: 1, secciones: ["Top Two Box"], figuras: [1, 2], folio: 3 },
  { clase: "capitulo", encabezado: "Perfil", titulos: ["2. Perfil"], texto: false, figuras: [{ numero: 3, graficador: "p_pie", pregunta: "Sexo", base: "Base: 172 estudiantes" }], folio: 4 },
  { clase: "contraportada" },
];

describe("vista Word del Informe", () => {
  it("cada figura con «Gráfico N», su pregunta y base y fuente al pie; encabezado corrido con el capítulo", async () => {
    const { VistaWordInforme } = await import("./VistaWordInforme");
    const html = renderToStaticMarkup(createElement(VistaWordInforme, { paginas }));
    expect(html).toContain("Gráfico 3");
    expect(html).toContain("1. Cómo leer este informe");
    expect(html).toContain("Gráficos de ejemplo: Gráfico 1, Gráfico 2");
    expect(html).toContain('<span class="pulso-f6-vg-fig-q">Sexo</span>');
    expect(html).toContain("Base: 172 estudiantes. Fuente: PULSO PUCP.");
    expect(html).toMatch(/pulso-f6-vg-pag-enc"><span>Acreditación<\/span><b>Perfil<\/b>/);
    expect(html.match(/pulso-f6-vg-pagina /g)?.length).toBe(4);
  });
});
