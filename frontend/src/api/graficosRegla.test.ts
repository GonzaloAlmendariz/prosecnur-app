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

// `cabe_nativa` y `motivo_imagen`: la escala del resumen sale como imagen con más filas que el tope o con más de una
// columna «Sin información» (98 «No sabe» y 99 «No responde»). El cliente no puede deducirlo de `tope_filas`.
describe("normalizarConteoRegla: cabe_nativa y motivo_imagen", () => {
  it("conserva el false del motor y su motivo aunque las filas estén bajo el tope", () => {
    const motivo = "Hay dos opciones sin información; la lámina nativa admite una y la escala sale como imagen.";
    const c = normalizarConteoRegla({ total: 4, tope_filas: 20, cabe_nativa: false, motivo_imagen: motivo });
    expect(c.cabe_nativa).toBe(false);
    expect(c.motivo_imagen).toBe(motivo);
    expect(normalizarConteoRegla({ cabe_nativa: [true], motivo_imagen: null }).cabe_nativa).toBe(true);
    expect(normalizarConteoRegla({ cabe_nativa: [false], motivo_imagen: [motivo] }).motivo_imagen).toBe(motivo);
  });

  it("ausente, null o de otro tipo queda en null, nunca en un true inventado", () => {
    for (const v of [undefined, null, "false", 0, 1, {}, [true, false]]) {
      expect(normalizarConteoRegla({ cabe_nativa: v }).cabe_nativa).toBeNull();
    }
    expect(normalizarConteoRegla({}).motivo_imagen).toBeNull();
    expect(normalizarConteoRegla(null).cabe_nativa).toBeNull();
  });
});
