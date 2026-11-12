import { describe, expect, it } from "vitest";

import type { CadenaDeCasos } from "../../../api/validacionCierre";
import { casosQueCuentan } from "./casosQueCuentanModel";

function cadena(parcial: Partial<CadenaDeCasos>): CadenaDeCasos {
  return {
    momento: "al_cerrar",
    recibidos: 115,
    n_fuentes: null,
    fuera: { retirados_fuera_de_la_app: 0, pruebas: 0, sin_clasificar: 0, por_reglas_de_carga: 0, fuera_de_la_auditoria: 0 },
    excluidos_en_limpieza: 3,
    cuentan: 112,
    proporcion: 112 / 115,
    cuadra: true,
    filtro_de_pruebas: false,
    depuracion_externa: false,
    base_promovida: false,
    base: null,
    avisos: [],
    ...parcial,
  };
}

describe("casosQueCuentan", () => {
  it("dice cuántos casos cuentan sobre los recibidos de la base activa", () => {
    const r = casosQueCuentan(cadena({}));
    expect(r?.cuentanTexto).toBe("112");
    expect(r?.resto).toBe("de 115 casos cuentan");
    expect(r?.detalle).toMatch(/casos recibidos en la base activa/);
  });

  it("concuerda el verbo con los que cuentan y el sustantivo con los recibidos", () => {
    expect(casosQueCuentan(cadena({ cuentan: 1, recibidos: 115 }))?.resto).toBe("de 115 casos cuenta");
    expect(casosQueCuentan(cadena({ cuentan: 1, recibidos: 1 }))?.resto).toBe("de 1 caso cuenta");
  });

  it("no dibuja la pieza si falta una de las dos cifras: nunca un 0 por ausencia", () => {
    expect(casosQueCuentan(null)).toBeNull();
    expect(casosQueCuentan(cadena({ cuentan: null }))).toBeNull();
    expect(casosQueCuentan(cadena({ recibidos: null }))).toBeNull();
    expect(casosQueCuentan(cadena({ recibidos: 0, cuentan: 0 }))).toBeNull();
  });

  it("descarta una cadena incoherente en vez de publicar más casos de los recibidos", () => {
    expect(casosQueCuentan(cadena({ cuentan: 120 }))).toBeNull();
  });

  it("declara la vista previa y la resta que no cuadra en el detalle", () => {
    expect(casosQueCuentan(cadena({ momento: "prevista" }))?.detalle).toMatch(/Vista previa/);
    expect(casosQueCuentan(cadena({ cuadra: false }))?.detalle).toMatch(/no cuadra/);
  });
});
