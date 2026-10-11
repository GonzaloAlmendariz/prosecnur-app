// La fila «Orden» pintada (sin DOM: markup estático). Lo que importa aquí es lo que el analista VE: la lista en el orden
// en que se dibuja (F-a), la marca de las categorías sin respuestas y que el atributo que busca el foco tras Subir/Bajar
// es el que lleva cada botón.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { GraficosCategorias } from "../../../api/graficos";
import { OrdenCategoriasGrafico } from "./OrdenCategoriasGrafico";
import { enfocarTrasMover, NO_SE_DIBUJA, selectorAccionOrden } from "./ordenCategorias";

const datos: GraficosCategorias = {
  var: "p7", base: "", pregunta: "", ordinal: false, tipo: "select_one", modo_recetario: "frecuencia",
  categorias: [
    { codigo: "1", etiqueta: "Alfa", n: 5, pct: 0.5, residual: false },
    { codigo: "2", etiqueta: "Beta", n: 3, pct: 0.3, residual: false },
    { codigo: "0", etiqueta: "Otro", n: 1, pct: 0.1, residual: true },
    { codigo: "3", etiqueta: "Gama", n: 0, pct: 0, residual: false },
  ],
  orden: { recetario: ["1", "2", "3", "0"], instrumento: ["1", "2", "0", "3"], frecuencia: ["1", "2", "3", "0"] },
};

vi.mock("./useCategoriasGrafico", () => ({
  useCategoriasGrafico: () => ({ fase: "lista", datos, reintentar: () => undefined }),
}));

const pintar = (orden: Record<string, unknown>): string => renderToStaticMarkup(
  <OrdenCategoriasGrafico variable="p7" args={{ var: "p7", orden_categorias: orden }} scope="active" onCambio={() => undefined} />,
);
const filas = (html: string): string[] => [...html.matchAll(/<li[^>]*aria-label="([^"]+)"/g)].map((m) => m[1]);

describe("OrdenCategoriasGrafico · la lista se ve como se dibuja", () => {
  it("personalizado e invertido: la lista aparece al revés, como la dibuja el motor", () => {
    const html = pintar({ modo: "personalizado", lista: ["3", "1", "2", "0"], invertir: true });
    expect(filas(html).map((f) => f.replace(/\. no se dibuja.*$/, ""))).toEqual(["1. Otro", "2. Beta", "3. Alfa", "4. Gama"]);
  });

  it("personalizado con la lista guardada vacía e invertido: orden del instrumento sin invertir (el motor no tiene parte listada)", () => {
    const html = pintar({ modo: "personalizado", lista: [], invertir: true });
    expect(filas(html).map((f) => f.replace(/\. no se dibuja.*$/, ""))).toEqual(["1. Alfa", "2. Beta", "3. Gama", "4. Otro"]);
  });

  it("la categoría sin respuestas se marca: no se dibuja", () => {
    const html = pintar({ modo: "personalizado", lista: ["1", "2", "3", "0"], invertir: false });
    expect(filas(html)).toEqual(["1. Alfa", "2. Beta", `3. Gama. ${NO_SE_DIBUJA}`, "4. Otro"]);
    expect(html.match(/is-sin-respuestas/g)).toHaveLength(1);
    expect(html).toContain(`>${NO_SE_DIBUJA}</span>`);
  });
});

describe("OrdenCategoriasGrafico · el foco tras Subir/Bajar encuentra su botón", () => {
  it("cada fila lleva los dos botones con el atributo que busca el foco", () => {
    const html = pintar({ modo: "personalizado", lista: ["1", "2", "3", "0"], invertir: false });
    for (const accion of ["subir", "bajar"] as const) {
      const m = selectorAccionOrden(accion).match(/^button\[([\w-]+)="(\w+)"\]$/);
      expect(m, selectorAccionOrden(accion)).not.toBeNull();
      const [, atributo, valor] = m ?? [];
      const botones = html.match(new RegExp(`<button[^>]*\\s${atributo}="${valor}"`, "g")) ?? [];
      expect(botones).toHaveLength(datos.categorias.length);
    }
  });

  it("enfocarTrasMover busca ese selector y enfoca el botón; sin botón habilitado, la fila", () => {
    const registro: string[] = [];
    const boton = { focus: () => registro.push("boton") };
    const fila = {
      focus: () => registro.push("fila"),
      querySelector: (sel: string) => { registro.push(sel); return boton; },
    };
    expect(enfocarTrasMover(fila, "subir", 0, 4)).toBe(boton);
    expect(registro).toEqual([selectorAccionOrden("bajar"), "boton"]);
    registro.length = 0;
    expect(enfocarTrasMover(fila, "bajar", 0, 1)).toBe(fila);
    expect(registro).toEqual(["fila"]);
  });
});
