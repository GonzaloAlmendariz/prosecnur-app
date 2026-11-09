// @vitest-environment happy-dom
// Ronda 18, ítem 3: la variable de la cobertura por categorías se elige sólo entre las bases de la lámina y se guarda con
// el prefijo de la base que cuenta (sin prefijo se resolvía contra la base activa del informe).
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test, vi } from "vitest";
import type { VarWithSource } from "../useVariables";

const v = (name: string, label: string, source: string): VarWithSource => ({ name, label, tipo: "select_one", seccion: "", list_name: "l", source });
const variables: VarWithSource[] = [v("sexo", "Sexo", "docentes"), v("sexo", "Sexo", "estudiantes"), v("ciclo", "Ciclo", "estudiantes"), v("sexo", "Sexo", "egresados")];
const sources = ["docentes", "estudiantes", "egresados"].map((name) => ({ name, variables: variables.filter((x) => x.source === name) }));
vi.mock("../useVariables", async (orig) => ({
  ...(await orig<typeof import("../useVariables")>()),
  useVariables: () => ({ sources, multi: true, variables, relacionBases: null, baseActiva: "docentes", scope: "active", loading: false, error: "" }),
}));

describe("VariablePicker con `soloBases`", () => {
  test("ofrece sólo las bases elegidas y guarda la pregunta con el prefijo de su base", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const { default: VariablePicker } = await import("../VariablePicker");
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const onChange = vi.fn();
    act(() => root.render(createElement(MemoryRouter, null,
      createElement(VariablePicker, { value: null, onChange, soloBases: ["estudiantes", "egresados"], fuenteInicial: "estudiantes" }))));
    act(() => host.querySelector<HTMLButtonElement>(".pulso-gv2-variable-trigger")?.click());
    const bases = [...document.querySelectorAll('[aria-label="Bases disponibles"] button span')].map((b) => b.textContent);
    expect(bases).toEqual(["estudiantes", "egresados"]);
    const opcion = [...document.querySelectorAll<HTMLButtonElement>('[aria-label="Preguntas disponibles"] button')].find((b) => b.textContent?.includes("Ciclo"));
    expect(opcion).toBeTruthy();
    act(() => opcion?.click());
    expect(onChange).toHaveBeenCalledWith("estudiantes$ciclo");
    act(() => root.unmount());
    host.remove();
  });
});
