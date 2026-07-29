import { describe, expect, it } from "vitest";

import {
  normalizarValores,
  variablesDeInteres,
  variablesSegmentables,
} from "./variablesDeInteres";
import type { MonitoreoSourceVariableStat } from "../../../api/monitoreo";

/** Columna con reparto, como la publica el motor. */
function col(
  label: string,
  cobertura: number,
  categorias: Array<[string, number]>,
  extra: Partial<MonitoreoSourceVariableStat> = {},
): MonitoreoSourceVariableStat {
  const noVacios = categorias.reduce((s, [, n]) => s + n, 0);
  return {
    name: label.toLowerCase().replace(/\s+/g, "_"),
    label,
    non_empty: noVacios,
    total: 100,
    coverage_pct: cobertura,
    distribucion: {
      non_empty: noVacios,
      distinct_count: categorias.length,
      categorical: true,
      categories: categorias.map(([value, count]) => ({ value, count })),
      otras_categorias: 0,
      otras_casos: 0,
    },
    ...extra,
  };
}

describe("variablesDeInteres: el orden lo manda la cobertura", () => {
  it("ordena de mayor a menor cobertura", () => {
    const orden = variablesDeInteres([
      col("Media", 60, [["a", 6], ["b", 4]]),
      col("Alta", 100, [["a", 5], ["b", 5]]),
      col("Baja", 20, [["a", 1], ["b", 1]]),
    ]).map((v) => v.label);
    expect(orden).toEqual(["Alta", "Media", "Baja"]);
  });

  it("a igual cobertura gana la de menos categorías: se lee de un vistazo", () => {
    const orden = variablesDeInteres([
      col("Muchas", 100, Array.from({ length: 30 }, (_, i) => [`c${i}`, 1] as [string, number])),
      col("Pocas", 100, [["a", 5], ["b", 5]]),
    ]).map((v) => v.label);
    expect(orden).toEqual(["Pocas", "Muchas"]);
  });

  it("lo que no puede segmentar va al final, no se oculta", () => {
    const lista = variablesDeInteres([
      col("Vacía", 0, []),
      col("Ciclo de egreso", 100, [["2021-1", 4], ["2021-2", 3]]),
    ]);
    expect(lista.map((v) => v.label)).toEqual(["Ciclo de egreso", "Vacía"]);
    expect(lista[1].motivoNoSegmenta).toBe("sin-datos");
  });
});

describe("variablesDeInteres: qué descarta y por qué", () => {
  it("una columna con un valor por persona es un identificador", () => {
    const [v] = variablesDeInteres([
      { name: "n", label: "N°", non_empty: 270, total: 270, coverage_pct: 100,
        distribucion: { non_empty: 270, distinct_count: 270, categorical: false, categories: [], otras_categorias: 0, otras_casos: 0 } },
    ]);
    expect(v.motivoNoSegmenta).toBe("identificador");
  });

  it("una sola categoría no segmenta nada", () => {
    const [v] = variablesDeInteres([col("Ciclo", 100, [["2026-1", 54]])]);
    expect(v.motivoNoSegmenta).toBe("categoria-unica");
  });

  it("las columnas de contacto quedan fuera aunque tengan cobertura total", () => {
    const [v] = variablesDeInteres([col("Correo", 100, [["a@b.c", 1], ["d@e.f", 1]], { kind: "email" })]);
    expect(v.motivoNoSegmenta).toBe("dato-personal");
  });

  it("las candidatas reales de ACRDCONTA sobreviven al filtro", () => {
    const segmentables = variablesSegmentables([
      col("Ciclo de egreso", 100, [["2021-1", 40], ["2021-2", 38], ["2022-1", 35]]),
      col("Categoría", 100, [["ASOCIADO", 12], ["CONTRATADO", 9], ["AUXILIAR", 7]]),
      col("Whatsapp", 0, []),
      { name: "n", label: "N°", non_empty: 270, total: 270, coverage_pct: 100,
        distribucion: { non_empty: 270, distinct_count: 270, categorical: false, categories: [], otras_categorias: 0, otras_casos: 0 } },
    ]).map((v) => v.label);
    expect(segmentables).toEqual(["Categoría", "Ciclo de egreso"]);
  });
});

describe("normalización por año", () => {
  it("agrupa los semestres de una misma cohorte", () => {
    const agrupado = normalizarValores(
      [{ value: "2021-1", count: 40 }, { value: "2021-2", count: 38 }, { value: "2022-1", count: 35 }],
      "anio",
    );
    expect(agrupado).toEqual([
      { value: "2021", count: 78 },
      { value: "2022", count: 35 },
    ]);
  });

  it("sin normalizar deja el reparto intacto", () => {
    const valores = [{ value: "2021-1", count: 40 }, { value: "2021-2", count: 38 }];
    expect(normalizarValores(valores, "ninguna")).toEqual(valores);
  });

  it("no fabrica un grupo cuando el valor no tiene año", () => {
    const agrupado = normalizarValores(
      [{ value: "Sin dato", count: 3 }, { value: "2021-1", count: 5 }],
      "anio",
    );
    expect(agrupado.find((v) => v.value === "Sin dato")?.count).toBe(3);
    expect(agrupado.find((v) => v.value === "2021")?.count).toBe(5);
  });

  it("normalizar conserva el total de casos", () => {
    const valores = [
      { value: "2021-1", count: 40 },
      { value: "2021-2", count: 38 },
      { value: "sin dato", count: 2 },
    ];
    const total = valores.reduce((s, v) => s + v.count, 0);
    expect(normalizarValores(valores, "anio").reduce((s, v) => s + v.count, 0)).toBe(total);
  });

  it("la sugerencia del motor viaja hasta la candidata", () => {
    const [v] = variablesDeInteres([
      col("Ciclo de egreso", 100, [["2021-1", 4], ["2021-2", 3]], { normalizacion_sugerida: "anio" }),
    ]);
    expect(v.normalizacionSugerida).toBe("anio");
  });
});
