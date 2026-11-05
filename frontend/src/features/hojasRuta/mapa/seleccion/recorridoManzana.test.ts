import { describe, expect, it } from "vitest";
import { indiceEsquina, ordenDelRecorrido, tramoInicial, vaHorario, verticesDe } from "./recorridoManzana";

// Un cuadrado de 10 en el mundo (y hacia el sur): NO (0,0), NE (10,0), SE (10,10), SO (0,10).
// El anillo va NO → NE → SE → SO: horario tal como se ve.
const anillo = [0, 0, 10, 0, 10, 10, 0, 10, 0, 0];
const v = verticesDe(anillo);

describe("recorrido sobre la manzana (convención de la ficha PDF)", () => {
  it("quita el vértice de cierre", () => {
    expect(v).toEqual([[0, 0], [10, 0], [10, 10], [0, 10]]);
  });
  it("numera las esquinas en sentido horario desde el noreste", () => {
    expect(v[indiceEsquina(v, "1")]).toEqual([10, 0]);
    expect(v[indiceEsquina(v, "2")]).toEqual([10, 10]);
    expect(v[indiceEsquina(v, "3")]).toEqual([0, 10]);
    expect(v[indiceEsquina(v, "4")]).toEqual([0, 0]);
    expect(indiceEsquina(v, "auto")).toBe(-1);
  });
  it("sabe en qué sentido viene el anillo", () => {
    expect(vaHorario(v)).toBe(true);
    expect(vaHorario([...v].reverse())).toBe(false);
  });
  it("recorrido 1 es horario y 2 antihorario, venga como venga el anillo", () => {
    expect(ordenDelRecorrido(v, "1", "1").slice(0, 2)).toEqual([[10, 0], [10, 10]]);
    expect(ordenDelRecorrido(v, "1", "2").slice(0, 2)).toEqual([[10, 0], [0, 0]]);
    expect(ordenDelRecorrido([...v].reverse(), "1", "1").slice(0, 2)).toEqual([[10, 0], [10, 10]]);
  });
  it("el tramo inicial cubre la fracción pedida del perímetro", () => {
    const t = tramoInicial(ordenDelRecorrido(v, "1", "1"), 0.375);
    expect(t).toEqual([[10, 0], [10, 10], [5, 10]]);
  });
});
