// Mata: ofrecer decimales más allá del máximo del registro, perder un valor guardado fuera de la lista o convertir en
// botones un número abierto (máximo de categorías).
import { describe, expect, it } from "vitest";
import { opcionesNumeroEnBotones } from "./numerosEnBotones";

const v = (o: ReturnType<typeof opcionesNumeroEnBotones>) => o?.map((x) => x.rotulo) ?? null;

describe("números de la tarjeta en botones", () => {
  it("decimales de 0 al máximo del registro, con tope en 3", () => {
    expect(v(opcionesNumeroEnBotones({ name: "decimales_promedio", min: 0, max: 2 }, undefined))).toEqual(["0", "1", "2"]);
    expect(v(opcionesNumeroEnBotones({ name: "decimales", min: 0, max: 4 }, 1))).toEqual(["0", "1", "2", "3"]);
  });
  it("el nivel de significancia en sus tres valores habituales, y el guardado raro se conserva", () => {
    expect(v(opcionesNumeroEnBotones({ name: "alpha", min: 0.001, max: 0.2 }, 0.05))).toEqual(["0.10", "0.05", "0.01"]);
    expect(v(opcionesNumeroEnBotones({ name: "alpha", min: 0.001, max: 0.2 }, 0.02))).toEqual(["0.10", "0.05", "0.02", "0.01"]);
  });
  it("un número abierto sigue siendo un campo", () => {
    expect(opcionesNumeroEnBotones({ name: "max_categorias", min: 1, max: 30 }, 5)).toBeNull();
  });
});
