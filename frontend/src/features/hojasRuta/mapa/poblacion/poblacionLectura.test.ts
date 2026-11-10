import { describe, expect, it } from "vitest";
import type { FilaMatriz } from "./matriz";
import { filasEnOrden, tonoDeRango } from "./PoblacionLectura";

const fila = (ubigeo: string, total: number): FilaMatriz => ({ ubigeo, territorio: ubigeo, porRango: [], total });

describe("columna de Población", () => {
  it("los rangos van del tono 1 al 5: el escalón 0 no se distingue del fondo del panel", () => {
    expect([0, 1, 2, 3].map((i) => tonoDeRango(i, 4))).toEqual([1, 2, 4, 5]);
    expect(tonoDeRango(0, 1)).toBe(3);
    expect(Math.min(...[0, 1, 2, 3, 4, 5].map((i) => tonoDeRango(i, 6)))).toBe(1);
  });

  it("los distritos salen en el orden en que se eligieron (el de su color en el mapa)", () => {
    const filas = [fila("150103", 400), fila("150135", 900), fila("150108", 200)];
    expect(filasEnOrden(filas, ["150135", "150108", "150103"]).map((f) => f.ubigeo)).toEqual(["150135", "150108", "150103"]);
    // Uno fuera del orden va al final, y entre ellos el más poblado primero.
    expect(filasEnOrden([...filas, fila("150999", 50)], ["150108"]).map((f) => f.ubigeo)).toEqual(["150108", "150135", "150103", "150999"]);
  });
});
