import { describe, expect, it } from "vitest";
import { reconciliarSeleccion, vecinaAlEliminar } from "./seleccionLamina";

const ids = ["a", "b", "c", "d"];

describe("reconciliarSeleccion", () => {
  it("un foco nuevo (enlace o clic) selecciona su lámina", () => {
    expect(reconciliarSeleccion({ ids, focoPos: 3, focoCambio: true, selectedId: "a" }))
      .toEqual({ posicion: 3, seleccionar: "c", escribirFoco: false });
  });

  it("si cambió el plan, la lámina seleccionada manda y el foco se reescribe (mover con Alt+↑)", () => {
    // «c» estaba en la 3 y subió a la 2: el foco sigue diciendo 3.
    const movido = ["a", "c", "b", "d"];
    expect(reconciliarSeleccion({ ids: movido, focoPos: 3, focoCambio: false, selectedId: "c" }))
      .toEqual({ posicion: 2, seleccionar: null, escribirFoco: true });
  });

  it("duplicar selecciona la copia y el foco la sigue", () => {
    const conCopia = ["a", "b", "b2", "c", "d"];
    expect(reconciliarSeleccion({ ids: conCopia, focoPos: 2, focoCambio: false, selectedId: "b2" }))
      .toEqual({ posicion: 3, seleccionar: null, escribirFoco: true });
  });

  it("sin selección válida usa el foco; sin foco, la primera", () => {
    expect(reconciliarSeleccion({ ids, focoPos: 4, focoCambio: false, selectedId: "zz" }))
      .toEqual({ posicion: 4, seleccionar: "d", escribirFoco: false });
    expect(reconciliarSeleccion({ ids, focoPos: null, focoCambio: true, selectedId: null }))
      .toEqual({ posicion: 1, seleccionar: "a", escribirFoco: true });
  });

  it("un foco fuera de rango no gana aunque sea nuevo", () => {
    expect(reconciliarSeleccion({ ids, focoPos: 99, focoCambio: true, selectedId: "b" }))
      .toEqual({ posicion: 2, seleccionar: null, escribirFoco: true });
  });

  it("plan vacío", () => {
    expect(reconciliarSeleccion({ ids: [], focoPos: 2, focoCambio: true, selectedId: null }).posicion).toBeNull();
  });
});

describe("vecinaAlEliminar", () => {
  it("la siguiente, o la anterior si era la última", () => {
    expect(vecinaAlEliminar(ids, "b")).toBe("c");
    expect(vecinaAlEliminar(ids, "d")).toBe("c");
    expect(vecinaAlEliminar(["a"], "a")).toBeNull();
  });
});
