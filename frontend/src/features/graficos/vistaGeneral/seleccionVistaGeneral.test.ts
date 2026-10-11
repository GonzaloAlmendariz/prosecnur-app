import { describe, expect, it } from "vitest";
import {
  objetivoDeAccion,
  reconciliarSeleccionVG,
  seleccionar,
  seleccionarTodo,
  SELECCION_VACIA,
} from "./seleccionVistaGeneral";

const orden = ["a", "b", "c", "d", "e"];

describe("multiselección de la Vista general", () => {
  // Mata: clic simple que acumula, o que no mueve el ancla.
  it("clic elige sólo esa lámina y la deja de ancla", () => {
    expect(seleccionar({ ids: ["a", "c"], ancla: "a" }, "d", "unica", orden)).toEqual({ ids: ["d"], ancla: "d" });
  });

  // Mata: Ctrl/Cmd+clic que reemplaza en vez de alternar, o que deja la selección fuera del orden del plan.
  it("Ctrl/Cmd+clic agrega o quita y conserva el orden del plan", () => {
    const una = seleccionar(SELECCION_VACIA, "d", "alternar", orden);
    const dos = seleccionar(una, "b", "alternar", orden);
    expect(dos).toEqual({ ids: ["b", "d"], ancla: "b" });
    expect(seleccionar(dos, "d", "alternar", orden)).toEqual({ ids: ["b"], ancla: "d" });
  });

  // Mata: rango que mueve el ancla, que no funciona hacia atrás o que deja un extremo fuera.
  it("Mayús+clic elige el tramo desde el ancla, en cualquier dirección, sin mover el ancla", () => {
    const desdeB = seleccionar(SELECCION_VACIA, "b", "unica", orden);
    const rango = seleccionar(desdeB, "d", "rango", orden);
    expect(rango).toEqual({ ids: ["b", "c", "d"], ancla: "b" });
    expect(seleccionar(rango, "a", "rango", orden)).toEqual({ ids: ["a", "b"], ancla: "b" });
    expect(seleccionar(SELECCION_VACIA, "c", "rango", orden)).toEqual({ ids: ["c"], ancla: "c" });
  });

  // Mata: ignorar un id que no está en el plan como si fuera válido.
  it("una lámina que no está no cambia nada", () => {
    const actual = { ids: ["a"], ancla: "a" };
    expect(seleccionar(actual, "zz", "unica", orden)).toBe(actual);
  });

  // Mata: conservar ids eliminados (acciones en bloque sobre láminas que ya no existen) o romper la identidad sin cambios.
  it("tras cambiar el plan se olvidan las que ya no están", () => {
    const actual = { ids: ["b", "d"], ancla: "d" };
    expect(reconciliarSeleccionVG(actual, ["d", "a", "b"])).toEqual({ ids: ["d", "b"], ancla: "d" });
    expect(reconciliarSeleccionVG(actual, ["a", "b"])).toEqual({ ids: ["b"], ancla: "b" });
    const igual = { ids: ["a", "b"], ancla: "a" };
    expect(reconciliarSeleccionVG(igual, orden)).toBe(igual);
    expect(seleccionarTodo(orden)).toEqual({ ids: orden, ancla: "a" });
  });

  // Mata: arrastrar una tarjeta no elegida y llevarse la selección ajena.
  it("la acción va sobre la selección sólo si la incluye", () => {
    const sel = { ids: ["b", "c"], ancla: "b" };
    expect(objetivoDeAccion(sel, "c")).toEqual(["b", "c"]);
    expect(objetivoDeAccion(sel, "e")).toEqual(["e"]);
    expect(objetivoDeAccion(sel, null)).toEqual(["b", "c"]);
    expect(objetivoDeAccion(SELECCION_VACIA, null)).toEqual([]);
  });
});
