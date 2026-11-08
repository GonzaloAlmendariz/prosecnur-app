import { describe, expect, it } from "vitest";
import { lateralVisible, resolverLateral } from "./lateralLaminas";

describe("resolverLateral", () => {
  it("la URL manda y pone al día la preferencia", () => {
    expect(resolverLateral("inspector", "estructura")).toEqual({ lateral: "inspector", escribirEnUrl: false, actualizarPreferencia: true });
    expect(resolverLateral("estructura", "estructura")).toEqual({ lateral: "estructura", escribirEnUrl: false, actualizarPreferencia: false });
  });
  it("sin panel en la URL, la preferencia se abre y se escribe (enlazable); con ambos cerrados no se escribe nada", () => {
    expect(resolverLateral(null, "estructura")).toEqual({ lateral: "estructura", escribirEnUrl: true, actualizarPreferencia: false });
    expect(resolverLateral(null, null)).toEqual({ lateral: null, escribirEnUrl: false, actualizarPreferencia: false });
  });
  it("un panel ajeno (avisos, biblioteca) no cierra el lateral recordado", () => {
    expect(resolverLateral("biblioteca-graficadores", "inspector")).toEqual({ lateral: "inspector", escribirEnUrl: false, actualizarPreferencia: false });
    expect(resolverLateral("avisos", "estructura").lateral).toBe("estructura");
  });
});

describe("lateralVisible (R7-3 y C1 del acabado)", () => {
  it("con Avisos abierto el Inspector no se ve; al cerrarlo vuelve", () => {
    expect(lateralVisible("inspector", true)).toBeNull();
    expect(lateralVisible("inspector", false)).toBe("inspector");
  });
  it("C1: la Estructura tampoco convive con Avisos; al cerrarlo vuelve", () => {
    expect(lateralVisible("estructura", true)).toBeNull();
    expect(lateralVisible("estructura", false)).toBe("estructura");
    expect(lateralVisible(null, true)).toBeNull();
    expect(lateralVisible(null, false)).toBeNull();
  });
  it("C1: nunca hay dos laterales a la vez", () => {
    for (const l of ["estructura", "inspector", null] as const) {
      for (const avisos of [true, false]) {
        const abiertos = [lateralVisible(l, avisos), avisos ? "avisos" : null].filter(Boolean);
        expect(abiertos.length).toBeLessThanOrEqual(1);
      }
    }
  });
});
