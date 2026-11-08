import { describe, expect, it } from "vitest";
import { nivelQueCabe } from "./barraCompacta";

describe("R9-3: la barra del visor sube de nivel hasta que cabe", () => {
  // Anchos que pide la barra por nivel (869 sin compactar, como a 1280 con Previsualizar e Inspector).
  const pide = [869, 830, 790, 740];
  const medir = (disponible: number) => {
    let actual = 0;
    return nivelQueCabe((n) => { actual = n; }, () => pide[actual] > disponible);
  };
  it("cabe sin compactar si hay ancho", () => expect(medir(900)).toBe(0));
  it("a 806 px oculta hasta los rótulos estrechos", () => expect(medir(806)).toBe(2));
  it("si ni el último cabe, queda el último", () => expect(medir(600)).toBe(3));
});
