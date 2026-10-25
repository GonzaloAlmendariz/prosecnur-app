import { describe, expect, it } from "vitest";
import type { MonitoreoTerritorialDashboard } from "../../../../../api/client";
import { construirHistoriaDeUmp } from "./historiaUmpModel";
import { CORTE_DE_CUOTAS } from "./fixtures/corteDeCuotas";

/**
 * La historia de la UMP 107 del diseño, en miniatura y sobre la UMP 143 del
 * fixture: el Aplicador A levanta 4 en la manzana de reemplazo (2 aceptan), se
 * anula su producción, el Aplicador B levanta 7 en la titular y una
 * subsanación completa la cuota de 8.
 */
const A = "P900 · Aplicador A";
const B = "P901 · Aplicador B";
const anulado = (id: string, efectiva: boolean) => ({
  response_id: id, responsible_display: A, advance_ump_label: "UMP 143", advance_block_id: "150135063000600",
  submission_date_iso: "2026-06-17", source_effective: efectiva, validation_status: efectiva ? "validada" : "no_defendible",
});
const delCorte = (id: string, extra: Record<string, unknown> = {}) => ({
  response_id: id, responsible_display: B, advance_block_id: "150135063000590", submission_date_iso: "2026-06-28",
  advance_valid: true, validation_status: "validada", observation_status: "sin_observacion", ...extra,
});

const AVANCE = {
  ...CORTE_DE_CUOTAS,
  production_annulments: {
    entries: [{ id: "x", status: "active", scope: "all_production", responsible_label: A, created_at: "2026-06-26T15:00:00Z" }],
    rows: [anulado("a1", true), anulado("a2", true), anulado("a3", false), anulado("a4", false)],
  },
  operational_adjustments: {
    ...CORTE_DE_CUOTAS.operational_adjustments,
    applied: [{ status: "active", created_at: "2026-07-03T14:00:00Z", target_block_id: "150135063000590", target_ump: "UMP 143", source_ump: "UMP 101", sex: "Mujer", age_group: "60+", count: 1 }],
  },
} as unknown as MonitoreoTerritorialDashboard;

const VALIDACION = {
  response_audit: [
    ...["b1", "b2", "b3", "b4", "b5", "b6"].map((id) => delCorte(id)),
    delCorte("b7", { observation_status: "en_observacion" }),
    delCorte("z", { advance_block_id: "150103007000100" }),
  ],
} as unknown as MonitoreoTerritorialDashboard;

describe("historia de una UMP", () => {
  const historia = construirHistoriaDeUmp(AVANCE, VALIDACION, "143");

  it("cuatro capítulos en orden, cada uno con lo que cuenta al cerrarse", () => {
    expect(historia?.capitulos.map((capitulo) => [capitulo.numero, capitulo.tipo, capitulo.fecha, capitulo.cuentan])).toEqual([
      [1, "jornada", "17/06", 2],
      [2, "anulacion", "26/06", 0],
      [3, "jornada", "28/06", 7],
      [4, "subsanacion", "03/07", 8],
    ]);
  });

  it("los capítulos se leen en lenguaje llano", () => {
    expect(historia?.capitulos.map((capitulo) => capitulo.texto)).toEqual([
      `${A} levanta 4 formularios en la manzana de reemplazo 0600: 2 cuentan.`,
      `Se anula la producción de ${A}: salen 4 formularios, 2 que contaban.`,
      `${B} levanta 7 formularios en la manzana titular 0590: 7 cuentan.`,
      "Una subsanación trae 1 caso (mujer de 60 o más años) desde la UMP 101.",
    ]);
  });

  it("la curva va día por día a la misma distancia y cuadra con lo que cuenta hoy", () => {
    expect(historia?.dias).toHaveLength(17);
    expect(historia?.dias[0]).toEqual({ dia: "2026-06-17", rotulo: "17/06", cuentan: 2, capitulo: 1 });
    expect(historia?.dias[1]).toMatchObject({ rotulo: "18/06", cuentan: 2, capitulo: null });
    expect(historia?.dias.at(-1)).toMatchObject({ rotulo: "03/07", cuentan: 8, capitulo: 4 });
    expect(historia).toMatchObject({ meta: 8, cuentanHoy: 8, cuadra: true });
  });

  it("los formularios anulados conservan si aceptaron o no", () => {
    expect(historia?.capitulos[0].formularios.map((item) => item.resultado)).toEqual([
      "anulado-efectiva", "anulado-efectiva", "anulado-sin-consentimiento", "anulado-sin-consentimiento",
    ]);
  });

  it("sin la UMP no hay historia", () => {
    expect(construirHistoriaDeUmp(AVANCE, VALIDACION, "999")).toBeNull();
  });
});
