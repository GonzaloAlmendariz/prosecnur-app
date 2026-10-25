import { describe, expect, it } from "vitest";
import { cajaProyectada, candidatosDeCaja, ubicarRotulos } from "./rotulosDelMapa";

describe("ubicarRotulos", () => {
  it("deja el rótulo en su punto cuando no pisa nada", () => {
    const [rotulo] = ubicarRotulos([{ clave: "a", texto: "Ate", candidatos: [{ x: 100, y: 100 }, { x: 100, y: 40 }] }], [{ x: 300, y: 300 }]);
    expect(rotulo).toMatchObject({ x: 100, y: 100 });
  });

  it("lo mueve al candidato libre cuando su punto cae sobre manzanas", () => {
    const puntos = [{ x: 100, y: 96 }, { x: 110, y: 98 }];
    const [rotulo] = ubicarRotulos([{ clave: "a", texto: "Los Olivos", candidatos: [{ x: 100, y: 100 }, { x: 100, y: 40 }] }], puntos);
    expect(rotulo).toMatchObject({ x: 100, y: 40 });
  });

  it("no encima un nombre sobre otro", () => {
    const [, segundo] = ubicarRotulos([
      { clave: "a", texto: "Chorrillos", candidatos: [{ x: 100, y: 100 }] },
      { clave: "b", texto: "Surco", candidatos: [{ x: 104, y: 102 }, { x: 104, y: 160 }] },
    ], []);
    expect(segundo).toMatchObject({ x: 104, y: 160 });
  });
});

describe("cajaProyectada", () => {
  it("recorre un MultiPolygon", () => {
    const caja = cajaProyectada([[[[0, 0], [2, 0], [2, 3]]], [[[5, 1], [6, 1]]]], (lon, lat) => ({ x: lon * 10, y: lat * 10 }));
    expect(caja).toEqual({ x0: 0, y0: 0, x1: 60, y1: 30 });
    expect(candidatosDeCaja({ x: 1, y: 1 }, caja)).toHaveLength(8);
  });
});
