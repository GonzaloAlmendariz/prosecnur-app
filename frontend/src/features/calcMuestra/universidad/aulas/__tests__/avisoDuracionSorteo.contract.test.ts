/**
 * El coste de «Optimizar repetidos» se anuncia antes de lanzarlo.
 *
 * Ese método hace `candidate_pool_size` sorteos completos, no uno. Con el
 * default de 500 son ~16 minutos frente a 22,8 s de los otros tres, y la UI no
 * avisaba: costó una espera de seis minutos hasta que Gonzalo canceló, y días
 * de diagnóstico buscando la causa en el entorno del job.
 */
import { describe, expect, it } from "vitest";
import { avisoDuracionSorteo } from "../duracionComparacion";

describe("aviso de coste del sorteo", () => {
  it("el pool con 500 candidatas avisa y dice cuántos sorteos son", () => {
    const a = avisoDuracionSorteo({ metodoId: "pool_controlado", candidatas: 500 });
    expect(a.avisar).toBe(true);
    expect(a.sorteos).toBe(500);
  });

  it("los otros tres métodos sortean una vez y no avisan", () => {
    for (const id of ["cube_balanceado", "sistematico_pps", "local_pivotal_balanceado"]) {
      const a = avisoDuracionSorteo({ metodoId: id, candidatas: 500 });
      expect(a.avisar, `${id} no debería avisar`).toBe(false);
      expect(a.sorteos).toBe(1);
    }
  });

  it("un pool pequeño no dispara el aviso: la escala es lo que importa", () => {
    expect(avisoDuracionSorteo({ metodoId: "pool_controlado", candidatas: 5 }).avisar).toBe(false);
  });

  it("sin candidatas declaradas no inventa un número", () => {
    const a = avisoDuracionSorteo({ metodoId: "pool_controlado", candidatas: Number.NaN });
    expect(a.sorteos).toBe(1);
    expect(a.avisar).toBe(false);
  });
});
