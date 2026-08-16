import { describe, expect, it } from "vitest";

import { calcularImpacto, detalleFilas } from "./impactoDecisiones";
import type { LimpiezaBeforeAfterPreview, LimpiezaDecisionSummary } from "./types";

function preview(over: Partial<LimpiezaBeforeAfterPreview["impact"]> = {},
                 filas: [number, number] = [103, 103]): LimpiezaBeforeAfterPreview {
  return {
    before: { total_inconsistencias: 4, reglas_con_casos: 2, reglas_total: 7, filas_base: filas[0] },
    after: { total_inconsistencias: 0, reglas_con_casos: 0, reglas_total: 7, filas_base: filas[1] },
    impact: {
      cases_excluded: 0, cells_changed: 0, replacements: 0,
      normalizations: 0, imputations: 0, rules_resolved: 0, ...over,
    },
    residual_final: [],
    decisions_ready: 0,
  };
}

function summary(listas: number): LimpiezaDecisionSummary {
  return {
    total_reglas_con_casos: 2, total_reglas_automaticas: 2, total_reglas_custom: 0,
    total_casos_afectados: 4, total_decisiones: listas, decisiones_listas: listas,
    pendientes: 0, total_casos_excluidos: 0, total_celdas_corregidas: 0,
    total_reemplazos: 0, total_imputaciones: 0, ready_to_finalize: true,
  };
}

describe("calcularImpacto", () => {
  it("sin decisiones listas no hay nada que declarar", () => {
    // El vacío de esta banda es «todavía no decidiste», y eso ya lo dice la
    // cola de hallazgos: la superficie no existe en vez de mostrar ceros.
    expect(calcularImpacto(preview(), summary(0))).toBeNull();
    expect(calcularImpacto(null, null)).toBeNull();
  });

  it("declara lo que van a hacer las decisiones", () => {
    const imp = calcularImpacto(preview({ cases_excluded: 2, cells_changed: 14 }, [103, 101]), summary(3));
    expect(imp?.nulo).toBe(false);
    expect(imp?.titular).toBe("2 casos excluidos · 14 celdas corregidas");
    expect(detalleFilas(imp!)).toBe("La base pasaría de 103 a 101 casos al cerrar.");
  });

  it("avisa cuando hay decisiones listas y ninguna cambia nada", () => {
    // El caso que motiva la vara V3: un valor mal escrito o un id de caso que
    // no existe. Hoy se descubre después de cerrar la base, cuando ya se
    // invalidó codificación y analítica para rehacerlas idénticas.
    const imp = calcularImpacto(preview(), summary(3));
    expect(imp?.nulo).toBe(true);
    expect(imp?.titular).toBe("3 decisiones listas y ninguna cambia la base");
  });

  it("una regla resuelta sin celdas tocadas sigue siendo impacto nulo sobre la base", () => {
    // Ignorar una regla la resuelve, pero no cambia un solo dato. Que el
    // contador de reglas suba no puede tapar que la base queda igual.
    const imp = calcularImpacto(preview({ rules_resolved: 2 }), summary(2));
    expect(imp?.nulo).toBe(true);
    expect(imp?.reglasResueltas).toBe(2);
  });

  it("concuerda en número", () => {
    expect(calcularImpacto(preview({ cases_excluded: 1 }, [103, 102]), summary(1))?.titular)
      .toBe("1 caso excluido");
    expect(calcularImpacto(preview({ cells_changed: 1 }), summary(1))?.titular)
      .toBe("1 celda corregida");
    expect(calcularImpacto(preview(), summary(1))?.titular)
      .toBe("1 decisión lista y ninguna cambia la base");
  });

  it("cuenta las listas del summary y cae al preview si falta", () => {
    const p = { ...preview({ cases_excluded: 1 }), decisions_ready: 5 };
    expect(calcularImpacto(p, null)?.listas).toBe(5);
  });
});

describe("detalleFilas", () => {
  it("no repite el conteo cuando la base no cambia de tamaño", () => {
    // «103 → 103» es ruido: no dice nada que el titular no diga mejor.
    const imp = calcularImpacto(preview({ cells_changed: 9 }, [103, 103]), summary(2))!;
    expect(detalleFilas(imp)).toBe("");
  });

  it("calla si el motor no informó el tamaño", () => {
    const p = preview({ cases_excluded: 2 });
    // @ts-expect-error — el backend puede omitirlo; el normalizador debe aguantarlo.
    p.before.filas_base = null;
    const imp = calcularImpacto(p, summary(1))!;
    expect(detalleFilas(imp)).toBe("");
  });
});

describe("exclusión declarada sin efecto", () => {
  it("no confía en cases_excluded: la verdad es el delta de filas", () => {
    // Medido sobre acrconta: excluir un identificador que no existe reporta
    // `cases_excluded: 1` con la base en 172 → 172. Si la banda leyera el
    // contador, diría «1 caso excluido» y dejaría pasar el error de tipeo que
    // existe para atrapar.
    const imp = calcularImpacto(preview({ cases_excluded: 1 }, [172, 172]), summary(1));
    expect(imp?.exclusionSinEfecto).toBe(true);
    expect(imp?.nulo).toBe(true);
    expect(imp?.titular).toBe("1 exclusión declarada y la base no pierde ninguna fila");
    // El control: la misma exclusión, pero efectiva, sí se cuenta como cambio.
    const buena = calcularImpacto(preview({ cases_excluded: 1 }, [172, 171]), summary(1));
    expect(buena?.exclusionSinEfecto).toBe(false);
    expect(buena?.nulo).toBe(false);
    expect(buena?.titular).toBe("1 caso excluido");
  });

  it("una exclusión sin efecto no se disfraza de trabajo hecho junto a celdas reales", () => {
    const imp = calcularImpacto(preview({ cases_excluded: 2, cells_changed: 9 }, [172, 172]), summary(3));
    expect(imp?.exclusionSinEfecto).toBe(true);
    // Hay celdas corregidas de verdad, así que el conjunto no es nulo…
    expect(imp?.nulo).toBe(false);
    // …pero el titular no puede afirmar dos exclusiones que no ocurrieron.
    expect(imp?.titular).toBe("2 exclusiones declaradas y la base no pierde ninguna fila");
  });

  it("sin conteo de filas no inventa el diagnóstico", () => {
    const p = preview({ cases_excluded: 1 });
    // @ts-expect-error — el backend puede omitirlo.
    p.after.filas_base = null;
    const imp = calcularImpacto(p, summary(1));
    expect(imp?.exclusionSinEfecto).toBe(false);
    expect(imp?.titular).toBe("1 caso excluido");
  });
});
