/**
 * El botón de estabilidad dice de dónde sale su número de corridas.
 *
 * Estaba resuelto con `Number(config.simulation_runs ?? … ?? 500) || 500` bajo un
 * comentario que decía «el número de corridas es del estudio, no del botón». El
 * código hacía lo contrario: `??` no cubre el cero y `|| 500` lo reemplaza, así
 * que con el `simulation_runs: 0` de HSVG2026 el botón anunciaba «500 corridas»
 * como si el estudio las hubiera pedido.
 */
import { describe, expect, it } from "vitest";
import { CM_CORRIDAS_ESTABILIDAD_DEFECTO, corridasDeEstabilidad } from "../duracionComparacion";

describe("de dónde salen las corridas de estabilidad", () => {
  it("un 0 declarado NO se lee como una decisión del estudio", () => {
    // El caso que rompía: `?? ` deja pasar el 0 y `|| 500` lo pisa en silencio.
    const r = corridasDeEstabilidad({ simulation_runs: 0 });
    expect(r.corridas).toBe(CM_CORRIDAS_ESTABILIDAD_DEFECTO);
    expect(r.delEstudio).toBe(false);
  });

  it("un número declarado por el estudio manda y se anuncia como tal", () => {
    const r = corridasDeEstabilidad({ simulation_runs: 120 });
    expect(r.corridas).toBe(120);
    expect(r.delEstudio).toBe(true);
  });

  it("sin nada declarado usa el defecto y lo dice", () => {
    expect(corridasDeEstabilidad({}).delEstudio).toBe(false);
    expect(corridasDeEstabilidad({}).corridas).toBe(CM_CORRIDAS_ESTABILIDAD_DEFECTO);
  });

  it("acepta el alias monte_carlo_n del motor", () => {
    const r = corridasDeEstabilidad({ monte_carlo_n: 250 });
    expect(r.corridas).toBe(250);
    expect(r.delEstudio).toBe(true);
  });

  it("un valor basura no se propaga como cifra del estudio", () => {
    for (const v of ["muchas", -5, Number.NaN, null]) {
      const r = corridasDeEstabilidad({ simulation_runs: v });
      expect(r.delEstudio, `${String(v)} no debería contar como del estudio`).toBe(false);
      expect(r.corridas).toBe(CM_CORRIDAS_ESTABILIDAD_DEFECTO);
    }
  });
});
