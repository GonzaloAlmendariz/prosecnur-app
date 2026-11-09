// La tabla del universo de una base (ADR 0140): «Conteos / Porcentajes», el total sólo en conteos, una fila por
// categoría con su n (también n = 0), el aviso de la suma en vivo y el universo viejo con «Rellenar».
// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CategoriasDeBase } from "../../../../api/graficosCoberturaCategorias";
import { BloqueUniversoBase } from "./BloqueUniversoBase";
import type { UniversoBase } from "./modeloUniversoCategorias";

const BASE: CategoriasDeBase = {
  base: "estudiantes", variable_usada: "p6", recodificada: false, n_encuestados: 120, n_validos: 115,
  categorias: [{ codigo: "1", etiqueta: "Primer ciclo", n: 70 }, { codigo: "2", etiqueta: "Segundo ciclo", n: 45 }, { codigo: "3", etiqueta: "Tercer ciclo", n: 0 }],
  especiales: [],
};

let cont: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  cont = document.createElement("div");
  document.body.appendChild(cont);
  root = createRoot(cont);
});
afterEach(() => { act(() => root.unmount()); cont.remove(); });

const pintar = (guardado: UniversoBase | undefined, onCambio = vi.fn()) => {
  act(() => root.render(<BloqueUniversoBase base="estudiantes" variableLamina="p6" guardado={guardado} deLaBase={BASE} onCambio={onCambio} />));
  return onCambio;
};

function teclear(input: HTMLInputElement, valor: string) {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  act(() => { set?.call(input, valor); input.dispatchEvent(new Event("input", { bubbles: true })); });
}

describe("BloqueUniversoBase", () => {
  it("prellena una fila por categoría, también la de n = 0, con el total en conteos", () => {
    pintar(undefined);
    const filas = [...cont.querySelectorAll("tbody tr")].map((tr) => tr.textContent);
    expect(filas).toEqual(["Primer ciclo70", "Segundo ciclo45", "Tercer ciclo0"]);
    expect(cont.querySelector('[aria-label="Total del universo de Estudiantes"]')).not.toBeNull();
    expect(cont.textContent).toContain("Universo (casos)");
    expect(cont.textContent).not.toContain("Universo viejo");
  });

  it("teclear guarda todas las filas, lo tecleado y la variable contada", () => {
    const onCambio = pintar(undefined);
    teclear(cont.querySelector<HTMLInputElement>('[aria-label="Universo de Tercer ciclo en Estudiantes"]')!, "40");
    expect(onCambio).toHaveBeenLastCalledWith({
      modo: "conteos", total: null, variable: "p6",
      categorias: [
        { codigo: "1", etiqueta: "Primer ciclo", valor: null }, { codigo: "2", etiqueta: "Segundo ciclo", valor: null },
        { codigo: "3", etiqueta: "Tercer ciclo", valor: 40 },
      ],
    });
  });

  it("en porcentajes no hay total y el aviso de la suma va en vivo, sin bloquear", () => {
    pintar({ modo: "porcentajes", total: null, variable: "p6", categorias: [{ codigo: "1", etiqueta: "", valor: 60 }, { codigo: "2", etiqueta: "", valor: 30 }] });
    expect(cont.querySelector('[aria-label="Total del universo de Estudiantes"]')).toBeNull();
    expect([...cont.querySelectorAll('[role="status"]')].map((x) => x.textContent).join(" ")).toMatch(/suman 90 %/);
    expect(cont.querySelectorAll("tbody input")).toHaveLength(3);
  });

  it("universo viejo: lo guardado se muestra con su aviso y «Rellenar» trae las categorías actuales", () => {
    const onCambio = pintar({ modo: "conteos", total: 10, variable: "gedad", categorias: [{ codigo: "8", etiqueta: "60 a más", valor: 10 }] });
    expect(cont.textContent).toContain('Universo viejo: se tecleó para "gedad" y la lámina usa "p6".');
    expect([...cont.querySelectorAll("tbody tr")].map((tr) => tr.textContent)).toEqual(["60 a más—"]);
    const boton = [...cont.querySelectorAll("button")].find((b) => b.textContent?.includes("Rellenar"));
    act(() => boton?.click());
    expect(onCambio).toHaveBeenLastCalledWith(expect.objectContaining({ variable: "p6", categorias: expect.arrayContaining([{ codigo: "3", etiqueta: "Tercer ciclo", valor: null }]) }));
  });

  it("ronda 19 (O1): pasar de conteos a % convierte las cifras sobre el total y lo dice; no las reinterpreta", () => {
    const onCambio = pintar({ modo: "conteos", total: 200, variable: "p6", categorias: [{ codigo: "1", etiqueta: "", valor: 30 }, { codigo: "2", etiqueta: "", valor: 170 }] });
    const pct = [...cont.querySelectorAll<HTMLElement>('[role="radio"]')].find((b) => b.textContent?.includes("Porcentajes"));
    act(() => pct?.click());
    expect(onCambio).toHaveBeenLastCalledWith(expect.objectContaining({
      modo: "porcentajes", total: null,
      categorias: [{ codigo: "1", etiqueta: "Primer ciclo", valor: 15 }, { codigo: "2", etiqueta: "Segundo ciclo", valor: 85 }, { codigo: "3", etiqueta: "Tercer ciclo", valor: null }],
    }));
    expect(cont.textContent).toContain("Los conteos pasaron a % sobre el total (200).");
  });
});
