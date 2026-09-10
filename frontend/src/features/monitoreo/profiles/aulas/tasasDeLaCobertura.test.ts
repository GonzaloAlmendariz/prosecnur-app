import { describe, expect, it } from "vitest";

import { tasasDeLaCobertura } from "./tasasDeLaCobertura";
import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";

const fila = (f: Record<string, unknown>) =>
  ({ application_state: "cerrando", ...f } as unknown as MonitoreoAulasPlanRow);

describe("tasasDeLaCobertura", () => {
  const tres = [
    fila({ eligible_n: 40, expected_valid: 20, respuestas_validas: 10 }),
    fila({ eligible_n: 40, expected_valid: 20, respuestas_validas: 30 }),
    fila({ eligible_n: 20, expected_valid: 10, respuestas_validas: 10 }),
  ];

  it("las dos tasas comparten denominador: los elegibles", () => {
    const t = tasasDeLaCobertura(tres);
    // 50 esperadas de 100 elegibles = 50 %; 50 efectivas de 100 = 50 %.
    expect(t.elegibles).toBe(100);
    expect(t.esperada).toBe(50);
    expect(t.observada).toBe(50);
    expect(t.desvio).toBe(0);
  });

  it("se ponderan por tamaño, no se promedian las tasas", () => {
    // Un aula de 80 al 25 % y otra de 20 al 100 %: la ponderada es 40 %, el
    // promedio de tasas sería 62,5 % y le daría el mismo peso a las dos.
    const t = tasasDeLaCobertura([
      fila({ eligible_n: 80, expected_valid: 40, respuestas_validas: 20 }),
      fila({ eligible_n: 20, expected_valid: 10, respuestas_validas: 20 }),
      fila({ eligible_n: 20, expected_valid: 10, respuestas_validas: 0 }),
    ]);
    expect(t.observada).toBe(33.3);
  });

  it("con menos de tres aplicados NO hay tasa observada", () => {
    // Dos aulas no son una tasa. Mismo umbral que el ranking y el pronóstico.
    const t = tasasDeLaCobertura(tres.slice(0, 2));
    expect(t.esperada).toBe(50);
    expect(t.observada).toBeNull();
    expect(t.desvio).toBeNull();
  });

  it("los PENDIENTES no entran: hundirían la observada con aulas a las que no les toca", () => {
    const t = tasasDeLaCobertura([
      ...tres,
      fila({ application_state: "lista", eligible_n: 100, expected_valid: 50, respuestas_validas: 0 }),
    ]);
    expect(t.aulas).toBe(3);
    expect(t.elegibles).toBe(100);
    expect(t.observada).toBe(50);
  });

  it("un aula sin elegibles declarados no puede entrar en una tasa sobre elegibles", () => {
    const t = tasasDeLaCobertura([...tres, fila({ eligible_n: 0, expected_valid: 10, respuestas_validas: 8 })]);
    expect(t.aulas).toBe(3);
    expect(t.efectivas).toBe(50);
  });

  it("sin filas devuelve nulos, no ceros: no es que rindan cero, es que no hay", () => {
    const t = tasasDeLaCobertura([]);
    expect(t.esperada).toBeNull();
    expect(t.observada).toBeNull();
  });
});
