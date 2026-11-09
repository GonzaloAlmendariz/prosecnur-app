// @vitest-environment happy-dom
// Ítem 10 (2026-11-08): un solo control de realce en barras agrupadas y categóricas. «La más alta» es la primera ficha de
// «Destacar» y es excluyente con las respuestas; el interruptor aparte ya no existe.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GraficadorRef } from "../../../api/graficos";
import { DestacarRespuestas, estadoDestacar } from "./DestacarRespuestas";

const parches: Record<string, unknown>[] = [];
const ESTADO = { updateSlotArgs: (_s: string, _k: string, p: Record<string, unknown>) => { parches.push(p); }, plan: { rotulos_cortos: undefined } };
vi.mock("../store", () => ({ usePlanStore: (sel: (s: typeof ESTADO) => unknown) => sel(ESTADO) }));
vi.mock("../useVariables", () => ({
  parseVarRef: (r: string) => ({ name: r, source: null }),
  useVariables: () => ({ variables: [{ name: "p1", source: "b1", choices: [{ name: "1", label: "Sí" }, { name: "2", label: "No" }] }] }),
}));

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  parches.length = 0;
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

const pintar = (args: Record<string, unknown>, graficador = "p_barras_categoricas") => {
  const valor: GraficadorRef = { graficador, args: { var: "p1", ...args } };
  act(() => root.render(<DestacarRespuestas slideId="s1" slot="g" valor={valor} />));
  return [...host.querySelectorAll<HTMLButtonElement>(".pulso-f6-destacar .pulso-chip-seleccion__alternar")];
};

describe("Destacar con «La más alta»", () => {
  it("la primera ficha es «La más alta» y, encendida, rige sobre ninguna respuesta", () => {
    const fichas = pintar({ overrides: { resaltar_mayor: true } });
    expect(fichas.map((b) => `${b.textContent}:${b.getAttribute("aria-pressed")}`)).toEqual(["La más alta:true", "Sí:false", "No:false"]);
    expect(host.textContent).not.toContain("Sin elegir");
  });
  it("pulsarla suelta las respuestas elegidas en un solo cambio", () => {
    const [mayor] = pintar({ overrides: { resaltar_opciones: ["Sí"] } });
    act(() => mayor.click());
    expect(parches).toEqual([{ overrides: { resaltar_mayor: true } }]);
  });
  it("elegir una respuesta apaga la mayor", () => {
    const fichas = pintar({ overrides: { resaltar_mayor: true } });
    act(() => fichas[2].click());
    expect(parches).toEqual([{ overrides: { resaltar_opciones: ["No"] } }]);
  });
  it("el ranking con puntos no tiene «La más alta»", () => {
    expect(pintar({}, "p_lollipop").map((b) => b.textContent)).toEqual(["Sí", "No"]);
  });
  it("R6-6: la línea de estado está siempre, sin elegir y con lo elegido (la fila no cambia de alto)", () => {
    const estado = () => host.querySelectorAll('[data-qa="destacar-estado"]');
    pintar({});
    expect(estado()).toHaveLength(1);
    expect(estado()[0].textContent).toBe("Sin elegir, todas van del mismo color.");
    pintar({ overrides: { resaltar_opciones: ["Sí"] } });
    expect(estado()).toHaveLength(1);
    expect(estado()[0].textContent).toBe("1 destacada; las demás, en tenue.");
  });
  it("R6-6: lo que dice la línea de estado en cada caso", () => {
    expect(estadoDestacar("override", 0, true)).toBe("La más alta, resaltada; las demás, en tenue.");
    expect(estadoDestacar("override", 2, false)).toBe("2 destacadas; las demás, en tenue.");
    expect(estadoDestacar("arg", 0, false)).toBe("Sin elegir, ninguna se destaca.");
    expect(estadoDestacar("arg", 1, false)).toBe("1 destacada en el color de énfasis.");
  });
});
