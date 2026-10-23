import { describe, expect, it } from "vitest";
import { escalaDeEje } from "./escalaDeEje";

describe("escala de un eje", () => {
  it("da marcas redondas con holgura sobre el máximo", () => {
    expect(escalaDeEje(133)).toEqual({ tope: 150, marcas: [0, 50, 100, 150] });
    expect(escalaDeEje(423)).toEqual({ tope: 500, marcas: [0, 100, 200, 300, 400, 500] });
    expect(escalaDeEje(356)).toEqual({ tope: 400, marcas: [0, 100, 200, 300, 400] });
    expect(escalaDeEje(16)).toEqual({ tope: 20, marcas: [0, 5, 10, 15, 20] });
  });

  it("agrega una marca si el máximo cae justo en el tope", () => {
    expect(escalaDeEje(100).tope).toBe(120);
    expect(escalaDeEje(0)).toEqual({ tope: 1, marcas: [0, 1] });
  });
});
