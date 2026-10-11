import { describe, expect, it } from "vitest";
import { resolverFocoLamina } from "../focoLamina";
import { reconciliarSeleccion, vecinaAlEliminar } from "./seleccionLamina";

const ids = ["a", "b", "c", "d"];

/** Lo que hace LaminasWorkbench: resuelve el `foco` con la función compartida y reconcilia. */
const conFoco = (foco: string | null, lista: readonly string[], focoCambio: boolean, selectedId: string | null) => {
  const r = resolverFocoLamina(foco, lista.map((id) => ({ id })));
  return reconciliarSeleccion({ ids: lista, focoId: r?.id ?? null, focoHeredado: r?.heredado ?? false, focoCambio, selectedId });
};

describe("reconciliarSeleccion", () => {
  it("un foco nuevo (enlace o clic) selecciona su lámina", () => {
    expect(conFoco("c", ids, true, "a")).toEqual({ posicion: 3, seleccionar: "c", escribirFoco: false });
  });

  // Mata: volver al foco por posición (tras Alt+↑ el enlace apuntaría a la vecina) o reescribir un foco que ya sirve.
  it("reordenar no mueve el enlace: sigue en la misma lámina y no se reescribe", () => {
    // «c» estaba en la 3 y subió a la 2: el foco sigue diciendo «c».
    const movido = ["a", "c", "b", "d"];
    expect(conFoco("c", movido, false, "c")).toEqual({ posicion: 2, seleccionar: null, escribirFoco: false });
    // Aunque el foco se lea de nuevo (otra pestaña abre el enlace guardado), sigue siendo «c».
    expect(conFoco("c", movido, true, null)).toEqual({ posicion: 2, seleccionar: "c", escribirFoco: false });
  });

  it("la ranura del foco no cuenta como foco distinto de su lámina", () => {
    expect(conFoco("c:g2", ["a", "c", "b"], false, "c")).toEqual({ posicion: 2, seleccionar: null, escribirFoco: false });
  });

  it("duplicar selecciona la copia y el foco la sigue", () => {
    const conCopia = ["a", "b", "b2", "c", "d"];
    expect(conFoco("b", conCopia, false, "b2")).toEqual({ posicion: 3, seleccionar: null, escribirFoco: true });
  });

  // Mata: dejar de leer `l-NN` o no reescribirlo al id.
  it("el `l-NN` heredado se resuelve por posición una vez y se pide reescribirlo", () => {
    expect(conFoco("l-03", ids, true, "a")).toEqual({ posicion: 3, seleccionar: "c", escribirFoco: true });
    // Ya reescrito a «c», reordenar no lo desvía.
    expect(conFoco("c", ["c", "a", "b", "d"], false, "c")).toEqual({ posicion: 1, seleccionar: null, escribirFoco: false });
  });

  it("sin selección válida usa el foco; sin foco, la primera", () => {
    expect(conFoco("d", ids, false, "zz")).toEqual({ posicion: 4, seleccionar: "d", escribirFoco: false });
    expect(conFoco(null, ids, true, null)).toEqual({ posicion: 1, seleccionar: "a", escribirFoco: true });
  });

  // Mata: romper con un id que no existe (borrado, o de otro proyecto).
  it("un id inexistente cae a la seleccionada o a la primera sin romper", () => {
    expect(conFoco("s-borrada", ids, true, null)).toEqual({ posicion: 1, seleccionar: "a", escribirFoco: true });
    expect(conFoco("s-borrada", ids, true, "b")).toEqual({ posicion: 2, seleccionar: null, escribirFoco: true });
  });

  it("un `l-NN` fuera de rango no gana aunque sea nuevo", () => {
    expect(conFoco("l-99", ids, true, "b")).toEqual({ posicion: 2, seleccionar: null, escribirFoco: true });
  });

  it("plan vacío", () => {
    expect(conFoco("l-02", [], true, null).posicion).toBeNull();
  });
});

describe("vecinaAlEliminar", () => {
  it("la siguiente, o la anterior si era la última", () => {
    expect(vecinaAlEliminar(ids, "b")).toBe("c");
    expect(vecinaAlEliminar(ids, "d")).toBe("c");
    expect(vecinaAlEliminar(["a"], "a")).toBeNull();
  });
});
