import { describe, expect, it } from "vitest";
import { sinColoresEnLaLista } from "./colorPorOpcion";

describe("sinColoresEnLaLista (H2)", () => {
  it("una lista sin ningún color avisa", () => {
    expect(sinColoresEnLaLista([{ opciones: ["Sí", "No"], faltan: 2 }])).toBe(true);
  });
  it("con un color ya tiene efecto: no avisa", () => {
    expect(sinColoresEnLaLista([{ opciones: ["Sí", "No"], faltan: 1 }])).toBe(false);
  });
  it("sin lista hallada no afirma nada", () => {
    expect(sinColoresEnLaLista([])).toBe(false);
  });
  it("con varias listas avisa sólo si ninguna tiene colores", () => {
    expect(sinColoresEnLaLista([{ opciones: ["A"], faltan: 1 }, { opciones: ["B"], faltan: 0 }])).toBe(false);
    expect(sinColoresEnLaLista([{ opciones: ["A"], faltan: 1 }, { opciones: ["B"], faltan: 1 }])).toBe(true);
  });
});
