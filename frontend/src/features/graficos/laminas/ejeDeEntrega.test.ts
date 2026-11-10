import { describe, expect, it } from "vitest";
import { distanciaAlEje } from "./ejeDeEntrega";

describe("distanciaAlEje", () => {
  it("lleva el borde derecho del contenedor al del botón (H3: a 1440 colgaba del borde de la barra)", () => {
    // Medidas de la captura a 1440: barra hasta x=1417, botón de descarga de x=1007 a 1035.
    expect(distanciaAlEje({ right: 1417 }, { right: 1035 })).toBe(382);
  });

  it("con el botón al borde, el contenedor queda al borde; nunca se corre hacia fuera", () => {
    expect(distanciaAlEje({ right: 1000 }, { right: 1000 })).toBe(0);
    expect(distanciaAlEje({ right: 1000 }, { right: 1012.4 })).toBe(0);
    expect(distanciaAlEje({ right: 1000.6 }, { right: 900 })).toBe(101);
  });
});
