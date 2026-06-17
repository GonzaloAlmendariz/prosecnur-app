import { describe, expect, it } from "vitest";
import type { TerritorialBlockProgress, TerritorialResponseAuditRow } from "../../api/client";
import { resolveTerritorialGeoAssignment } from "./territorialGeoAssignment";

function makeBlock(overrides: Partial<TerritorialBlockProgress>): TerritorialBlockProgress {
  return {
    id_manzana: "150108016000580",
    ubigeo: "150108",
    distrito: "CHORRILLOS",
    zona: "01600",
    manzana: "0580",
    tipo_manzana: "titular",
    territorio_muestral: "150108-01600",
    orden_seleccion: 38,
    hoja_num: 38,
    rango_inicio: 297,
    rango_fin: 304,
    entrevistas: 8,
    medida_tamano: null,
    lat: null,
    lon: null,
    ump: "38",
    meta: 8,
    validas: 7,
    revision: 0,
    no_defendibles: 0,
    avance_pct: 87.5,
    brecha: 1,
    ...overrides,
  };
}

function makeRow(overrides: Partial<TerritorialResponseAuditRow>): Partial<TerritorialResponseAuditRow> {
  return {
    response_id: "response",
    ubigeo: "150108",
    distrito: "CHORRILLOS",
    advance_valid: true,
    ...overrides,
  };
}

describe("territorialGeoAssignment", () => {
  const ump38 = makeBlock({});
  const ump39 = makeBlock({
    id_manzana: "15010801700011A",
    zona: "01700",
    manzana: "011A",
    orden_seleccion: 39,
    hoja_num: 39,
    rango_inicio: 305,
    rango_fin: 312,
    ump: "39",
    validas: 8,
    brecha: 0,
    avance_pct: 100,
  });
  const blocks = [ump38, ump39];

  it("groups GPS points by declared or reconciled UMP instead of nearest block", () => {
    const rows = [
      ...Array.from({ length: 7 }, (_, index) => makeRow({
        response_id: `ump38-${index + 1}`,
        declared_ump_raw: "38",
        declared_ump_normalized: "38",
        advance_block_id: "150108016000580",
        advance_block_ump: "38",
        nearest_block_id: "150108016000580",
      })),
      makeRow({
        response_id: "8f155780-b558-494d-bfbe-0f7995d926aa",
        declared_ump_raw: "39",
        declared_ump_normalized: "39",
        advance_block_id: "15010801700011A",
        advance_block_ump: "39",
        nearest_block_id: "150108016000580",
      }),
    ];

    const grouped = rows.reduce<Record<string, number>>((acc, row) => {
      const result = resolveTerritorialGeoAssignment(row, blocks);
      const key = result.block?.ump ?? "sin-ump";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    const mismatch = resolveTerritorialGeoAssignment(rows[7], blocks);

    expect(grouped["38"]).toBe(7);
    expect(grouped["39"]).toBe(1);
    expect(mismatch.block?.ump).toBe("39");
    expect(mismatch.nearestBlock?.ump).toBe("38");
    expect(mismatch.nearestDiffers).toBe(true);
    expect(mismatch.source).toBe("advance_block_id");
  });

  it("keeps nearest block as diagnostic only when UMP is missing", () => {
    const result = resolveTerritorialGeoAssignment(makeRow({
      response_id: "missing-ump",
      nearest_block_id: "150108016000580",
    }), blocks);

    expect(result.block).toBeNull();
    expect(result.source).toBe("none");
    expect(result.nearestBlock?.ump).toBe("38");
    expect(result.nearestDiffers).toBe(false);
  });
});
