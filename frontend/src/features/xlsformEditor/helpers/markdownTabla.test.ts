// Mata: una tabla que sale como texto con barras, una línea con barras sin separadora tratada como tabla, una celda
// que inyecta HTML y una fila corta que descuadra las columnas.
import { describe, expect, it } from "vitest";
import { renderMarkdownInline } from "./markdown";
import { conTablasHtml, partirEnBloques, tieneTabla } from "./markdownTabla";

const par = ["Elige uno:", "| | Opción A | Opción B |", "|---|---|---|", "| Color | **Rojo** | Azul |", "| Tamaño | Chico |"].join("\n");

describe("tablas markdown en notas", () => {
  it("separa el texto de la tabla y lee encabezado y filas", () => {
    const b = partirEnBloques(par);
    expect(b.map((x) => x.tipo)).toEqual(["texto", "tabla"]);
    const t = b[1]!;
    if (t.tipo !== "tabla") throw new Error("no es tabla");
    expect(t.encabezado).toEqual(["", "Opción A", "Opción B"]);
    expect(t.filas).toEqual([["Color", "**Rojo**", "Azul"], ["Tamaño", "Chico"]]);
  });

  it("pinta <table> con rótulo de fila, markdown en celdas y celdas faltantes vacías", () => {
    const html = conTablasHtml(par, renderMarkdownInline);
    expect(html).toContain("<table");
    expect(html).toContain('<th scope="row">Color</th>');
    expect(html).toContain("<td><strong>Rojo</strong></td>");
    expect(html).toContain('<th scope="row">Tamaño</th><td>Chico</td><td></td>');
    expect(html).not.toContain("|---|");
  });

  it("barras sin fila separadora no son tabla", () => {
    expect(tieneTabla("a | b | c")).toBe(false);
    expect(tieneTabla("| a | b |\n| c | d |")).toBe(false);
    expect(conTablasHtml("| a | b |", renderMarkdownInline)).toBe(renderMarkdownInline("| a | b |"));
  });

  it("el HTML de una celda queda escapado", () => {
    const html = conTablasHtml("| x |\n|---|\n| <img src=x onerror=alert(1)> |", renderMarkdownInline);
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
});
