// La distribución que el P25 resume — el modelo del gráfico de Cálculo.
// Protege: cuantiles tipo 7 (los de R, consistentes con el motor), sólo aulas
// incluidas, y que el orden lo fije el divisor REAL del reparto — no el
// P25, que sólo es el divisor cuando el analista lo eligió.
import { describe, expect, it } from "vitest";
import { cuantilTipo7, distribucionElegibles, ordenarPorDivisor } from "../distribucionElegiblesModel";

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

describe("ordenarPorDivisor", () => {
  const fila = (facultad: string, p25: number) => ({
    clave: facultad, facultad, nAulas: 10, min: 1, p25, mediana: p25 + 10, p75: p25 + 20, max: p25 + 30,
  });

  it("ordena por el divisor sellado, no por el P25", () => {
    // Medido: con `min_mediana_media`, EE.GG. Letras tiene P25 25 y divisor
    // 49,5. Ordenar por P25 la pondría entre las de aulas chicas cuando su
    // aula típica es de las más grandes — y el carril promete lo contrario.
    const filas = [fila("EGL", 25), fila("ARTE", 17), fila("CEI", 25)];
    const divisores: Record<string, number> = { EGL: 49.5, ARTE: 20, CEI: 31 };
    const orden = ordenarPorDivisor(filas, (f) => divisores[f]).map((f) => f.facultad);
    expect(orden).toEqual(["ARTE", "CEI", "EGL"]);
  });

  it("una facultad sin divisor conserva su P25 como clave y no cae al final", () => {
    const filas = [fila("SIN", 12), fila("CON", 40)];
    const orden = ordenarPorDivisor(filas, (f) => (f === "CON" ? 40 : null)).map((f) => f.facultad);
    expect(orden).toEqual(["SIN", "CON"]);
  });

  it("no muta la lista que recibe", () => {
    const filas = [fila("B", 30), fila("A", 10)];
    const copia = [...filas];
    ordenarPorDivisor(filas, () => null);
    expect(filas).toEqual(copia);
  });
});
