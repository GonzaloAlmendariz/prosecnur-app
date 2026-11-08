// @vitest-environment happy-dom
// Ítem 3 (2026-11-08): pasar el cursor por un modo muestra ese orden en la lista sin guardarlo; mover cualquier fila en un
// modo fijo pasa a «A mano» partiendo del orden visible.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GraficosCategorias } from "../../../api/graficos";
import { OrdenCategoriasGrafico } from "./OrdenCategoriasGrafico";
import type { OrdenCategorias } from "./ordenCategorias";

const datos: GraficosCategorias = {
  var: "p7", base: "", pregunta: "", ordinal: false, tipo: "select_one", modo_recetario: "frecuencia",
  categorias: [
    { codigo: "1", etiqueta: "Alfa", n: 3, pct: 0.3, residual: false },
    { codigo: "2", etiqueta: "Beta", n: 5, pct: 0.5, residual: false },
    { codigo: "3", etiqueta: "Gama", n: 1, pct: 0.1, residual: false },
  ],
  orden: { recetario: ["2", "1", "3"], instrumento: ["1", "2", "3"], frecuencia: ["2", "1", "3"] },
  avisos: [],
};
vi.mock("./useCategoriasGrafico", () => ({ useCategoriasGrafico: () => ({ fase: "lista", datos, reintentar: () => undefined }) }));
vi.mock("../store", () => ({ usePlanStore: (sel: (s: { plan: { rotulos_cortos?: Record<string, string> } }) => unknown) => sel({ plan: {} }) }));

const cambios: (OrdenCategorias | null)[] = [];
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  cambios.length = 0;
  act(() => root.render(
    <OrdenCategoriasGrafico variable="b$p7" graficador="p_barras_categoricas" args={{ var: "p7" }} scope="active" onCambio={(o) => { cambios.push(o); }} />,
  ));
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

const etiquetas = () => [...host.querySelectorAll(".pulso-f6-orden-etiqueta")].map((e) => e.textContent);
const segmento = (texto: string) => [...host.querySelectorAll<HTMLButtonElement>('[role="radio"]')].find((b) => b.textContent === texto)!;

describe("Orden: vista previa y paso a «A mano»", () => {
  it("al pasar el cursor por «Instrumento» la lista muestra ese orden sin guardarlo; al salir vuelve", () => {
    expect(etiquetas()).toEqual(["Beta", "Alfa", "Gama"]);
    act(() => { segmento("Instrumento").dispatchEvent(new MouseEvent("mouseover", { bubbles: true })); });
    expect(etiquetas()).toEqual(["Alfa", "Beta", "Gama"]);
    expect(host.querySelector('[data-qa="orden-dicho"]')?.textContent).toBe("Vista previa: Como el instrumento");
    expect(host.querySelector(".pulso-f6-orden-lista")?.className).toContain("is-vista");
    expect(cambios).toEqual([]);
    act(() => { host.querySelector("fieldset")!.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, relatedTarget: document.body })); });
    expect(etiquetas()).toEqual(["Beta", "Alfa", "Gama"]);
  });
  it("el clic en un segmento guarda ese modo", () => {
    act(() => segmento("Instrumento").click());
    expect(cambios).toEqual([{ modo: "instrumento", lista: [], invertir: false }]);
  });
  it("bajar una fila en Recetario pasa a «A mano» desde el orden visible", () => {
    act(() => host.querySelector<HTMLButtonElement>('[aria-label="Bajar “Beta”"]')!.click());
    expect(cambios).toEqual([{ modo: "personalizado", lista: ["1", "2", "3"], invertir: false }]);
  });
});
