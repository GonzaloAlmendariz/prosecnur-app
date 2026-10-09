import { describe, expect, it } from "vitest";

import { deLaFacultad } from "./deLaFacultad";

describe("deLaFacultad", () => {
  const filas = [
    { faculty: "DERECHO", n: 1 },
    { faculty: "LETRAS", n: 2 },
    { facultad: "derecho", n: 3 },
    { faculty: "CIENCIAS E INGENIERÍA", n: 4 },
  ];

  it("sin facultad devuelve EL MISMO array, sin copiar", () => {
    expect(deLaFacultad(filas, undefined)).toBe(filas);
    expect(deLaFacultad(filas, "")).toBe(filas);
  });

  it("acepta los dos nombres de campo, `faculty` y `facultad`", () => {
    expect(deLaFacultad(filas, "DERECHO").map((f) => f.n)).toEqual([1, 3]);
  });

  it("compara sin tildes ni mayúsculas: el foco viene de la URL", () => {
    // `foco=facultad:Ciencias e Ingenieria` tiene que casar con la fila del
    // plan, que la escribe con tilde.
    expect(deLaFacultad(filas, "ciencias e ingenieria").map((f) => f.n)).toEqual([4]);
  });

  it("una facultad que no está devuelve vacío, no todo", () => {
    // El fallo silencioso de un filtro es devolver el universo entero: la
    // pantalla diría «todas» donde el usuario pidió una.
    expect(deLaFacultad(filas, "MEDICINA")).toEqual([]);
  });

  it("sin filas no revienta", () => {
    expect(deLaFacultad(null, "DERECHO")).toEqual([]);
    expect(deLaFacultad([], "DERECHO")).toEqual([]);
  });
});
