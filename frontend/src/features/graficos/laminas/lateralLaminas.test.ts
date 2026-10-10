import { describe, expect, it } from "vitest";
import { resolverLateral } from "./lateralLaminas";

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
