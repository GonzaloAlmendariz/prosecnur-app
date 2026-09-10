import { describe, expect, it } from "vitest";
import { marcasDelEjeDeDias } from "./marcasDelEjeDeDias";

/** Veinticinco días de horizonte con campo en los cuatro primeros. */
const horizonte = Array.from({ length: 25 }, (_, i) => ({ esDeCampo: i < 4 }));

describe("marcasDelEjeDeDias", () => {
  it("los días CON BARRA llevan fecha siempre", () => {
    // El defecto medido: con «uno de cada tres» el 08 y el 09 —el mejor día del
    // operativo, con 466— se quedaban sin rótulo bajo su propia barra.
    const marcas = marcasDelEjeDeDias(horizonte);
    expect(marcas).toEqual(expect.arrayContaining([0, 1, 2, 3]));
  });

  it("los extremos también, que son los que anclan la lectura", () => {
    const marcas = marcasDelEjeDeDias(horizonte);
    expect(marcas[0]).toBe(0);
    expect(marcas.at(-1)).toBe(24);
  });

  it("ningún par de rótulos queda a menos de la separación pedida", () => {
    const marcas = marcasDelEjeDeDias(
      Array.from({ length: 30 }, (_, i) => ({ esDeCampo: i === 10 })),
      { separacion: 3 },
    );
    // Salvo entre los que son obligatorios entre sí, que es el precio declarado
    // de no perder una barra: aquí no hay barras adyacentes.
    for (let k = 1; k < marcas.length; k += 1) {
      expect(marcas[k] - marcas[k - 1]).toBeGreaterThanOrEqual(3);
    }
  });

  it("con pocos días se rotulan todos", () => {
    expect(marcasDelEjeDeDias(Array.from({ length: 6 }, () => ({ esDeCampo: true }))))
      .toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("no pasa del tope, para que no se amontonen", () => {
    const marcas = marcasDelEjeDeDias(Array.from({ length: 60 }, () => ({ esDeCampo: false })), { tope: 8 });
    expect(marcas.length).toBeLessThanOrEqual(8);
  });

  it("un eje sin días no inventa marcas", () => {
    expect(marcasDelEjeDeDias([])).toEqual([]);
  });

  it("cuando TODOS tienen campo, todos llevan fecha aunque pasen del tope", () => {
    // Es deliberado: una barra sin fecha es peor que un eje apretado, y este
    // caso sólo ocurre en un operativo largo y continuo.
    const marcas = marcasDelEjeDeDias(Array.from({ length: 20 }, () => ({ esDeCampo: true })), { tope: 8 });
    expect(marcas.length).toBe(20);
  });
});
