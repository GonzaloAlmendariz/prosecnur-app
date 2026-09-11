import { describe, expect, it } from "vitest";

import { composicionDelAula } from "./composicionDelAula";

/**
 * `sex_top_1` es el sexo MÁS FRECUENTE del aula, no «mujeres». Leerlo al revés
 * invierte la composición en la mitad de las aulas.
 */
const fila = (f: Record<string, unknown>) => f as never;

describe("la composición por sexo de un curso-horario", () => {
  it("con mayoría de mujeres, el primero son ellas", () => {
    expect(composicionDelAula(fila({ sex_top_1: "F", sex_top_1_n: 30, sex_top_2: "M", sex_top_2_n: 8 })))
      .toEqual({ mujeres: 30, hombres: 8, total: 38 });
  });

  it("con mayoría de hombres, el primero son ellos", () => {
    expect(composicionDelAula(fila({ sex_top_1: "M", sex_top_1_n: 22, sex_top_2: "F", sex_top_2_n: 9 })))
      .toEqual({ mujeres: 9, hombres: 22, total: 31 });
  });

  it("una etiqueta que no se reconoce NO se reparte a ciegas", () => {
    // Publicar cero mujeres diría que el aula no tiene ninguna, cuando lo que
    // pasa es que no se sabe. El total sí se conserva.
    expect(composicionDelAula(fila({ sex_top_1: "OTRO", sex_top_1_n: 20, sex_top_2_n: 5 })))
      .toEqual({ mujeres: 0, hombres: 0, total: 25 });
  });

  it("un aula de un solo sexo declara el otro en cero", () => {
    expect(composicionDelAula(fila({ sex_top_1: "F", sex_top_1_n: 18 })))
      .toEqual({ mujeres: 18, hombres: 0, total: 18 });
  });

  it("sin fila no se cae", () => {
    expect(composicionDelAula(null)).toEqual({ mujeres: 0, hombres: 0, total: 0 });
  });
});
