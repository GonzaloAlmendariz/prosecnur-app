import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const estado = { valor: { fase: "lista", datos: { categorias: [
  { codigo: "1", etiqueta: "Trabaja", n: 40, pct: 40, residual: false },
  { codigo: "2", etiqueta: "No trabaja", n: 60, pct: 60, residual: false },
] } } as unknown };
vi.mock("./useCategoriasGrafico", () => ({ useCategoriasGrafico: () => ({ ...(estado.valor as object), reintentar: () => undefined }) }));
const { PartesLineas } = await import("./PartesLineas");

const pintar = (arg: string, valor: unknown, variable = "e$p5") => renderToStaticMarkup(createElement(PartesLineas, {
  id: "x", arg, etiqueta: createElement("label", null, "Líneas"), nota: null, valor, variable, scope: "active",
  graficador: "p_lineas_nivel", onCambio: () => undefined,
}));

describe("partes de la línea por nivel en la tarjeta", () => {
  it("cada línea con su rótulo y sus respuestas como fichas; lo que no se edita se lee", () => {
    const html = pintar("series", [{ rotulo: "Trabaja", codigos: ["1"], y: { var: "horas", codigos: ["2"] } }]);
    expect(html).toContain('value="Trabaja"');
    expect(html).toMatch(/aria-pressed="true"[^>]*title="Código 1/);
    expect(html).toContain("Suma una segunda pregunta: horas.");
    expect(html).toContain("Agregar línea");
    expect(html).toContain('aria-label="Quitar la línea Trabaja"');
  });
  it("con tres líneas no deja agregar otra; una fila incompleta lleva su aviso", () => {
    const tres = ["a", "b", ""].map((r) => ({ rotulo: r, codigos: ["1"] }));
    const html = pintar("series", tres);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>.*Ya hay tres líneas/);
    expect(html).toContain("Falta el rótulo: no sale.");
  });
  it("las partes del total vacías: sólo el botón de agregar; sin lista de respuestas, el texto de códigos", () => {
    expect(pintar("segmentos_total", null)).toContain("Agregar parte");
    estado.valor = { fase: "sin_lista" };
    expect(pintar("segmentos_total", [{ rotulo: "Sí", codigos: ["1", "2"] }])).toContain('value="1, 2"');
  });
});
