import { describe, expect, it } from "vitest";

import { normalizarConteoRegla } from "./graficosRegla";

// `tope_filas` de POST /api/graficos/resumenes/regla: el tope de filas de la lámina nativa (20 en la escala del
// resumen) o null si el graficador no tiene. La UI lo muestra junto al corte y avisa sin esperar al motor.

describe("normalizarConteoRegla: tope_filas", () => {
  it("conserva un tope entero positivo, también como arreglo de uno o texto", () => {
    expect(normalizarConteoRegla({ total: 22, tope_filas: 20 }).tope_filas).toBe(20);
    expect(normalizarConteoRegla({ tope_filas: [20] }).tope_filas).toBe(20);
    expect(normalizarConteoRegla({ tope_filas: "20" }).tope_filas).toBe(20);
  });

  it("sin tope, ausente o inválido queda en null, nunca en un número inventado", () => {
    for (const v of [null, undefined, 0, -3, "x", {}, NaN]) {
      expect(normalizarConteoRegla({ total: 5, tope_filas: v }).tope_filas).toBeNull();
    }
    expect(normalizarConteoRegla({ total: 5 }).tope_filas).toBeNull();
    expect(normalizarConteoRegla(null).tope_filas).toBeNull();
  });
});
