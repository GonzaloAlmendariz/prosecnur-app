// La distribución que el P25 resume — el modelo del gráfico de Cálculo.
// Protege: cuantiles tipo 7 (los de R, consistentes con el motor), sólo aulas
// incluidas, y el orden por P25 ascendente que cuenta la historia.
import { describe, expect, it } from "vitest";
import { cuantilTipo7, distribucionElegibles } from "../distribucionElegiblesModel";

describe("cuantilTipo7", () => {
  it("replica la interpolación de R (verificada contra el motor)", () => {
    // C&I 2026: P25 = 25.25 con el motor; mismo resultado aquí.
    expect(cuantilTipo7([20, 25, 26, 40], 0.25)).toBeCloseTo(23.75);
    expect(cuantilTipo7([10, 20, 30, 40, 50], 0.25)).toBe(20);
    expect(cuantilTipo7([10, 20, 30, 40, 50], 0.5)).toBe(30);
    expect(cuantilTipo7([7], 0.25)).toBe(7);
  });
});

describe("distribucionElegibles", () => {
  const aula = (faculty: string, eligible_n: number, included = true) => ({
    faculty,
    eligible_n,
    included,
  });

  it("agrega por facultad solo las incluidas y ordena por P25 ascendente", () => {
    const filas = distribucionElegibles([
      aula("GRANDE", 40), aula("GRANDE", 44), aula("GRANDE", 50),
      aula("CHICA", 10), aula("CHICA", 12), aula("CHICA", 30),
      aula("CHICA", 99, false), // excluida: no cuenta
    ]);
    expect(filas.map((f) => f.facultad)).toEqual(["CHICA", "GRANDE"]);
    const chica = filas[0];
    expect(chica.nAulas).toBe(3);
    expect(chica.min).toBe(10);
    expect(chica.max).toBe(30);
    expect(chica.p25).toBeCloseTo(11);
    expect(chica.mediana).toBe(12);
  });

  it("sin marco devuelve vacío, jamás inventa", () => {
    expect(distribucionElegibles(null)).toEqual([]);
    expect(distribucionElegibles([aula("X", 5, false)])).toEqual([]);
  });
});
