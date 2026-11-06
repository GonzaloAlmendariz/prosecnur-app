import { describe, expect, it } from "vitest";
import { barrasDePiramide } from "./piramide";

const rangos = [{ id: "a", label: "18 a 29", min: 18, max: 29 }, { id: "b", label: "", min: 60, max: null }];
const filas = [
  { ubigeo: "150103", territorio: "Ate", porRango: [{ H: 10, M: 12 }, { H: 3, M: 5 }], total: 30 },
  { ubigeo: "150132", territorio: "SJL", porRango: [{ H: 20, M: 18 }, { H: 4, M: 6 }], total: 48 },
];

describe("pirámide de la población objetivo (checklist F8)", () => {
  it("suma por rango y sexo y pone a los mayores arriba", () => {
    expect(barrasDePiramide(filas, rangos)).toEqual([
      { rango: "60 y más", H: 7, M: 11 },
      { rango: "18 a 29", H: 30, M: 30 },
    ]);
  });
});
