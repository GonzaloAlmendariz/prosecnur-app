import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const estado = { valor: { fase: "lista", datos: { categorias: [
  { codigo: "1", etiqueta: "Sí", n: 80, pct: 80, residual: false },
  { codigo: "2", etiqueta: "No", n: 15, pct: 15, residual: false },
  { codigo: "99", etiqueta: "No sabe", n: 5, pct: 5, residual: true },
] } } as unknown };
vi.mock("./useCategoriasGrafico", () => ({ useCategoriasGrafico: () => ({ ...(estado.valor as object), reintentar: () => undefined }) }));
const { SelectorCategorias } = await import("./SelectorCategorias");

const pintar = (variable: string, valor: unknown, modo: "excluir" | "elegir" = "excluir") => renderToStaticMarkup(createElement(SelectorCategorias, {
  id: "x", etiqueta: createElement("label", null, "Excluir respuestas"), variable, scope: "active", graficador: "p_pie", valor, modo,
  onCambio: () => undefined, nota: null, textoRespaldo: createElement("input", { "data-respaldo": "si" }),
}));

// Gonzalo: no pedir códigos separados por comas; mostrar las categorías de la pregunta.
describe("selector de categorías", () => {
  it("con la pregunta elegida muestra sus categorías como fichas y marca las excluidas", () => {
    const html = pintar("b$p1", ["99"]);
    expect(html).toContain("No sabe");
    expect(html).toMatch(/aria-pressed="true"[^>]*title="Código 99/);
    expect(html).toContain("Una excluida");
    expect(html).not.toContain("data-respaldo");
  });
  it("sin pregunta pide elegirla; sin lista cae al texto de respaldo", () => {
    expect(pintar("", [])).toContain("Elige primero la pregunta");
    estado.valor = { fase: "sin_lista" };
    expect(pintar("b$p1", [])).toContain("data-respaldo");
  });
});
