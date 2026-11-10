import { describe, expect, it } from "vitest";
import { csvDeLaMatriz } from "./csvDeLaMatriz";

const FILAS = [{ ubigeo: "150101", territorio: "Lima, Cercado", porRango: [{ H: 40.4, M: 59.6 }], total: 100 }];
const RANGOS = [{ id: "r1", label: "18-29", min: 18, max: 29 }];

describe("csvDeLaMatriz", () => {
  it("por distrito: cabecera con ubigeo, celdas con coma entre comillas y cifras redondeadas", () => {
    expect(csvDeLaMatriz(FILAS, "distrito", RANGOS, false).split("\n")).toEqual([
      "Distrito,Ubigeo,18-29,Total",
      "\"Lima, Cercado\",150101,100,100",
    ]);
  });

  it("por sexo: una columna por sexo en cada rango", () => {
    expect(csvDeLaMatriz(FILAS, "provincia", RANGOS, true).split("\n")).toEqual([
      "Provincia,18-29 H,18-29 M,Total",
      "\"Lima, Cercado\",40,60,100",
    ]);
  });
});
