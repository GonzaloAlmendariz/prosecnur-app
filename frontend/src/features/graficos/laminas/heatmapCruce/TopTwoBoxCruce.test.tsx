// @vitest-environment happy-dom
// «Columna Top Two Box» del mapa de calor por cruce (ADR 0137): Automática / Sí / No escriben en `overrides`, que es lo
// que el motor lee; con «No» las categorías no se muestran.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const CATEGORIAS = [
  { codigo: "1", etiqueta: "En desacuerdo", n: 10 }, { codigo: "2", etiqueta: "De acuerdo", n: 20 },
  { codigo: "3", etiqueta: "Totalmente de acuerdo", n: 5 },
];
vi.mock("../useCategoriasGrafico", () => ({
  useCategoriasGrafico: () => ({ fase: "lista", datos: { categorias: CATEGORIAS }, reintentar: () => undefined }),
}));
vi.mock("../useRotulosCortos", () => ({ useRotulosCortos: () => ({}) }));
const { TopTwoBoxCruce } = await import("./TopTwoBoxCruce");

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const radios = () => [...host.querySelectorAll<HTMLElement>("[role='radio']")];

describe("TopTwoBoxCruce", () => {
  it("arranca en Automática, escribe el modo en overrides y declara su superficie", () => {
    const parches: Record<string, unknown>[] = [];
    act(() => root.render(<TopTwoBoxCruce id="t" args={{ overrides: { etiquetas_vars: { p1: "C" } } }} variable="" scope="active" onCambio={(p) => parches.push(p)} />));
    expect(host.querySelector("[data-qa='heatmap-cruce-top2box']")?.getAttribute("data-qa-geometry-contract")).toBe("intrinsic");
    expect(radios().map((r) => r.textContent)).toEqual(["Automática", "Sí", "No"]);
    expect(radios()[0].getAttribute("aria-checked")).toBe("true");
    act(() => radios()[2].click());
    expect(parches).toEqual([{ overrides: { etiquetas_vars: { p1: "C" }, top2box: false } }]);
    // Sin pregunta, las categorías dicen su vacío dentro del control (C3).
    expect(host.textContent).toContain("Elige primero la pregunta");
  });

  it("las categorías se guardan por su rótulo exacto en overrides", () => {
    const parches: Record<string, unknown>[] = [];
    act(() => root.render(<TopTwoBoxCruce id="t" args={{}} variable="b1$p5" scope="active" onCambio={(p) => parches.push(p)} />));
    const ficha = [...host.querySelectorAll<HTMLButtonElement>("button.pulso-f6-cat")].find((b) => b.textContent?.startsWith("De acuerdo"))!;
    act(() => ficha.click());
    expect(parches).toEqual([{ overrides: { top2box_labels: ["De acuerdo"] } }]);
  });

  it("con «No» guardado no muestra las categorías", () => {
    act(() => root.render(<TopTwoBoxCruce id="t" args={{ overrides: { top2box: false } }} variable="" scope="active" onCambio={() => {}} />));
    expect(radios()[2].getAttribute("aria-checked")).toBe("true");
    expect(host.textContent).not.toContain("Categorías del Top Two Box");
  });
});
