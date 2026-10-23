import { describe, expect, it } from "vitest";
import type { MonitoreoTerritorialDashboard } from "../../../../../api/client";
import { ajusteParaAplicar, construirSubsanaciones } from "./subsanacionesModel";

const CORTE = {
  operational_adjustments: {
    schema: "monitoreo_territorial_operational_adjustments_v1",
    deficits: [
      { id: "d1", district: "SAN MARTIN DE PORRES", sex: "", age_group: "30-44", target_block_id: "m143", target_ump: "UMP 143", target_manzana: "0590", missing: 1, match_status: "eligible" },
      { id: "d2", district: "SAN MARTIN DE PORRES", sex: "Hombre", age_group: "18-29", target_block_id: "m96", target_ump: "UMP 96", missing: 1, match_status: "blocked" },
      { id: "d3", district: "SAN MARTIN DE PORRES", sex: "Mujer", age_group: "60+", target_block_id: "m96", target_ump: "UMP 96", missing: 2, match_status: "blocked" },
      { id: "d4", district: "ATE", sex: "Mujer", age_group: "", target_block_id: "m7", target_ump: "7", missing: 0, match_status: "blocked" },
    ],
    suggestions: [
      { id: "s1", district: "SAN MARTIN DE PORRES", sex: "Hombre", age_group: "30-44", source_block_id: "m142", source_ump: "UMP 142", source_manzana: "0440", source_responsible: "P824 · Uno", target_block_id: "m143", target_ump: "UMP 143", target_manzana: "0590", target_responsible: "P132 · Dos", source_response_ids: ["a"], count: 1, distance_km: 0.45, reason: "Paquete que cierra la UMP" },
    ],
    applied: [
      { id: "x1", status: "active", created_at: "2026-07-03T20:22:00", created_by: "coordinacion", district: "ATE", sex: "Mujer", age_group: "60+", source_block_id: "m101", source_ump: "UMP 101", target_block_id: "m107", target_ump: "UMP 107", source_response_ids: ["b"], count: 1, note: "Cierra la 107" },
      { id: "x2", status: "reverted", created_at: "2026-07-03T20:10:00", reverted_at: "2026-07-03T20:21:00", district: "ATE", sex: "Hombre", age_group: "18-29", source_block_id: "m1", source_ump: "1", target_block_id: "m2", target_ump: "2", source_response_ids: ["c"], count: 1 },
    ],
  },
} as unknown as MonitoreoTerritorialDashboard;

describe("Control › Subsanaciones", () => {
  const modelo = construirSubsanaciones(CORTE);

  it("agrupa las celdas con déficit por UMP, las elegibles primero, sin las ya cubiertas", () => {
    expect(modelo.umps.map((item) => [item.ump, item.elegible, item.falta])).toEqual([["143", true, 1], ["96", false, 3]]);
    expect(modelo.umps[1].celdas).toEqual([{ texto: "hombre de 18 a 29 años", falta: 1 }, { texto: "mujer de 60 o más años", falta: 2 }]);
    expect(modelo.celdas).toBe(3);
  });

  it("el paquete sugerido dice de dónde, a dónde, qué celda y a qué distancia", () => {
    expect(modelo.sugerencias[0]).toMatchObject({
      origen: { ump: "142", manzana: "0440", aplicador: "P824 · Uno" },
      destino: { ump: "143", manzana: "0590" },
      movimientos: [{ celda: "hombre de 30 a 44 años", casos: 1 }],
      casos: 1,
      distancia: "0.45 km",
    });
  });

  it("activas por distrito, revertidas y el historial con lo último primero", () => {
    expect(modelo).toMatchObject({ activas: 1, revertidas: 1 });
    expect(modelo.activasPorDistrito).toEqual([{ distrito: "Ate", casos: 1 }]);
    expect(modelo.historial.map((item) => [item.cuando, item.estado])).toEqual([["03/07 20:22", "activa"], ["03/07 20:21", "revertida"]]);
    expect(modelo.historial[0].texto).toBe("Aplicada · UMP 101 → UMP 107: 1 caso (mujer de 60 o más años) · coordinacion");
    expect(modelo.historial[0].nota).toBe("Cierra la 107");
    expect(modelo.idsActivos.has("x1")).toBe(true);
  });

  it("al aplicar manda la nota del coordinador, o una que diga qué se movió", () => {
    expect(ajusteParaAplicar(modelo.sugerencias[0], "  Lo revisé con campo ").note).toBe("Lo revisé con campo");
    expect(ajusteParaAplicar(modelo.sugerencias[0], "").note).toBe("Aplicado desde Control › Subsanaciones: UMP 142 → UMP 143: 1 caso (hombre de 30 a 44 años).");
  });

  it("un corte sin subsanaciones calculadas no se lee como «nada que subsanar»", () => {
    const sin = construirSubsanaciones({ operational_adjustments: { schema: "x", reason: "scope_sin_subsanaciones" } } as unknown as MonitoreoTerritorialDashboard);
    expect(sin.disponible).toBe(false);
  });
});
